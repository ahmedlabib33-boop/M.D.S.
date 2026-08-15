import OpenAI from "openai";
import { z } from "zod";
import { detectLanguage } from "./text";
import { augmentArabicQuery } from "./arabic";
import type {
  ClinicalExtraction,
  DiseaseCandidate,
  PatientContext,
  RankedHpoTerm,
  SafetyFlag,
} from "./types";

const MODEL = process.env.AI_MODEL || "openai/gpt-5.6-sol";

function client(): OpenAI | null {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: "https://ai-gateway.vercel.sh/v1",
  });
}

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) return JSON.parse(cleaned.slice(first, last + 1));
  return JSON.parse(cleaned);
}

const ExtractionSchema = z.object({
  detectedLanguage: z.enum(["ar", "en", "mixed", "unknown"]),
  normalizedEnglishQuery: z.string(),
  symptoms: z.array(z.string()),
  negatedSymptoms: z.array(z.string()),
  onsetDuration: z.string().optional(),
  severityDescriptors: z.array(z.string()),
  bodySystems: z.array(z.string()),
  uncertaintyNotes: z.array(z.string()),
});

export async function extractClinicalFeatures(ctx: PatientContext): Promise<ClinicalExtraction> {
  const c = client();
  if (!c) {
    return {
      detectedLanguage: detectLanguage(ctx.symptoms),
      normalizedEnglishQuery: augmentArabicQuery(ctx.symptoms),
      symptoms: [ctx.symptoms],
      negatedSymptoms: [],
      onsetDuration: ctx.duration,
      severityDescriptors: [],
      bodySystems: [],
      uncertaintyNotes: ["AI clinical normalization is disabled because AI_GATEWAY_API_KEY is not configured."],
      source: "deterministic",
    };
  }

  const prompt = `
You are a medical NLP extraction component, not a diagnostician.
Extract ONLY features explicitly supported by the patient's text/context.
Do not infer a disease. Preserve negation and uncertainty.
Translate Arabic medical expressions into medically precise English for normalizedEnglishQuery.
Return JSON only with:
detectedLanguage: ar|en|mixed|unknown
normalizedEnglishQuery: string
symptoms: string[]
negatedSymptoms: string[]
onsetDuration?: string
severityDescriptors: string[]
bodySystems: string[]
uncertaintyNotes: string[]

Context:
age=${ctx.age ?? "unknown"}
sex=${ctx.sex ?? "unknown"}
pregnant=${ctx.pregnant ?? "unknown"}
duration=${ctx.duration ?? "not supplied"}
knownConditions=${ctx.knownConditions ?? "not supplied"}
medications=${ctx.medications ?? "not supplied"}
allergies=${ctx.allergies ?? "not supplied"}

Patient text:
${ctx.symptoms}
`.trim();

  try {
    const r = await c.chat.completions.create({
      model: MODEL,
      temperature: 0,
      messages: [{role: "user", content: prompt}],
    });
    const content = r.choices[0]?.message?.content ?? "";
    const parsed = ExtractionSchema.parse(extractJson(content));
    return {...parsed, source: "ai_gateway"};
  } catch (error) {
    console.error("Clinical extraction failed", error);
    return {
      detectedLanguage: detectLanguage(ctx.symptoms),
      normalizedEnglishQuery: augmentArabicQuery(ctx.symptoms),
      symptoms: [ctx.symptoms],
      negatedSymptoms: [],
      onsetDuration: ctx.duration,
      severityDescriptors: [],
      bodySystems: [],
      uncertaintyNotes: ["AI normalization failed; deterministic bilingual fallback was used."],
      source: "deterministic",
    };
  }
}

const ExplanationSchema = z.object({
  clinicalEnglish: z.string(),
  plainEnglish: z.string(),
  medicalArabic: z.string(),
  plainArabic: z.string(),
  questionsToClarify: z.array(z.string()).max(8),
  uncertainty: z.string(),
});

