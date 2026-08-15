import { NextResponse } from "next/server";
import { diseaseMapAvailable, hpoIsFull } from "@/lib/hpo";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    hpoFull: hpoIsFull(),
    hpoDiseaseMap: diseaseMapAvailable(),
    hfEmbeddingsConfigured: Boolean(process.env.HF_TOKEN),
    aiGatewayConfigured: Boolean(process.env.AI_GATEWAY_API_KEY),
    aiVisionModelConfigured: Boolean(process.env.AI_GATEWAY_API_KEY && process.env.AI_VISION_MODEL),
    timestamp: new Date().toISOString(),
  });
}
