import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApproximateCandidate = {rxcui?: string; score?: string};

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const headers = {"Cache-Control": "no-store, max-age=0"};
  if (query.length < 2 || query.length > 120) {
    return NextResponse.json({error: "Enter a medication name of 2-120 characters."}, {status: 400, headers});
  }

  try {
    const url = new URL("https://rxnav.nlm.nih.gov/REST/approximateTerm.json");
    url.searchParams.set("term", query);
    url.searchParams.set("maxEntries", "8");
    const response = await fetch(url, {signal: AbortSignal.timeout(8000), cache: "no-store"});
    if (!response.ok) throw new Error("RxNorm approximate search unavailable");
    const data = await response.json();
    const raw = (data?.approximateGroup?.candidate ?? []) as ApproximateCandidate[];
    const unique = Array.from(new Map(raw.filter((item) => item.rxcui).map((item) => [item.rxcui, item])).values()).slice(0, 8);

    const candidates = (await Promise.all(unique.map(async (item) => {
      const propertiesResponse = await fetch(
        "https://rxnav.nlm.nih.gov/REST/rxcui/" + encodeURIComponent(String(item.rxcui)) + "/properties.json",
        {signal: AbortSignal.timeout(6000), cache: "no-store"}
      );
      if (!propertiesResponse.ok) return null;
      const properties = (await propertiesResponse.json())?.properties;
      const name = String(properties?.name ?? "").trim();
      if (!name) return null;
      return {
        rxcui: String(item.rxcui),
        name,
        synonym: properties?.synonym || undefined,
        termType: properties?.tty || undefined,
        score: Number(item.score ?? 0),
        source: "RxNorm",
        rxNormUrl: "https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=" + encodeURIComponent(String(item.rxcui)),
        officialLabelSearchUrl: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=" + encodeURIComponent(name),
      };
    }))).filter(Boolean);

    return NextResponse.json({
      query,
      candidates,
      notice: candidates.length
        ? "Medication names are normalized through RxNorm. Review current DailyMed labeling and consult a pharmacist for patient-specific interactions."
        : "RxNorm returned no resolved medication concept. No alternative name was fabricated.",
    }, {headers});
  } catch {
    return NextResponse.json({error: "The official RxNorm medication terminology service did not respond."}, {status: 503, headers});
  }
}
