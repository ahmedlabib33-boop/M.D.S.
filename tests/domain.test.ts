import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSafety } from "../lib/safety";
import { nutritionGuidance } from "../lib/nutrition";
import { measurementInsights, parseMeasurementImport, supportedMeasurementNames } from "../lib/measurements";
import { legacyEntResearch } from "../lib/legacy-ent";
import manifest from "../data/source_manifest.json";

test("Arabic airway symptoms route to emergency", () => {
  const flags = evaluateSafety({symptoms: "لا استطيع التنفس مع ازرقاق الشفاه"});
  assert.ok(flags.some((flag) => flag.id === "airway" && flag.severity === "emergency"));
});

test("pregnancy bleeding with pain routes urgently", () => {
  const flags = evaluateSafety({symptoms: "bleeding with abdominal pain", pregnant: true});
  assert.ok(flags.some((flag) => flag.id === "pregnancy_bleeding"));
});

test("nutrition restricts automation for advanced renal disease", () => {
  const guidance = nutritionGuidance({symptoms: "fatigue", knownConditions: "advanced renal disease"});
  assert.equal(guidance.status, "restricted");
  assert.equal(guidance.emphasize.length, 0);
});

test("unrestricted nutrition has medical source identifiers", () => {
  const guidance = nutritionGuidance({symptoms: "general wellness"});
  assert.equal(guidance.status, "available");
  assert.ok(guidance.emphasize.length > 0);
  assert.ok(guidance.sourceIds.includes("dga"));
  assert.ok(guidance.sourceIds.includes("nih-ods"));
});

test("iPhone measurement JSON validates", () => {
  const parsed = parseMeasurementImport({
    device: "iPhone 15 Pro Max",
    timestamp: "2026-08-15T10:00:00Z",
    accuracyDisclaimer: "Approximate ARKit measurement",
    measurements: [
      {name: "neck_circumference_cm", value: 39.2, unit: "cm", confidence: "medium", method: "ARKit LiDAR"},
      {name: "interpupillary_distance_mm", value: 63, unit: "mm", confidence: "high", method: "TrueDepth"},
    ],
  });
  assert.equal(parsed.measurements.length, 2);
  assert.equal(parsed.measurements[0].source, "iphone_lidar");
  assert.ok(supportedMeasurementNames.includes("ear_projection_angle_degree"));
});

test("unsupported measurement is rejected", () => {
  assert.throws(() => parseMeasurementImport({measurements: [{name: "blood_glucose", value: 100, unit: "unknown"}]}));
});

test("measurement context requires confirmation", () => {
  const insight = measurementInsights([{name: "neck_circumference_cm", value: 42, unit: "cm", confidence: "medium", source: "iphone_lidar"}]);
  assert.equal(insight.length, 1);
  assert.ok(insight[0].clinicalContext.toLowerCase().includes("confirm"));
});

test("legacy ENT engine performs numeric ranking", () => {
  const ranked = legacyEntResearch("child with ear pain fever bulging red eardrum", 5);
  assert.equal(ranked.length, 5);
  assert.ok(ranked.some((item) => item.name.includes("Acute Otitis Media")));
  assert.ok(ranked.every((item) => Number.isFinite(item.tfidfScore) && Number.isFinite(item.naiveBayesShare)));
});

test("medical sources stay separate from creator attribution", () => {
  assert.equal(manifest.creator.display, "Developed & Created | Eng. Ahmed Labib");
  assert.ok(manifest.knowledge_sources.length >= 13);
  assert.ok(manifest.knowledge_sources.every((source) => source.role && source.release && source.name));
  assert.ok(manifest.medical_authorship_notice.toLowerCase().includes("did not author"));
});
