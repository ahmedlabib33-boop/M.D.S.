"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AnalysisResponse, PatientContext, PatientRecord, Sex } from "@/lib/types";
import { createEmptyPatientContext, createPatientRecord, patientVaultBackup } from "@/lib/patient-records";
import { deletePatientRecord, listPatientRecords, savePatientRecord } from "@/lib/patient-vault";
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
  {id: "session", label: "Patient Records", sub: "Saved on device", icon: "session"},
  {id: "measurements", label: "Measurements", sub: "Guided + iPhone", icon: "measurements"},
  {id: "sources", label: "Sources", sub: "Medical attribution", icon: "sources"},
];

export default function MedicalApp() {
  const [tab, setTab] = useState<Tab>("assessment");
  const [context, setContext] = useState<PatientContext>(() => createEmptyPatientContext());
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [history, setHistory] = useState<AnalysisResponse[]>([]);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [vaultReady, setVaultReady] = useState(false);
  const [vaultStatus, setVaultStatus] = useState("Opening device vault…");
  const patientsRef = useRef<PatientRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { patientsRef.current = patients; }, [patients]);

  useEffect(() => {
    let cancelled = false;
    listPatientRecords()
      .then((records) => {
        if (cancelled) return;
        setPatients(records);
        if (records[0]) {
          setActivePatientId(records[0].id);
          setContext(records[0].context);
          setHistory(records[0].assessments);
          setResult(records[0].assessments.at(-1) ?? null);
          setVaultStatus("Patient vault ready");
        } else {
          setTab("session");
          setVaultStatus("Create the first patient record");
        }
        setVaultReady(true);
      })
      .catch((reason) => {
        if (cancelled) return;
        setVaultReady(true);
        setVaultStatus(reason instanceof Error ? reason.message : "Device storage is unavailable.");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!vaultReady || !activePatientId) return;
    const timer = window.setTimeout(() => {
      const active = patientsRef.current.find((patient) => patient.id === activePatientId);
      if (!active) return;
      const updated: PatientRecord = {
        ...active,
        sex: context.sex ?? active.sex,
        context: {...context, sex: context.sex ?? active.sex},
        assessments: history,
        updatedAt: new Date().toISOString(),
      };
      savePatientRecord(updated)
        .then(() => {
          setPatients((items) => items.map((item) => item.id === updated.id ? updated : item));
          setVaultStatus("Saved on this device");
        })
        .catch((reason) => setVaultStatus(reason instanceof Error ? reason.message : "Patient record could not be saved."));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [activePatientId, context, history, vaultReady]);

  const activePatient = patients.find((patient) => patient.id === activePatientId) ?? null;

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
    setContext(createEmptyPatientContext(activePatient?.sex));
    setResult(null);
    setHistory([]);
    setError("");
  }

  async function createPatient(name: string, sex: Sex) {
    const record = createPatientRecord({id: crypto.randomUUID(), name, sex});
    await savePatientRecord(record);
    setPatients((items) => [record, ...items]);
    setActivePatientId(record.id);
    setContext(record.context);
    setHistory([]);
    setResult(null);
    setError("");
    setVaultStatus("Saved on this device");
    setTab("assessment");
  }

  function openPatient(id: string) {
    const patient = patientsRef.current.find((item) => item.id === id);
    if (!patient) return;
    setActivePatientId(patient.id);
    setContext(patient.context);
    setHistory(patient.assessments);
    setResult(patient.assessments.at(-1) ?? null);
    setError("");
    setTab("assessment");
  }

  async function removePatient(id: string) {
    await deletePatientRecord(id);
    const remaining = patientsRef.current.filter((patient) => patient.id !== id);
    setPatients(remaining);
    if (activePatientId === id) {
      const next = remaining[0];
      setActivePatientId(next?.id ?? null);
      setContext(next?.context ?? createEmptyPatientContext());
      setHistory(next?.assessments ?? []);
      setResult(next?.assessments.at(-1) ?? null);
    }
    setVaultStatus(remaining.length ? "Saved on this device" : "Create the first patient record");
  }

  function exportAllPatients() {
    const blob = new Blob([JSON.stringify(patientVaultBackup(patients), null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `medical-patient-vault-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="appShell">
      <aside className="sideRail">
        <div className="brandMark"><span className="brandMonogram">AL</span><div><small>Medical intelligence</small><strong>Command Center</strong></div></div>
        <nav aria-label="Medical workspace">{tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><Icon name={item.icon} /><span><b>{item.label}</b><small>{item.sub}</small></span></button>)}</nav>
        <div className="railTelemetry">
          <span><i className="statusDot green"/>Safety rules active</span>
          <span><i className="statusDot cyan"/>{activePatient ? "Device patient vault" : "Temporary unsaved case"}</span>
          <span><i className="statusDot gold"/>{history.length} completed {history.length === 1 ? "analysis" : "analyses"}</span>
        </div>
      </aside>

      <div className="mainStage">
        <header className="topBar">
          <div><span className="eyebrow">Whole-body bilingual clinical decision support</span><h1>Medical Intelligence <em>Control Surface</em></h1><p>Structured symptom capture, deterministic safety routing, ontology-grounded retrieval, specialist references, and source-labelled nutrition education.</p></div>
          <div className="headerSignature"><span>Developed &amp; Created | Eng.</span><strong>Ahmed Labib</strong></div>
        </header>

        <section className="patientControl" aria-label="Active patient record">
          <div><span className="sectionLabel">Active patient</span><strong>{activePatient?.name ?? "No saved patient selected"}</strong><small>{activePatient ? `${context.sex === "female" ? "Female" : "Male"} · ${vaultStatus}` : vaultStatus}</small></div>
          <div className="patientControlActions">
            {patients.length > 0 && <select aria-label="Switch patient" value={activePatientId ?? ""} onChange={(event) => openPatient(event.target.value)}>{patients.map((patient) => <option value={patient.id} key={patient.id}>{patient.name}</option>)}</select>}
            <button className="secondaryButton" onClick={() => setTab("session")}>Manage patients</button>
          </div>
        </section>

        <section className="emergencyBanner"><strong>Emergency notice</strong><span>Severe breathing difficulty, stroke-like symptoms, uncontrolled bleeding, loss of consciousness, severe chest pain, or imminent self-harm requires emergency care—not this software.</span></section>
        <div className="mobileTabs" role="navigation" aria-label="Workspace tabs">{tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><Icon name={item.icon}/><span>{item.label}</span></button>)}</div>

        <section className="workspace" data-tab={tab}>
          {tab === "assessment" && <AssessmentTab context={context} setContext={setContext} result={result} loading={loading} error={error} onSubmit={submit} patientName={activePatient?.name} persisted={Boolean(activePatient)} />}
          {tab === "symptoms" && <KnowledgeTab mode="symptoms" />}
          {tab === "knowledge" && <KnowledgeTab mode="knowledge" />}
          {tab === "ent" && <KnowledgeTab mode="ent" />}
          {tab === "nutrition" && <NutritionTab context={context} setContext={setContext} />}
          {tab === "measurements" && <MeasurementsTab context={context} setContext={setContext} />}
          {tab === "session" && <SessionTab patients={patients} activePatientId={activePatientId} vaultStatus={vaultStatus} onCreate={createPatient} onOpen={openPatient} onDelete={removePatient} onResetActive={clearSession} onExportAll={exportAllPatients} />}
          {tab === "sources" && <SourcesTab />}
        </section>

        <footer><BrandSignature /></footer>
      </div>
    </main>
  );
}