export async function synthesizeExplanation(args: {
  ctx: PatientContext;
  extraction: ClinicalExtraction;
  safetyFlags: SafetyFlag[];
  hpo: RankedHpoTerm[];
  diseases: DiseaseCandidate[];
  ent: Array<{name: string; category?: string; score: number}>;
  medline: Array<{title: string; summary?: string; url?: string}>;
}) {
  const c = client();
  if (!c) {
    const top = args.ent[0]?.name || args.medline[0]?.title || args.hpo[0]?.label || "No strong knowledge match";
    return {
      clinicalEnglish:
        `Decision-support retrieval found ${top} among the higher-ranked references. This is a retrieval result, not a diagnosis. Clinical history, examination and appropriate testing are required.`,
      plainEnglish:
        `The system found information that may be relevant to what you described, but it cannot tell from text alone what condition you have. A clinician may need to examine you and order tests.`,
      medicalArabic:
        `أظهر الاسترجاع الداعم للقرار أن «${top}» من النتائج الأعلى صلة. هذه نتيجة استرجاع معرفي وليست تشخيصاً. يلزم ربطها بالتاريخ المرضي والفحص السريري والفحوص المناسبة.`,
      plainArabic:
        `النظام وجد معلومات قد تكون مرتبطة بالأعراض التي وصفتها، لكنه لا يستطيع تحديد التشخيص من النص وحده. قد تحتاج إلى فحص طبي وتحاليل أو أشعة حسب الحالة.`,
      questionsToClarify: [
        "When did the symptoms start and are they worsening?",
        "What is the exact location and severity of the main symptom?",
        "Are there associated fever, breathing, neurological, bleeding, urinary or gastrointestinal symptoms?"
      ],
      uncertainty: "AI synthesis is disabled; output is deterministic and intentionally conservative.",
      modelUsed: null,
    };
  }

  const sourcePacket = {
    patientContext: args.ctx,
    extractedFeatures: args.extraction,
    safetyFlags: args.safetyFlags.map((x) => ({
      severity: x.severity,
      label: x.clinicalLabel,
    })),
    hpoPhenotypes: args.hpo.slice(0, 10).map((x) => ({
      id: x.id, label: x.label, definition: x.definition, score: x.score,
    })),
    hpoDiseaseCandidates: args.diseases.slice(0, 8).map((x) => ({
      id: x.id, name: x.name, matchedHpo: x.matchedHpo, ontologyScore: x.ontologyScore,
    })),
    entKnowledgeMatches: args.ent.slice(0, 5),
    medlinePlusTopics: args.medline.slice(0, 6),
  };

  const prompt = `
You are the explanation layer of an EDUCATIONAL CLINICAL DECISION-SUPPORT system.
You are NOT making a diagnosis and must not claim that a retrieved candidate is the patient's disease.

Use ONLY the supplied source packet. Do not invent examination findings, tests, medications,
dosages, probabilities, or diagnoses. Distinguish symptom/phenotype matches from disease candidates.
If an emergency safety flag exists, make that routing prominent without minimizing it.

Produce four parallel explanations:
1) clinicalEnglish: concise professional medical language suitable for a clinician/student.
2) plainEnglish: simple language understandable by a non-clinician.
3) medicalArabic: Modern Standard Arabic with accurate clinical/medical terminology.
4) plainArabic: clear simple Arabic understandable by a patient.
Also return questionsToClarify (max 8) and uncertainty.

Do not prescribe medication. Do not call retrieval/model scores "probability", "accuracy",
"confidence of diagnosis", "sensitivity", or "specificity".

Return JSON only:
{
 "clinicalEnglish": "...",
 "plainEnglish": "...",
 "medicalArabic": "...",
 "plainArabic": "...",
 "questionsToClarify": ["..."],
 "uncertainty": "..."
}

SOURCE PACKET:
${JSON.stringify(sourcePacket)}
`.trim();

  try {
    const r = await c.chat.completions.create({
      model: MODEL,
      temperature: 0.1,
      messages: [{role: "user", content: prompt}],
    });
    const content = r.choices[0]?.message?.content ?? "";
    const parsed = ExplanationSchema.parse(extractJson(content));
    return {...parsed, modelUsed: MODEL};
  } catch (error) {
    console.error("Synthesis failed", error);
    return {
      clinicalEnglish: "The evidence synthesis model was unavailable. Review the structured retrieval results and safety flags directly.",
      plainEnglish: "The explanation model could not generate a summary. The structured results below are still available.",
      medicalArabic: "تعذر تشغيل نموذج صياغة التفسير. يُرجى مراجعة نتائج الاسترجاع المنظمة وإشارات الأمان مباشرة.",
      plainArabic: "تعذر إنشاء الشرح الآن، لكن النتائج المنظمة ما زالت متاحة للمراجعة.",
      questionsToClarify: [],
      uncertainty: "Synthesis model failure; no generated clinical interpretation was used.",
      modelUsed: null,
    };
  }
}
