import fs from "node:fs";
import path from "node:path";
import seed from "@/data/hpo_seed.json";
import { lexicalScore } from "./text";
import type { DiseaseCandidate, HpoTerm, RankedHpoTerm } from "./types";

const DATA = path.join(process.cwd(), "data");
const HPO_FILE = path.join(DATA, "hpo_compact.json");
const DISEASE_FILE = path.join(DATA, "hpo_diseases_compact.json");
const STATS_FILE = path.join(DATA, "hpo_statistics.json");

type DiseaseRow = { id: string; name: string; hpo: string[] };

function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

export function loadHpoTerms(): HpoTerm[] {
  return readJson<HpoTerm[]>(HPO_FILE) ?? (seed as HpoTerm[]);
}

export function hpoIsFull(): boolean {
  return fs.existsSync(HPO_FILE);
}

export function rankHpoLexically(query: string, limit = 40): RankedHpoTerm[] {
  return loadHpoTerms()
    .map((term) => {
      const doc = [term.label, term.definition ?? "", ...(term.synonyms ?? []), term.arabic ?? ""].join(" ");
      const score = lexicalScore(query, doc);
      return {...term, lexicalScore: score, score};
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function rankDiseasesFromHpo(matches: RankedHpoTerm[], limit = 12): DiseaseCandidate[] {
  const diseases = readJson<DiseaseRow[]>(DISEASE_FILE);
  if (!diseases?.length) return [];

  const stats = readJson<{diseaseCount: number; phenotypeDiseaseCount: Record<string, number>}>(STATS_FILE);
  const diseaseCount = stats?.diseaseCount ?? diseases.length;
  const query = new Map(
    matches
      .filter((x) => x.score > 0.02)
      .map((x) => [x.id, Math.max(0.01, x.score)])
  );

  const ranked: DiseaseCandidate[] = [];
  for (const disease of diseases) {
    let score = 0;
    const matched: string[] = [];
    for (const hpo of disease.hpo) {
      const qScore = query.get(hpo);
      if (!qScore) continue;
      const df = stats?.phenotypeDiseaseCount?.[hpo] ?? 1;
      const informationContent = Math.log((diseaseCount + 1) / (df + 1)) + 1;
      score += qScore * informationContent;
      matched.push(hpo);
    }
    if (matched.length) {
      ranked.push({
        id: disease.id,
        name: disease.name,
        matchedHpo: matched,
        ontologyScore: score / Math.sqrt(Math.max(1, disease.hpo.length)),
        evidenceCount: matched.length,
      });
    }
  }

  return ranked.sort((a, b) => b.ontologyScore - a.ontologyScore).slice(0, limit);
}

export function diseaseMapAvailable(): boolean {
  return fs.existsSync(DISEASE_FILE);
}
