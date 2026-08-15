import { InferenceClient } from "@huggingface/inference";

const MULTILINGUAL_MODEL =
  process.env.HF_MULTILINGUAL_EMBEDDING_MODEL || "intfloat/multilingual-e5-large";
const MEDICAL_MODEL =
  process.env.HF_MEDICAL_EMBEDDING_MODEL || "sentence-transformers/embeddinggemma-300m-medical";

function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? dot / (Math.sqrt(aa) * Math.sqrt(bb)) : 0;
}

function meanPool(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  if (typeof value[0] === "number") return value as number[];

  const rows = (value as unknown[]).map(meanPool).filter((x) => x.length);
  if (!rows.length) return [];
  const dim = Math.min(...rows.map((x) => x.length));
  const out = new Array(dim).fill(0);
  for (const row of rows) for (let i = 0; i < dim; i++) out[i] += row[i];
  return out.map((x) => x / rows.length);
}

function unpackBatch(raw: unknown, expected: number): number[][] {
  if (!Array.isArray(raw)) return [];
  if (expected === 1) return [meanPool(raw)];
  // Most sentence embedding APIs return [batch, dimensions].
  if (raw.length === expected) return raw.map(meanPool);
  return [];
}

async function embed(model: string, texts: string[]): Promise<number[][] | null> {
  const token = process.env.HF_TOKEN;
  if (!token || !texts.length) return null;
  try {
    const client = new InferenceClient(token);
    const output = await client.featureExtraction({
      model,
      inputs: texts,
    });
    const vectors = unpackBatch(output, texts.length);
    return vectors.length === texts.length ? vectors : null;
  } catch (error) {
    console.error(`Embedding model failed: ${model}`, error);
    return null;
  }
}

export async function neuralSimilarity(
  queryOriginal: string,
  queryEnglish: string,
  documents: string[]
): Promise<{
  scores: number[];
  multilingual: boolean;
  medical: boolean;
  models: string[];
}> {
  if (!documents.length) return {scores: [], multilingual: false, medical: false, models: []};

  const multiInputs = [
    `query: ${queryOriginal}`,
    ...documents.map((x) => `passage: ${x}`),
  ];
  const multilingualVectors = await embed(MULTILINGUAL_MODEL, multiInputs);

  const medicalInputs = [queryEnglish || queryOriginal, ...documents];
  const medicalVectors = await embed(MEDICAL_MODEL, medicalInputs);

  const scores = documents.map((_, i) => {
    const m = multilingualVectors?.[0] && multilingualVectors?.[i + 1]
      ? cosine(multilingualVectors[0], multilingualVectors[i + 1])
      : null;
    const med = medicalVectors?.[0] && medicalVectors?.[i + 1]
      ? cosine(medicalVectors[0], medicalVectors[i + 1])
      : null;

    if (m != null && med != null) return 0.62 * m + 0.38 * med;
    if (m != null) return m;
    if (med != null) return med;
    return 0;
  });

  const models: string[] = [];
  if (multilingualVectors) models.push(MULTILINGUAL_MODEL);
  if (medicalVectors) models.push(MEDICAL_MODEL);

  return {
    scores,
    multilingual: Boolean(multilingualVectors),
    medical: Boolean(medicalVectors),
    models,
  };
}
