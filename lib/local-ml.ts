"use client";

const MODEL_ID = "Xenova/multilingual-e5-small";
let extractorPromise: Promise<any> | null = null;

function cosine(a: number[], b: number[]): number {
  const count = Math.min(a.length, b.length);
  let dot = 0, aa = 0, bb = 0;
  for (let index = 0; index < count; index++) {
    dot += a[index] * b[index];
    aa += a[index] * a[index];
    bb += b[index] * b[index];
  }
  return aa && bb ? dot / (Math.sqrt(aa) * Math.sqrt(bb)) : 0;
}

async function extractor() {
  if (!extractorPromise) {
    extractorPromise = import("@huggingface/transformers").then(async ({env, pipeline}) => {
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      return pipeline("feature-extraction", MODEL_ID, {dtype: "q8"});
    });
  }
  return extractorPromise;
}

async function vectorize(model: any, text: string): Promise<number[]> {
  const output = await model(text, {pooling: "mean", normalize: true});
  const rows = output.tolist() as number[][];
  return Array.isArray(rows[0]) ? rows[0] : rows as unknown as number[];
}

export async function localNeuralRank(query: string, documents: Array<{id: string; text: string}>) {
  const started = performance.now();
  const model = await extractor();
  const queryVector = await vectorize(model, "query: " + query);
  const ranked = [];
  for (const document of documents) {
    const vector = await vectorize(model, "passage: " + document.text);
    ranked.push({id: document.id, score: cosine(queryVector, vector)});
  }
  ranked.sort((a, b) => b.score - a.score);
  return {
    model: MODEL_ID,
    runtime: "Transformers.js ONNX q8 in browser",
    elapsedMs: Math.round(performance.now() - started),
    ranked,
  };
}
