import type { AnalysisResponse, PatientContext, RankedHpoTerm } from "./types";
import { evaluateSafety } from "./safety";
import { extractClinicalFeatures, synthesizeExplanation } from "./ai";
import { rankEntLexically, entDocument } from "./ent";
import { rankHpoLexically, rankDiseasesFromHpo, diseaseMapAvailable, hpoIsFull } from "./hpo";
import { neuralSimilarity } from "./ml";
import { searchMedlinePlus } from "./medlineplus";
import { nutritionGuidance } from "./nutrition";
import { measurementInsights } from "./measurements";
import { legacyEntResearch } from "./legacy-ent";
import { sourceRegistry } from "./sources";

export async function analyzePatientContext(ctx: PatientContext): Promise<AnalysisResponse> {
  const started = Date.now();
  const timingsMs: Record<string, number> = {};

  const safetyStarted = Date.now();
  const safetyFlags = evaluateSafety(ctx);
  timingsMs.safety = Date.now() - safetyStarted;

  const extractionStarted = Date.now();
  const extraction = await extractClinicalFeatures(ctx);
  timingsMs.extraction = Date.now() - extractionStarted;
  const queryEnglish = extraction.normalizedEnglishQuery || ctx.symptoms;

  const lexicalStarted = Date.now();
  const hpoLex = rankHpoLexically(ctx.symptoms + "\n" + queryEnglish, 28);
  const entLex = rankEntLexically(ctx.symptoms + "\n" + queryEnglish, 10);
  timingsMs.lexicalRetrieval = Date.now() - lexicalStarted;

  const neuralStarted = Date.now();
  const hpoDocs = hpoLex.map((x) =>
    [x.label, x.definition ?? "", ...(x.synonyms ?? []), x.arabic ?? ""].join(" ")
  );
  const hpoNeural = await neuralSimilarity(ctx.symptoms, queryEnglish, hpoDocs);
  const hpoRanked: RankedHpoTerm[] = hpoLex.map((item, index) => {
    const neural = hpoNeural.scores[index] ?? 0;
    const active = hpoNeural.multilingual || hpoNeural.medical;
    return {
      ...item,
      neuralScore: active ? neural : undefined,
      score: active ? 0.25 * item.lexicalScore + 0.75 * Math.max(0, neural) : item.lexicalScore,
    };
  }).sort((a, b) => b.score - a.score).slice(0, 12);

  const entDocs = entLex.map((x) => entDocument(x.condition));
  const entNeural = await neuralSimilarity(ctx.symptoms, queryEnglish, entDocs);
  const entMatches = entLex.map((item, index) => {
    const neural = entNeural.scores[index] ?? 0;
    const active = entNeural.multilingual || entNeural.medical;
    return {
      id: item.condition.id,
      name: item.condition.name,
      category: item.condition.category,
      lexicalScore: item.lexicalScore,
      mlScore: active ? neural : undefined,
      score: active ? 0.3 * item.lexicalScore + 0.7 * Math.max(0, neural) : item.lexicalScore,
    };
  }).sort((a, b) => b.score - a.score).slice(0, 6);
  timingsMs.neuralRetrieval = Date.now() - neuralStarted;

  const ontologyStarted = Date.now();
  const diseaseCandidates = rankDiseasesFromHpo(hpoRanked, 10);
  timingsMs.ontologyRanking = Date.now() - ontologyStarted;

  const evidenceStarted = Date.now();
  const medlinePlus = await searchMedlinePlus(queryEnglish, 6);
  timingsMs.evidenceRetrieval = Date.now() - evidenceStarted;

  const nutrition = nutritionGuidance(ctx);
  const measured = measurementInsights(ctx.measurements);
  const legacyResearch = legacyEntResearch(queryEnglish, 5);

  const synthesisStarted = Date.now();
  const explanation = await synthesizeExplanation({
    ctx,
    extraction,
    safetyFlags,
    hpo: hpoRanked,
    diseases: diseaseCandidates,
    ent: entMatches.map((x) => ({name: x.name, category: x.category, score: x.score})),
    medline: medlinePlus,
  });
  timingsMs.synthesis = Date.now() - synthesisStarted;

  const models = Array.from(new Set([
    ...hpoNeural.models,
    ...entNeural.models,
    ...(explanation.modelUsed ? [explanation.modelUsed] : []),
  ]));

  const emergency = safetyFlags.some((x) => x.severity === "emergency");
  const urgent = safetyFlags.some((x) => x.severity === "urgent");
  const contributed = ["ent-kb", "hpo", ...nutrition.sourceIds];
  if (medlinePlus.length) contributed.push("medlineplus");
  timingsMs.total = Date.now() - started;

  return {
    disclaimer:
      "Educational clinical decision-support only. It does not diagnose disease, replace examination, or establish treatment. Retrieval and ontology scores are ranking signals, not disease probabilities.",
    safety: {
      route: emergency ? "emergency" : urgent ? "urgent" : "non_emergency",
      flags: safetyFlags,
    },
    extraction,
    hpoMatches: hpoRanked,
    diseaseCandidates,
    entMatches,
    medlinePlus,
    nutrition,
    measurementInsights: measured,
    legacyEntResearch: legacyResearch,
    explanation: {
      clinicalEnglish: explanation.clinicalEnglish,
      plainEnglish: explanation.plainEnglish,
      medicalArabic: explanation.medicalArabic,
      plainArabic: explanation.plainArabic,
      questionsToClarify: explanation.questionsToClarify,
      uncertainty: explanation.uncertainty,
    },
    engine: {
      multilingualEmbedding: hpoNeural.multilingual || entNeural.multilingual,
      medicalEmbedding: hpoNeural.medical || entNeural.medical,
      aiSynthesis: Boolean(explanation.modelUsed),
      ontologyDiseaseMap: diseaseMapAvailable(),
      models,
      note:
        (hpoIsFull() ? "Full synchronized HPO term index" : "Bundled HPO fallback seed") + "; " +
        (diseaseMapAvailable() ? "HPO disease annotations active" : "disease-phenotype map not synchronized") +
        ". No synthetic classifier accuracy is reported.",
      timingsMs,
    },
    sources: sourceRegistry(contributed),
    provenance: [
      {
        source: "Human Phenotype Ontology (HPO)",
        detail: hpoIsFull()
          ? "Synchronized standardized phenotype terminology."
          : "Fallback seed only; run npm run sync:knowledge for the full ontology.",
        url: "https://hpo.jax.org/",
      },
      {
        source: "HPO disease annotations",
        detail: diseaseMapAvailable()
          ? "Synchronized phenotype-to-disease annotations used for ontology scoring."
          : "Not present until the knowledge synchronization command is run.",
        url: "https://hpo.jax.org/",
      },
      {
        source: "MedlinePlus / U.S. National Library of Medicine",
        detail: medlinePlus.length
          ? "Current patient-education results returned by the official web service."
          : "No live result was returned for this request.",
        url: "https://medlineplus.gov/",
      },
      {
        source: "Original structured ENT knowledge base",
        detail: "Specialist educational reference retained with its original limitations; Eng. Ahmed Labib did not author the external medical sources.",
      },
    ],
  };
}
