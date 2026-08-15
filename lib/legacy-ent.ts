import entKb from "@/data/ent_knowledge_base.json";
import type { LegacyEntResearchResult } from "./types";

type Condition = Record<string, unknown>;

const STOP = new Set(["the","and","or","of","to","a","an","in","with","for","is","are","on","at","by"]);
const conditions = ((entKb as {conditions?: Condition[]}).conditions ?? []);

function flatten(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flatten).join(" ");
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).map(flatten).join(" ");
  return String(value);
}

function tokens(value: string): string[] {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)
    .filter((x) => x.length > 1 && !STOP.has(x));
}

const docs = conditions.map((c) => tokens([
  c.name, c.name, c.category, c.definition, c.symptoms, c.symptoms,
  c.signs, c.red_flags, c.complications, c.differential_diagnosis,
].map(flatten).join(" ")));

const vocab = new Set(docs.flat());
const documentFrequency = new Map<string, number>();
for (const word of vocab) documentFrequency.set(word, docs.filter((d) => d.includes(word)).length);

function tfidfVector(words: string[]): Map<string, number> {
  const count = new Map<string, number>();
  for (const word of words) count.set(word, (count.get(word) ?? 0) + 1);
  const vector = new Map<string, number>();
  for (const [word, n] of count) {
    const idf = Math.log((docs.length + 1) / ((documentFrequency.get(word) ?? 0) + 1)) + 1;
    vector.set(word, (n / Math.max(words.length, 1)) * idf);
  }
  return vector;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, aa = 0, bb = 0;
  for (const v of a.values()) aa += v * v;
  for (const v of b.values()) bb += v * v;
  for (const [k, v] of a) dot += v * (b.get(k) ?? 0);
  return aa && bb ? dot / (Math.sqrt(aa) * Math.sqrt(bb)) : 0;
}

const docVectors = docs.map(tfidfVector);

export function legacyEntResearch(query: string, limit = 5): LegacyEntResearchResult[] {
  const queryTokens = tokens(query);
  if (!queryTokens.length) return [];
  const queryVector = tfidfVector(queryTokens);

  const logScores = docs.map((doc) => {
    const counts = new Map<string, number>();
    for (const word of doc) counts.set(word, (counts.get(word) ?? 0) + 1);
    const denominator = doc.length + vocab.size;
    let score = Math.log(1 / Math.max(docs.length, 1));
    for (const word of queryTokens) score += Math.log(((counts.get(word) ?? 0) + 1) / denominator);
    return score;
  });
  const maxLog = Math.max(...logScores);
  const exponentials = logScores.map((x) => Math.exp(x - maxLog));
  const sum = exponentials.reduce((a, b) => a + b, 0) || 1;

  return conditions.map((condition, index) => {
    const tfidfScore = cosine(queryVector, docVectors[index]);
    const naiveBayesShare = exponentials[index] / sum;
    return {
      id: String(condition.id),
      name: String(condition.name),
      tfidfScore,
      naiveBayesShare,
      ensembleScore: 0.4 * tfidfScore + 0.6 * naiveBayesShare,
    };
  }).sort((a, b) => b.ensembleScore - a.ensembleScore).slice(0, limit);
}
