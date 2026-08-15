import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzePatientContext } from "@/lib/analyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VitalSchema = z.object({
  temperatureC: z.number().min(25).max(45).optional(),
  heartRate: z.number().int().min(20).max(300).optional(),
  systolicBp: z.number().int().min(40).max(300).optional(),
  diastolicBp: z.number().int().min(20).max(200).optional(),
  respiratoryRate: z.number().int().min(4).max(80).optional(),
  spo2: z.number().min(40).max(100).optional(),
  painScore: z.number().min(0).max(10).optional(),
  weightKg: z.number().positive().max(500).optional(),
  heightCm: z.number().positive().max(260).optional(),
}).optional();

const MeasurementSchema = z.object({
  name: z.string().min(1).max(100),
  value: z.number().positive().max(10000),
  unit: z.enum(["cm", "mm", "degree", "percent", "unknown"]),
  confidence: z.enum(["high", "medium", "low", "unknown"]).optional(),
  method: z.string().max(300).optional(),
  capturedAt: z.string().max(100).optional(),
  source: z.enum(["iphone_lidar", "manual", "imported"]).optional(),
});

const DietarySchema = z.object({
  pattern: z.string().max(500).optional(),
  preferences: z.string().max(1000).optional(),
  intolerances: z.string().max(1000).optional(),
  activity: z.enum(["sedentary", "light", "moderate", "high", "unknown"]).optional(),
  goal: z.enum(["general_health", "weight_support", "symptom_support", "unknown"]).optional(),
  lactating: z.boolean().nullable().optional(),
  eatingDisorderConcern: z.boolean().optional(),
  unintendedWeightLoss: z.boolean().optional(),
}).optional();

const Schema = z.object({
  age: z.number().min(0).max(125).optional(),
  sex: z.enum(["female", "male"]).optional(),
  pregnant: z.boolean().nullable().optional(),
  duration: z.string().max(200).optional(),
  symptoms: z.string().min(2).max(6000),
  knownConditions: z.string().max(2000).optional(),
  medications: z.string().max(2000).optional(),
  allergies: z.string().max(1000).optional(),
  structuredSymptoms: z.array(z.string().min(1).max(200)).max(80).optional(),
  vitals: VitalSchema,
  measurements: z.array(MeasurementSchema).max(100).optional(),
  dietary: DietarySchema,
  outputRegister: z.enum(["clinicalEnglish", "plainEnglish", "medicalArabic", "plainArabic"]).optional(),
});

export async function POST(req: Request) {
  try {
    const body = Schema.parse(await req.json());
    const result = await analyzePatientContext(body);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {
    const invalid = Boolean(error && typeof error === "object" && "issues" in error);
    return NextResponse.json(
      {error: invalid ? "Invalid request. Review the submitted fields." : "Analysis failed safely; no result was inferred."},
      {status: invalid ? 400 : 500}
    );
  }
}
