import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < 2 || query.length > 120) {
    return NextResponse.json({error: "Enter a food name of 2-120 characters."}, {status: 400});
  }

  const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
  try {
    const response = await fetch("https://api.nal.usda.gov/fdc/v1/foods/search?api_key=" + encodeURIComponent(apiKey), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({query, pageSize: 10}),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("FoodData Central unavailable");
    const data = await response.json();
    const foods = (data.foods ?? []).map((food: Record<string, unknown>) => ({
      fdcId: food.fdcId,
      description: food.description,
      dataType: food.dataType,
      brandOwner: food.brandOwner,
      publicationDate: food.publicationDate,
      sourceUrl: "https://fdc.nal.usda.gov/fdc-app.html#/food-details/" + food.fdcId + "/nutrients",
    }));
    return NextResponse.json({
      query,
      foods,
      source: "USDA FoodData Central",
      quota: apiKey === "DEMO_KEY" ? "Public DEMO_KEY quota; configure USDA_API_KEY for reliable use." : "Configured USDA API key.",
    }, {headers: {"Cache-Control": "no-store"}});
  } catch {
    return NextResponse.json({error: "USDA FoodData Central did not respond. No substitute nutrient data was fabricated."}, {status: 503});
  }
}
