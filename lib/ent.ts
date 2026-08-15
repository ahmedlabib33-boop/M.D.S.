import entKb from "@/data/ent_knowledge_base.json";
import { lexicalScore } from "./text";

type EntCondition = Record<string, any>;

function flatten(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flatten).join(" ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k} ${flatten(v)}`)
      .join(" ");
  }
  return String(value);
}

export function entConditions(): EntCondition[] {
  return (entKb as any).conditions ?? [];
}

export function entDocument(c: EntCondition): string {
  return [
    c.name, c.name,
    c.category,
    c.definition,
    flatten(c.symptoms), flatten(c.symptoms),
    flatten(c.signs), flatten(c.signs),
    flatten(c.red_flags), flatten(c.red_flags),
    flatten(c.differential_diagnosis),
    flatten(c.investigations),
    flatten(c.management),
    flatten(c.complications),
  ].filter(Boolean).join(" ");
}

export function rankEntLexically(query: string, limit = 10) {
  return entConditions()
    .map((condition) => ({
      condition,
      lexicalScore: lexicalScore(query, entDocument(condition)),
    }))
    .sort((a, b) => b.lexicalScore - a.lexicalScore)
    .slice(0, limit);
}

export function getEntMeta() {
  return (entKb as any).meta ?? {};
}
