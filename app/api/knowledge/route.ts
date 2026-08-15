import { NextRequest, NextResponse } from "next/server";
import { entConditions } from "@/lib/ent";
import { rankHpoLexically } from "@/lib/hpo";
import { sourceRegistry } from "@/lib/sources";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const id = (req.nextUrl.searchParams.get("id") ?? "").trim();
  const kind = req.nextUrl.searchParams.get("kind") ?? "all";
  const conditions = entConditions();

  if (id) {
    const condition = conditions.find((item) => item.id === id);
    return condition
      ? NextResponse.json({condition}, {headers: {"Cache-Control": "public, max-age=3600"}})
      : NextResponse.json({error: "Condition not found"}, {status: 404});
  }

  const ent = kind === "hpo" ? [] : conditions.filter((condition) => {
    if (!query) return true;
    return JSON.stringify(condition).toLowerCase().includes(query.toLowerCase());
  }).slice(0, 30).map((condition) => ({
    id: condition.id,
    name: condition.name,
    category: condition.category,
    definition: condition.definition,
  }));

  const hpo = kind === "ent" || !query ? [] : rankHpoLexically(query, 20);
  return NextResponse.json(
    {query, ent, hpo, sources: sourceRegistry()},
    {headers: {"Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff"}}
  );
}
