"use client";

import { useState } from "react";
import type { AnalysisResponse } from "@/lib/types";
import { localNeuralRank } from "@/lib/local-ml";

type Register = "clinicalEnglish" | "plainEnglish" | "medicalArabic" | "plainArabic";
const labels: Record<Register, string> = {
  clinicalEnglish: "Clinical English",
  plainEnglish: "Plain English",
  medicalArabic: "العربية الطبية",
  plainArabic: "العربية المبسطة",
};

export default function AnalysisPanel({result, query}: {result: AnalysisResponse | null; query: string}) {
  const [register, setRegister] = useState<Register>("clinicalEnglish");
  const [localMl, setLocalMl] = useState<null | {
    model: string;
    runtime: string;
    elapsedMs: number;
    ranked: Array<{id: string; score: number}>;
  }>(null);
  const [mlState, setMlState] = useState<"idle" | "loading" | "error">("idle");
  const rtl = register === "medicalArabic" || register === "plainArabic";

  async function runLocalMl() {
    if (!result) return;
    setMlState("loading");
    try {
      const documents = [
        ...result.hpoMatches.slice(0, 8).map((item) => ({id: item.id, text: [item.label, item.definition, ...(item.synonyms ?? [])].filter(Boolean).join(" ")})),
        ...result.entMatches.slice(0, 5).map((item) => ({id: item.id, text: item.name + " " + (item.category ?? "")})),
      ];
      setLocalMl(await localNeuralRank(query, documents));
      setMlState("idle");
    } catch {
      setMlState("error");
    }
  }

  if (!result) {
    return (
      <section className="resultPanel panel">
        <div className="emptyState">
          <div className="radar" aria-hidden="true"><span/><span/><span/></div>
          <p className="kicker">Awaiting clinical context</p>
          <h2>Evidence-grounded output appears here</h2>
          <p>Safety routing is evaluated first, followed by structured findings, ontology retrieval, specialist references, and source-labelled nutrition education.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="resultPanel panel" aria-live="polite">
      <div className={"safetyRoute " + result.safety.route}>
        <div><span>Safety route</span><strong>{result.safety.route.replace("_", " ")}</strong></div>
        <small>Deterministic rules evaluated before model processing</small>
      </div>

      {result.safety.flags.length > 0 && (
        <section className="alertStack">
          <h3>Safety flags / إشارات الأمان</h3>
          {result.safety.flags.map((flag) => (
            <article key={flag.id} className="alertCard">
              <strong>{flag.clinicalLabel}</strong>
              <p>{flag.plainEnglish}</p>
              <p dir="rtl">{flag.medicalArabic}</p>
            </article>
          ))}
        </section>
      )}

      <div className="registerTabs" role="tablist" aria-label="Explanation register">
        {(Object.keys(labels) as Register[]).map((item) => (
          <button key={item} role="tab" aria-selected={register === item} className={register === item ? "active" : ""} onClick={() => setRegister(item)}>
            {labels[item]}
          </button>
        ))}
      </div>

      <article className="explanationCard" dir={rtl ? "rtl" : "ltr"}>
        <span className="sectionLabel">Clinical interpretation support</span>
        <p>{result.explanation[register]}</p>
      </article>

      <div className="metricStrip">
        <div><span>Phenotypes</span><strong>{result.hpoMatches.length}</strong></div>
        <div><span>ENT references</span><strong>{result.entMatches.length}</strong></div>
        <div><span>Evidence topics</span><strong>{result.medlinePlus.length}</strong></div>
        <div><span>Total pipeline</span><strong>{result.engine.timingsMs.total} ms</strong></div>
      </div>

      <details open>
        <summary>Structured clinical findings</summary>
        <div className="chipRow">
          {result.extraction.symptoms.map((item, index) => <span className="dataChip" key={index}>{item}</span>)}
        </div>
        {result.extraction.negatedSymptoms.length > 0 && <p><strong>Explicitly negated:</strong> {result.extraction.negatedSymptoms.join(", ")}</p>}
        <dl className="dataList">
          <div><dt>Detected language</dt><dd>{result.extraction.detectedLanguage}</dd></div>
          <div><dt>Extraction path</dt><dd>{result.extraction.source === "ai_gateway" ? "Configured structured language model" : "Deterministic bilingual parser"}</dd></div>
          <div><dt>Normalized retrieval query</dt><dd>{result.extraction.normalizedEnglishQuery}</dd></div>
        </dl>
      </details>

      <details open>
        <summary>Whole-body phenotype matches — not diagnoses</summary>
        <div className="rankGrid">
          {result.hpoMatches.map((item, index) => (
            <article className="rankCard" key={item.id}>
              <div className="rankIndex">{String(index + 1).padStart(2, "0")}</div>
              <div><strong>{item.label}</strong> <code>{item.id}</code>{item.arabic && <p dir="rtl">{item.arabic}</p>}{item.definition && <small>{item.definition}</small>}</div>
              <span className="scoreValue">{item.score.toFixed(3)}</span>
            </article>
          ))}
        </div>
      </details>

      {result.diseaseCandidates.length > 0 && (
        <details>
          <summary>Phenotype-to-disease ontology references</summary>
          <p className="cautionText">Evidence-weighted ontology overlap only; these are not diagnoses or disease probabilities.</p>
          <div className="rankGrid">
            {result.diseaseCandidates.map((item) => (
              <article className="rankCard" key={item.id}>
                <div><strong>{item.name}</strong> <code>{item.id}</code><small>{item.evidenceCount} matched phenotype annotations</small></div>
                <span className="scoreValue">{item.ontologyScore.toFixed(3)}</span>
              </article>
            ))}
          </div>
        </details>
      )}

      <details open>
        <summary>ENT specialist knowledge module</summary>
        <div className="rankGrid">
          {result.entMatches.map((item) => (
            <article className="rankCard" key={item.id}>
              <div><strong>{item.name}</strong><small>{item.category}</small></div>
              <span className="scoreValue">{item.score.toFixed(3)}</span>
            </article>
          ))}
        </div>
      </details>

      <details open>
        <summary>Condition-aware nutrition education</summary>
        <div className={"nutritionState " + result.nutrition.status}>
          <strong>{result.nutrition.headline}</strong>
          {result.nutrition.cautions.map((item, index) => <p key={index}>⚠ {item}</p>)}
        </div>
        {result.nutrition.status === "available" && (
          <div className="nutritionColumns">
            <div><h4>Emphasize</h4><ul>{result.nutrition.emphasize.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div><h4>Limit</h4><ul>{result.nutrition.limit.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div><h4>Practical substitutions</h4><ul>{result.nutrition.substitutions.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </div>
        )}
        {result.nutrition.rationale.map((item) => <p className="sourceNote" key={item}>{item}</p>)}
      </details>

      {result.measurementInsights.length > 0 && (
        <details>
          <summary>Imported measurement context</summary>
          {result.measurementInsights.map((item) => (
            <article className={"measurementInsight " + item.severity} key={item.measurement}>
              <strong>{item.measurement}</strong><span>{item.summary}</span><p>{item.clinicalContext}</p>
            </article>
          ))}
        </details>
      )}

      <details>
        <summary>MedlinePlus educational references</summary>
        {result.medlinePlus.length === 0 ? <p>No live MedlinePlus topic was returned. No substitute content was invented.</p> : (
          <div className="evidenceList">
            {result.medlinePlus.map((item, index) => (
              <article key={index}><strong>{item.title}</strong>{item.summary && <p>{item.summary}</p>}{item.url && <a href={item.url} target="_blank" rel="noreferrer">Open official source ↗</a>}</article>
            ))}
          </div>
        )}
      </details>

      <details>
        <summary>Questions that improve clinical discrimination</summary>
        <ol className="questionList">{result.explanation.questionsToClarify.map((item, index) => <li key={index}>{item}</li>)}</ol>
      </details>

      <details>
        <summary>Legacy ENT research comparison</summary>
        <p className="cautionText">This preserves folder 1’s TF-IDF and knowledge-base Naive Bayes research path. It is not trained on patient encounters and is not a validated clinical classifier.</p>
        {result.legacyEntResearch.map((item) => (
          <div className="legacyRow" key={item.id}><strong>{item.name}</strong><span>TF-IDF {item.tfidfScore.toFixed(3)}</span><span>Research ensemble {item.ensembleScore.toFixed(3)}</span></div>
        ))}
      </details>

      <details>
        <summary>Execution and source provenance</summary>
        <div className="enginePanel">
          <p><strong>Models actually executed:</strong> {result.engine.models.join(", ") || "None; deterministic and lexical retrieval completed."}</p>
          <p>{result.engine.note}</p>
          <p><strong>Uncertainty:</strong> {result.explanation.uncertainty}</p>
          <div className="timingGrid">{Object.entries(result.engine.timingsMs).map(([key, value]) => <span key={key}><b>{key}</b>{value} ms</span>)}</div>
          <button className="secondaryButton" onClick={runLocalMl} disabled={mlState === "loading"}>
            {mlState === "loading" ? "Loading and running local ONNX model…" : "Run free local neural comparison"}
          </button>
          {mlState === "error" && <p className="errorText">The browser model did not run on this device; server results were not changed.</p>}
          {localMl && (
            <div className="localMlResult">
              <strong>{localMl.model}</strong><span>{localMl.runtime} · {localMl.elapsedMs} ms</span>
              {localMl.ranked.slice(0, 5).map((item) => <p key={item.id}>{item.id}<b>{item.score.toFixed(3)}</b></p>)}
            </div>
          )}
        </div>
        {result.provenance.map((item, index) => <p className="sourceRow" key={index}><strong>{item.source}</strong> — {item.detail}</p>)}
      </details>

      <p className="finalDisclaimer">{result.disclaimer}</p>
    </section>
  );
}
