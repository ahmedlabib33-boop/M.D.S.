import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSafety } from "../lib/safety";
import { nutritionGuidance } from "../lib/nutrition";
import { createManualMeasurements, measurementInsights, parseMeasurementImport, supportedMeasurementNames } from "../lib/measurements";
import { cleanPatientName, createPatientRecord, patientVaultBackup } from "../lib/patient-records";
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

test("guided measurements create real manual entries", () => {
  const measurements = createManualMeasurements({height_cm: "178.4", pinna_height_mm: ""}, "Clinical instrument");
  assert.equal(measurements.length, 1);
  assert.equal(measurements[0].value, 178.4);
  assert.equal(measurements[0].unit, "cm");
  assert.equal(measurements[0].source, "manual");
});

test("patient records accept only male or female", () => {
  const record = createPatientRecord({id: "patient-1", name: "  Ahmed   Test  ", sex: "male", now: "2026-08-15T00:00:00.000Z"});
  assert.equal(record.name, "Ahmed Test");
  assert.equal(record.context.sex, "male");
  assert.throws(() => createPatientRecord({id: "patient-2", name: "Test", sex: "unknown" as never}));
  assert.throws(() => cleanPatientName("A"));
});

test("patient vault backup contains no sample records", () => {
  const backup = patientVaultBackup([], "2026-08-15T00:00:00.000Z");
  assert.equal(backup.patients.length, 0);
  assert.ok(backup.storageNotice.includes("not committed to Git"));
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
