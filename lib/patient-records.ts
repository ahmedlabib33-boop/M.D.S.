import type { PatientContext, PatientRecord, PatientVaultBackup, Sex } from "./types";

export const patientVaultStorageNotice =
  "Records are stored in IndexedDB on this browser and device. They are not committed to Git, uploaded to the repository, or synchronized between devices.";

export function cleanPatientName(value: string): string {
  const name = value.replace(/\s+/g, " ").trim();
  if (name.length < 2) throw new Error("Patient name must contain at least 2 characters.");
  if (name.length > 100) throw new Error("Patient name must not exceed 100 characters.");
  return name;
}

export function createEmptyPatientContext(sex?: Sex): PatientContext {
  return {
    symptoms: "",
    sex,
    pregnant: null,
    structuredSymptoms: [],
    measurements: [],
    vitals: {},
    dietary: {
      activity: "unknown",
      goal: "general_health",
      lactating: null,
      eatingDisorderConcern: false,
      unintendedWeightLoss: false,
    },
    outputRegister: "clinicalEnglish",
  };
}

export function createPatientRecord(args: {id: string; name: string; sex: Sex; now?: string}): PatientRecord {
  if (args.sex !== "male" && args.sex !== "female") throw new Error("Sex must be Male or Female.");
  const now = args.now ?? new Date().toISOString();
  return {
    schemaVersion: 1,
    id: args.id,
    name: cleanPatientName(args.name),
    sex: args.sex,
    createdAt: now,
    updatedAt: now,
    context: createEmptyPatientContext(args.sex),
    assessments: [],
  };
}

export function patientVaultBackup(records: PatientRecord[], now = new Date().toISOString()): PatientVaultBackup {
  return {
    schemaVersion: 1,
    exportedAt: now,
    creator: "Developed & Created | Eng. Ahmed Labib",
    storageNotice: patientVaultStorageNotice,
    patients: records,
  };
}
