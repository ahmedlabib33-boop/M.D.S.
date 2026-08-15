import rules from "@/data/nutrition_rules.json";
import type { NutritionGuidance, PatientContext } from "./types";

function normalized(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

function includesAny(corpus: string, terms: string[]): boolean {
  return terms.some((term) => corpus.includes(term.toLowerCase()));
}

export function nutritionGuidance(ctx: PatientContext): NutritionGuidance {
  const corpus = normalized([
    ctx.knownConditions,
    ctx.medications,
    ctx.allergies,
    ctx.dietary?.intolerances,
    ctx.dietary?.pattern,
  ].filter(Boolean).join(" "));

  const restrictions = rules.restrictions.filter((rule) => includesAny(corpus, rule.terms));
  if (ctx.dietary?.eatingDisorderConcern) {
    restrictions.push({
      id: "reported-eating-disorder-concern",
      terms: [],
      message: "A reported eating-disorder concern requires specialist assessment; automated restriction or weight-loss advice is not appropriate.",
    });
  }

  const cautions = restrictions.map((rule) => rule.message);
  if (ctx.pregnant || ctx.dietary?.lactating) {
    cautions.push("Pregnancy or lactation changes nutrient requirements. Review individualized needs with the obstetric or nutrition team.");
  }
  if (ctx.allergies?.trim()) {
    cautions.push("Reported allergies: " + ctx.allergies + ". Avoidance must follow the confirmed allergy plan and label review.");
  }
  if (ctx.dietary?.unintendedWeightLoss) {
    cautions.push("Unintended weight loss warrants clinical assessment before dietary restriction.");
  }
  if (ctx.medications?.trim()) {
    cautions.push("Medication-food interaction screening is not inferred from text alone; confirm against current official labeling or with a pharmacist.");
  }

  const emphasize = [...rules.baseline.emphasize];
  const limit = [...rules.baseline.limit];
  const rationale = [...rules.baseline.rationale];

  for (const rule of rules.conditionRules) {
    if (!includesAny(corpus, rule.terms)) continue;
    emphasize.push(...rule.emphasize);
    limit.push(...rule.limit);
    rationale.push(rule.rationale);
  }

  const unique = (items: string[]) => Array.from(new Set(items));
  const restricted = restrictions.length > 0 || Boolean(ctx.dietary?.unintendedWeightLoss);

  return {
    status: restricted ? "restricted" : "available",
    headline: restricted
      ? "General nutrition automation is restricted for this context"
      : "Evidence-aligned food-pattern education",
    emphasize: restricted ? [] : unique(emphasize),
    limit: restricted ? [] : unique(limit),
    substitutions: restricted ? [] : rules.baseline.substitutions,
    hydration: rules.baseline.hydration,
    cautions: unique(cautions),
    rationale: restricted ? ["Individual assessment is required before condition-specific dietary change."] : unique(rationale),
    sourceIds: rules.baseline.sourceIds,
  };
}
