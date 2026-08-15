import manifest from "@/data/source_manifest.json";
import type { KnowledgeSourceRecord } from "./types";

type ManifestSource = Omit<KnowledgeSourceRecord, "contributed">;

export const PLATFORM_PROVENANCE = "Developed & Created | Eng. Ahmed Labib";

export const MEDICAL_AUTHORSHIP_NOTICE =
  "Eng. Ahmed Labib created and engineered this software platform. He did not author the external medical knowledge; medical content is attributed to the independent sources listed in the source registry.";

export function sourceRegistry(contributedIds: string[] = []): KnowledgeSourceRecord[] {
  const used = new Set(contributedIds);
  return (manifest.knowledge_sources as ManifestSource[]).map((source) => ({
    ...source,
    contributed: used.has(source.id),
  }));
}

export function modelRegistry() {
  return manifest.ml_models;
}
