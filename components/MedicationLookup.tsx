"use client";

import { FormEvent, useState } from "react";

type Candidate = {
  rxcui: string; name: string; synonym?: string; termType?: string; score: number;
  rxNormUrl: string; officialLabelSearchUrl: string;
};

export default function MedicationLookup() {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [notice, setNotice] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setState("loading"); setNotice(""); setCandidates([]);
    try {
      const response = await fetch("/api/medications?q=" + encodeURIComponent(query), {cache: "no-store"});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "RxNorm unavailable");
      setCandidates(data.candidates ?? []); setNotice(data.notice ?? ""); setState("idle");
    } catch (error) {
      setState("error");
      setNotice(error instanceof Error ? error.message : "RxNorm unavailable");
    }
  }

  return (
    <details className="medicationLookup">
      <summary>Medication terminology and official labeling</summary>
      <p className="cautionText">This tool normalizes a typed name; it does not recommend a drug, dose, or interaction. Patient-specific decisions require the prescriber or pharmacist.</p>
      <form className="searchBar" onSubmit={submit}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter a generic or brand medication name…" />
        <button className="primaryButton" disabled={state === "loading" || query.trim().length < 2}>{state === "loading" ? "Checking…" : "Search RxNorm"}</button>
      </form>
      {notice && <p className={state === "error" ? "errorText" : "sourceNote"}>{notice}</p>}
      <div className="medicationResults">
        {candidates.map((item) => (
          <article key={item.rxcui}>
            <div><strong>{item.name}</strong><code>RxCUI {item.rxcui}</code></div>
            {item.synonym && <p>{item.synonym}</p>}
            <small>{item.termType || "RxNorm concept"} · lexical match score {item.score.toFixed(1)}</small>
            <nav><a href={item.rxNormUrl} target="_blank" rel="noreferrer">Open RxNorm ↗</a><a href={item.officialLabelSearchUrl} target="_blank" rel="noreferrer">Search DailyMed labeling ↗</a></nav>
          </article>
        ))}
      </div>
    </details>
  );
}
