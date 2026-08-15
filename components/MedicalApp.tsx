"use client";

import { useState, type FormEvent } from "react";
import type { AnalysisResponse, PatientContext } from "@/lib/types";
import { Icon, type IconName } from "./Icon";
import BrandSignature from "./BrandSignature";
import AssessmentTab from "./AssessmentTab";
import KnowledgeTab from "./KnowledgeTab";
import NutritionTab from "./NutritionTab";
import MeasurementsTab from "./MeasurementsTab";
import SourcesTab from "./SourcesTab";
import SessionTab from "./SessionTab";

type Tab = "assessment" | "symptoms" | "knowledge" | "nutrition" | "ent" | "session" | "measurements" | "sources";
const tabs: Array<{id: Tab; label: string; sub: string; icon: IconName}> = [
  {id: "assessment", label: "Assessment", sub: "Evidence pipeline", icon: "assessment"},
  {id: "symptoms", label: "Symptom Explorer", sub: "Whole-body HPO", icon: "symptoms"},
  {id: "knowledge", label: "Medical Knowledge", sub: "Verified sources", icon: "knowledge"},
  {id: "nutrition", label: "Nutrition", sub: "Condition-aware", icon: "nutrition"},
  {id: "ent", label: "ENT Specialist", sub: "17 conditions", icon: "ent"},
  {id: "session", label: "Current Session", sub: "Not persisted", icon: "session"},
  {id: "measurements", label: "LiDAR Measurements", sub: "iPhone import", icon: "measurements"},
  {id: "sources", label: "Sources & Downloads", sub: "Full attribution", icon: "sources"},
];

const initialContext: PatientContext = {
  symptoms: "",
  sex: "unknown",
  pregnant: null,
  structuredSymptoms: [],
  measurements: [],
  vitals: {},
  dietary: {
    activity: "unknown",
    goal: "general_health",
    lactating: null,
    eatingDisorderConcern: false,
    unintendedWeightLoss: false,
  },
  outputRegister: "clinicalEnglish",
};

export default function MedicalApp() {
  const [tab, setTab] = useState<Tab>("assessment");
  const [context, setContext] = useState<PatientContext>(initialContext);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [history, setHistory] = useState<AnalysisResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(context),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed safely.");
      setResult(data);
      setHistory((items) => [...items, data]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Analysis failed safely.");
    } finally {
      setLoading(false);
    }
  }

  function clearSession() {
    setContext(initialContext);
    setResult(null);
    setHistory([]);
    setError("");
  }

  return (
    <main className="appShell">
      <aside className="sideRail">
        <div className="brandMark">
          <span className="brandMonogram">AL</span>
          <div><small>Medical intelligence</small><strong>Command Center</strong></div>
        </div>
        <nav aria-label="Medical workspace">
          {tabs.map((item) => (
            <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
              <Icon name={item.icon} /><span><b>{item.label}</b><small>{item.sub}</small></span>
            </button>
          ))}
        </nav>
        <div className="railTelemetry">
          <span><i className="statusDot green"/>Safety rules active</span>
          <span><i className="statusDot cyan"/>Session memory only</span>
          <span><i className="statusDot gold"/>{history.length} completed analysis{history.length === 1 ? "" : "es"}</span>
        </div>
      </aside>

      <div className="mainStage">
        <header className="topBar">
          <div>
            <span className="eyebrow">Whole-body bilingual clinical decision support</span>
            <h1>Medical Intelligence <em>Control Surface</em></h1>
            <p>Structured symptom capture, deterministic safety routing, ontology-grounded retrieval, specialist references, and source-labelled nutrition education.</p>
          </div>
          <div className="headerSignature">
            <span>Developed &amp; Created | Eng.</span><strong>Ahmed Labib</strong>
          </div>
        </header>

        <section className="emergencyBanner">
          <strong>Emergency notice</strong>
          <span>Severe breathing difficulty, stroke-like symptoms, uncontrolled bleeding, loss of consciousness, severe chest pain, or imminent self-harm requires emergency care—not this software.</span>
        </section>

        <div className="mobileTabs" role="navigation" aria-label="Workspace tabs">
          {tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><Icon name={item.icon}/><span>{item.label}</span></button>)}
        </div>

        <section className="workspace" data-tab={tab}>
          {tab === "assessment" && <AssessmentTab context={context} setContext={setContext} result={result} loading={loading} error={error} onSubmit={submit} />}
          {tab === "symptoms" && <KnowledgeTab mode="symptoms" />}
          {tab === "knowledge" && <KnowledgeTab mode="knowledge" />}
          {tab === "ent" && <KnowledgeTab mode="ent" />}
          {tab === "nutrition" && <NutritionTab context={context} setContext={setContext} />}
          {tab === "measurements" && <MeasurementsTab context={context} setContext={setContext} />}
          {tab === "session" && <SessionTab context={context} history={history} onClear={clearSession} />}
          {tab === "sources" && <SourcesTab />}
        </section>

        <footer><BrandSignature /></footer>
      </div>
    </main>
  );
}
