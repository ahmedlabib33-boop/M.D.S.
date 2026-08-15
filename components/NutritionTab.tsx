"use client";

import { FormEvent, useState, type Dispatch, type SetStateAction } from "react";
import type { PatientContext } from "@/lib/types";

type Food = {fdcId: number; description: string; dataType?: string; brandOwner?: string; publicationDate?: string; sourceUrl: string};

export default function NutritionTab({context, setContext}: {
  context: PatientContext;
  setContext: Dispatch<SetStateAction<PatientContext>>;
}) {
  const [foodQuery, setFoodQuery] = useState("");
  const [foods, setFoods] = useState<Food[]>([]);
  const [searchState, setSearchState] = useState<"idle"|"loading"|"error">("idle");

  const update = (key: string, value: unknown) =>
    setContext((current) => ({...current, dietary: {...current.dietary, [key]: value}}));

  async function searchFoods(event: FormEvent) {
    event.preventDefault();
    if (foodQuery.trim().length < 2) return;
    setSearchState("loading");
    try {
      const response = await fetch("/api/food?q=" + encodeURIComponent(foodQuery));
      const data = await response.json();
      if (!response.ok) throw new Error();
      setFoods(data.foods ?? []);
      setSearchState("idle");
    } catch {
      setSearchState("error");
      setFoods([]);
    }
  }

  return (
    <section className="workspacePanel panel">
      <div className="panelHeader">
        <div><span className="sectionLabel">Source-labelled education</span><h2>Condition-aware nutrition</h2></div>
        <span className="sourceBadge">DGA · NIH ODS · USDA FDC</span>
      </div>
      <div className="nutritionWorkbench">
        <div className="nutritionForm">
          <p className="cautionText">This module supplies food-pattern education. It does not prescribe a therapeutic diet, infer deficiency, or recommend supplement doses.</p>
          <div className="fieldGrid two">
            <label>Dietary pattern<input value={context.dietary?.pattern ?? ""} onChange={(e) => update("pattern", e.target.value)} placeholder="Mediterranean, vegetarian, unrestricted…" /></label>
            <label>Preferences<input value={context.dietary?.preferences ?? ""} onChange={(e) => update("preferences", e.target.value)} placeholder="Cultural and food preferences" /></label>
            <label>Intolerances<input value={context.dietary?.intolerances ?? ""} onChange={(e) => update("intolerances", e.target.value)} /></label>
            <label>Activity<select value={context.dietary?.activity ?? "unknown"} onChange={(e) => update("activity", e.target.value)}><option value="unknown">Unknown</option><option value="sedentary">Sedentary</option><option value="light">Light</option><option value="moderate">Moderate</option><option value="high">High</option></select></label>
            <label>Goal<select value={context.dietary?.goal ?? "general_health"} onChange={(e) => update("goal", e.target.value)}><option value="general_health">General health</option><option value="weight_support">Weight support</option><option value="symptom_support">Symptom support</option></select></label>
            <label>Lactating<select value={context.dietary?.lactating == null ? "unknown" : context.dietary.lactating ? "yes" : "no"} onChange={(e) => update("lactating", e.target.value === "unknown" ? null : e.target.value === "yes")}><option value="unknown">Unknown / N/A</option><option value="yes">Yes</option><option value="no">No</option></select></label>
          </div>
          <label className="checkLine"><input type="checkbox" checked={Boolean(context.dietary?.unintendedWeightLoss)} onChange={(e) => update("unintendedWeightLoss", e.target.checked)} /><span>Unintended weight loss</span></label>
          <label className="checkLine"><input type="checkbox" checked={Boolean(context.dietary?.eatingDisorderConcern)} onChange={(e) => update("eatingDisorderConcern", e.target.checked)} /><span>Eating-disorder concern</span></label>
          <p className="sourceNote">These fields are included with the next evidence analysis and cleared when this browser session ends.</p>
        </div>

        <div className="foodLookup">
          <span className="sectionLabel">Live official data</span>
          <h3>USDA FoodData Central search</h3>
          <form className="searchBar" onSubmit={searchFoods}><input value={foodQuery} onChange={(e) => setFoodQuery(e.target.value)} placeholder="Search an actual food…" /><button className="primaryButton" disabled={searchState === "loading"}>{searchState === "loading" ? "Searching…" : "Search USDA"}</button></form>
          {searchState === "error" && <p className="errorText">USDA did not respond. No replacement nutrient values were fabricated.</p>}
          <div className="foodResults">{foods.map((food) => <article key={food.fdcId}><strong>{food.description}</strong><span>{food.dataType}{food.brandOwner ? " · " + food.brandOwner : ""}</span><a href={food.sourceUrl} target="_blank" rel="noreferrer">Open USDA record ↗</a></article>)}</div>
        </div>
      </div>
    </section>
  );
}
