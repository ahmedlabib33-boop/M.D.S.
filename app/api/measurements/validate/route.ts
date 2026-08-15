import { NextRequest, NextResponse } from "next/server";
import { measurementInsights, parseMeasurementImport } from "@/lib/measurements";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > 1_000_000) return NextResponse.json({error: "Payload exceeds 1 MB."}, {status: 413});
    const parsed = parseMeasurementImport(await req.json());
    return NextResponse.json({
      valid: true,
      normalized: parsed,
      insights: measurementInsights(parsed.measurements),
      persistence: "none",
    }, {headers: {"Cache-Control": "no-store"}});
  } catch (error: unknown) {
    return NextResponse.json({
      valid: false,
      error: error instanceof Error ? error.message : "Invalid measurement payload.",
    }, {status: 400, headers: {"Cache-Control": "no-store"}});
  }
}
