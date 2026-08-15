import rules from "@/data/measurement_rules.json";
import type { BodyMeasurement, MeasurementInsight } from "./types";

type MeasurementRule = {
  unit: string;
  label: string;
  context: string;
  reviewAbove?: number;
};

const supported = rules.supported as Record<string, MeasurementRule>;

export function parseMeasurementImport(value: unknown): {
  measurements: BodyMeasurement[];
  notice: string;
  device?: string;
  capturedAt?: string;
} {
  if (!value || typeof value !== "object") throw new Error("Measurement file must contain a JSON object.");
  const root = value as Record<string, unknown>;
  if (!Array.isArray(root.measurements)) throw new Error("Measurement file is missing a measurements array.");
  if (root.measurements.length > 100) throw new Error("Measurement file contains too many entries.");

  const measurements = root.measurements.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error("Measurement " + (index + 1) + " is invalid.");
    const row = raw as Record<string, unknown>;
    const name = String(row.name ?? "");
    const rule = supported[name];
    if (!rule) throw new Error("Unsupported measurement: " + (name || "entry " + (index + 1)) + ".");
    const numeric = Number(row.value);
    if (!Number.isFinite(numeric) || numeric <= 0) throw new Error("Invalid value for " + name + ".");
    const unit = String(row.unit ?? rule.unit);
    if (unit !== rule.unit) throw new Error(name + " must use " + rule.unit + ".");

    return {
      name,
      value: numeric,
      unit: unit as BodyMeasurement["unit"],
      confidence: ["high", "medium", "low"].includes(String(row.confidence))
        ? String(row.confidence) as BodyMeasurement["confidence"]
        : "unknown",
      method: String(row.method ?? "Imported measurement"),
      capturedAt: String(row.timestamp ?? root.timestamp ?? ""),
      source: "iphone_lidar" as const,
    };
  });

  return {
    measurements,
    notice: String(root.accuracyDisclaimer ?? rules.accuracyNotice),
    device: root.device ? String(root.device) : undefined,
    capturedAt: root.timestamp ? String(root.timestamp) : undefined,
  };
}

export function measurementInsights(measurements: BodyMeasurement[] = []): MeasurementInsight[] {
  return measurements.flatMap((measurement) => {
    const rule = supported[measurement.name];
    if (!rule) return [];
    const needsReview = rule.reviewAbove != null && measurement.value > rule.reviewAbove;
    return [{
      measurement: rule.label,
      summary: measurement.value + " " + measurement.unit + " · " + (measurement.confidence ?? "confidence not supplied") + " confidence",
      clinicalContext: needsReview
        ? rule.context + ". This value crosses the configured review threshold and should be confirmed with an appropriate clinical instrument."
        : rule.context + ". Approximate device measurement; confirm before clinical decisions.",
      severity: needsReview ? "review" as const : "information" as const,
    }];
  });
}

export const measurementAccuracyNotice = rules.accuracyNotice;
export const supportedMeasurementNames = Object.keys(supported);
export const supportedMeasurementDefinitions = Object.entries(supported).map(([name, rule]) => ({name, ...rule}));

export function createManualMeasurements(values: Record<string, string>, method: string): BodyMeasurement[] {
  return Object.entries(values).flatMap(([name, raw]) => {
    const rule = supported[name];
    if (!rule || !raw.trim()) return [];
    const value = Number(raw);
    const maximum = rule.unit === "degree" ? 180 : rule.unit === "cm" ? 300 : 1000;
    if (!Number.isFinite(value) || value <= 0 || value > maximum) {
      throw new Error(`${rule.label} must be greater than 0 and no more than ${maximum} ${rule.unit}.`);
    }
    return [{
      name,
      value,
      unit: rule.unit as BodyMeasurement["unit"],
      confidence: "unknown" as const,
      method,
      capturedAt: new Date().toISOString(),
      source: "manual" as const,
    }];
  });
}
