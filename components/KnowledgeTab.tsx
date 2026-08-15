"use client";

import { FormEvent, useState } from "react";
import MedicationLookup from "./MedicationLookup";

type Mode = "symptoms" | "knowledge" | "ent";
type EntSummary = {id: string; name: string; category?: string; definition?: string};
type HpoResult = {id: string; label: string; definition?: string; synonyms?: string[]; arabic?: string; score: number};
type Detail = Record<string, unknown>;

const systems = [
  ["Neurological", "neurological symptom weakness seizure headache"],
  ["Psychiatric", "psychiatric behavioral mood sleep symptom"],
  ["ENT", "ear nose throat voice hearing symptom"],
  ["Ophthalmic", "eye vision ocular symptom"],
  ["Respiratory", "breathing cough respiratory symptom"],
  ["Cardiovascular", "cardiac chest circulation symptom"],
  ["Gastrointestinal", "abdominal digestive bowel symptom"],
  ["Renal / urinary", "kidney urinary symptom"],
  ["Reproductive", "reproductive gynecologic symptom"],
  ["Endocrine", "hormonal endocrine metabolic symptom"],
  ["Hematological", "blood bleeding anemia symptom"],
  ["Immune / allergy", "immune allergy inflammatory symptom"],
  ["Dermatological", "skin hair nail symptom"],
  ["Musculoskeletal", "joint muscle bone symptom"],
  ["Constitutional", "fever fatigue weight constitutional symptom"],
  ["Pediatric", "developmental pediatric symptom"],
];

export default function KnowledgeTab({mode}: {mode: Mode}) {
  const [query, setQuery] = useState("");
  const [ent, setEnt] = useState<EntSummary[]>([]);
  const [hpo, setHpo] = useState<HpoResult[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const kind = mode === "ent" ? "ent" : mode === "symptoms" ? "hpo" : "all";
  async function search(value = query) {
    if (value.trim().length < 2 && mode !== "ent") return;
    setState("loading");
    setDetail(null);
    try {
      const response = await fetch("/api/knowledge?q=" + encodeURIComponent(value) + "&kind=" + kind);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed");
      setEnt(data.ent ?? []);
      setHpo(data.hpo ?? []);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  async function openEnt(id: string) {
    setState("loading");
    try {
      const response = await fetch("/api/knowledge?id=" + encodeURIComponent(id));
      const data = await response.json();
      if (!response.ok) throw new Error();
      setDetail(data.condition);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void search();
  }

  const title = mode === "symptoms" ? "Whole-body symptom explorer" : mode === "ent" ? "ENT specialist library" : "Medical knowledge retrieval";
  return (
    <section className="workspacePanel panel">
      <div className="panelHeader">
        <div><span className="sectionLabel">Search verified knowledge</span><h2>{title}</h2></div>
        <span className="sourceBadge">{mode === "ent" ? "17 detailed ENT references" : "HPO + ENT"}</span>
      </div>

      {mode === "knowledge" && <MedicationLookup />}

      {mode === "symptoms" && (
        <div className="systemGrid">
          {systems.map(([label, seed]) => (
            <button key={label} onClick={() => {setQuery(seed); void search(seed);}}><span>{label}</span><small>Explore terminology →</small></button>
          ))}
        </div>
      )}

      <form className="searchBar" onSubmit={submit}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mode === "ent" ? "Search ENT conditions, symptoms, management…" : "Search a symptom or clinical phrase in English or Arabic…"} />
        <button className="primaryButton" disabled={state === "loading"}>{state === "loading" ? "Searching…" : "Search"}</button>
      </form>
      {state === "error" && <p className="errorText">The knowledge search could not complete.</p>}

      {detail && (
        <article className="conditionDetail">
          <button className="textButton" onClick={() => setDetail(null)}>← Back to results</button>
          <h3>{String(detail.name ?? "")}</h3>
          <span className="dataChip">{String(detail.category ?? "")}</span>
          {Object.entries(detail).filter(([key]) => !["id", "name", "category"].includes(key)).map(([key, value]) => (
            <section key={key}><h4>{key.replaceAll("_", " ")}</h4><pre>{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre></section>
          ))}
        </article>
      )}

      {!detail && (
        <div className="knowledgeResults">
          {hpo.length > 0 && <section><h3>HPO phenotype terminology</h3>{hpo.map((item) => <article className="knowledgeCard" key={item.id}><div><strong>{item.label}</strong><code>{item.id}</code></div>{item.arabic && <p dir="rtl">{item.arabic}</p>}{item.definition && <p>{item.definition}</p>}<small>Retrieval score {item.score.toFixed(3)} · not a diagnosis</small></article>)}</section>}
          {ent.length > 0 && <section><h3>ENT knowledge</h3>{ent.map((item) => <button className="knowledgeCard clickable" key={item.id} onClick={() => void openEnt(item.id)}><div><strong>{item.name}</strong><span>{item.category}</span></div><p>{item.definition}</p><small>Open complete structured reference →</small></button>)}</section>}
          {state === "idle" && query && hpo.length === 0 && ent.length === 0 && <p className="emptyInline">No matching indexed term was found. No alternative result was fabricated.</p>}
        </div>
      )}
    </section>
  );
}
