export type Sex = "female" | "male" | "intersex" | "unknown";

export interface VitalSignsInput {
  temperatureC?: number;
  heartRate?: number;
  systolicBp?: number;
  diastolicBp?: number;
  respiratoryRate?: number;
  spo2?: number;
  painScore?: number;
  weightKg?: number;
  heightCm?: number;
}

export interface BodyMeasurement {
  name: string;
  value: number;
  unit: "cm" | "mm" | "degree" | "percent" | "unknown";
  confidence?: "high" | "medium" | "low" | "unknown";
  method?: string;
  capturedAt?: string;
  source?: "iphone_lidar" | "manual" | "imported";
}

export interface DietaryContext {
  pattern?: string;
  preferences?: string;
  intolerances?: string;
  activity?: "sedentary" | "light" | "moderate" | "high" | "unknown";
  goal?: "general_health" | "weight_support" | "symptom_support" | "unknown";
  lactating?: boolean | null;
  eatingDisorderConcern?: boolean;
  unintendedWeightLoss?: boolean;
}

export interface PatientContext {
  age?: number;
  sex?: Sex;
  pregnant?: boolean | null;
  duration?: string;
  symptoms: string;
  knownConditions?: string;
  medications?: string;
  allergies?: string;
  structuredSymptoms?: string[];
  vitals?: VitalSignsInput;
  measurements?: BodyMeasurement[];
  dietary?: DietaryContext;
  outputRegister?: "clinicalEnglish" | "plainEnglish" | "medicalArabic" | "plainArabic";
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  source: "ENT_KB" | "MEDLINEPLUS" | "HPO";
  sourceUrl?: string;
  category?: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface HpoTerm {
  id: string;
  label: string;
  definition?: string;
  synonyms?: string[];
  arabic?: string;
}

export interface RankedHpoTerm extends HpoTerm {
  lexicalScore: number;
  neuralScore?: number;
  score: number;
}

export interface DiseaseCandidate {
  id: string;
  name: string;
  matchedHpo: string[];
  ontologyScore: number;
  evidenceCount: number;
}

export interface SafetyFlag {
  id: string;
  severity: "emergency" | "urgent";
  clinicalLabel: string;
  plainEnglish: string;
  medicalArabic: string;
  matched: string[];
}

export interface ClinicalExtraction {
  detectedLanguage: "ar" | "en" | "mixed" | "unknown";
  normalizedEnglishQuery: string;
  symptoms: string[];
  negatedSymptoms: string[];
  onsetDuration?: string;
  severityDescriptors: string[];
  bodySystems: string[];
  uncertaintyNotes: string[];
  source: "ai_gateway" | "deterministic";
}

export interface NutritionGuidance {
  status: "available" | "restricted" | "insufficient_context";
  headline: string;
  emphasize: string[];
  limit: string[];
  substitutions: string[];
  hydration: string[];
  cautions: string[];
  rationale: string[];
  sourceIds: string[];
}

export interface MeasurementInsight {
  measurement: string;
  summary: string;
  clinicalContext: string;
  severity: "information" | "review";
}

export interface LegacyEntResearchResult {
  id: string;
  name: string;
  tfidfScore: number;
  naiveBayesShare: number;
  ensembleScore: number;
}

export interface KnowledgeSourceRecord {
  id: string;
  name: string;
  role: string;
  release: string;
  url?: string;
  access: "bundled" | "live" | "optional" | "reference";
  contributed?: boolean;
}

export interface AnalysisResponse {
  disclaimer: string;
  safety: {
    route: "emergency" | "urgent" | "non_emergency";
    flags: SafetyFlag[];
  };
  extraction: ClinicalExtraction;
  hpoMatches: RankedHpoTerm[];
  diseaseCandidates: DiseaseCandidate[];
  entMatches: Array<{
    id: string;
    name: string;
    category?: string;
    score: number;
    mlScore?: number;
    lexicalScore: number;
  }>;
  medlinePlus: Array<{
    title: string;
    url?: string;
    summary?: string;
    score?: number;
  }>;
  nutrition: NutritionGuidance;
  measurementInsights: MeasurementInsight[];
  legacyEntResearch: LegacyEntResearchResult[];
  explanation: {
    clinicalEnglish: string;
    plainEnglish: string;
    medicalArabic: string;
    plainArabic: string;
    questionsToClarify: string[];
    uncertainty: string;
  };
  engine: {
    multilingualEmbedding: boolean;
    medicalEmbedding: boolean;
    aiSynthesis: boolean;
    ontologyDiseaseMap: boolean;
    models: string[];
    note: string;
    timingsMs: Record<string, number>;
  };
  sources: KnowledgeSourceRecord[];
  provenance: Array<{source: string; detail: string; url?: string}>;
}
