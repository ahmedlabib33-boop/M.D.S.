"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { AnalysisResponse, PatientContext } from "@/lib/types";
import AnalysisPanel from "./AnalysisPanel";
import ClinicalPhotoCapture from "./ClinicalPhotoCapture";

type Props = {
  context: PatientContext;
  setContext: Dispatch<SetStateAction<PatientContext>>;
  result: AnalysisResponse | null;
  loading: boolean;
  error: string;
  onSubmit: (event: FormEvent) => void;
};

export default function AssessmentTab({context, setContext, result, loading, error, onSubmit}: Props) {
  const update = <K extends keyof PatientContext>(key: K, value: PatientContext[K]) =>
    setContext((current) => ({...current, [key]: value}));

  const updateVital = (key: string, raw: string) => {
    const value = raw === "" ? undefined : Number(raw);
    setContext((current) => ({...current, vitals: {...current.vitals, [key]: value}}));
  };

  return (
    <div className="assessmentLayout">
      <form className="inputPanel panel" onSubmit={onSubmit}>
        <div className="panelHeader">
          <div><span className="sectionLabel">Patient context</span><h2>Clinical intake</h2></div>
          <span className="liveBadge">Session only</span>
        </div>

        <label>
          Symptoms / الأعراض
          <textarea value={context.symptoms} onChange={(event) => update("symptoms", event.target.value)}
            placeholder="Describe symptoms, including what is absent, in English or Arabic…" required />
        </label>

        <div className="fieldGrid three">
          <label>Age<input type="number" min="0" max="125" value={context.age ?? ""} onChange={(event) => update("age", event.target.value ? Number(event.target.value) : undefined)} /></label>
          <label>Sex<select value={context.sex ?? "unknown"} onChange={(event) => update("sex", event.target.value as PatientContext["sex"])}><option value="unknown">Unknown</option><option value="female">Female</option><option value="male">Male</option><option value="intersex">Intersex</option></select></label>
          <label>Pregnancy<select value={context.pregnant == null ? "unknown" : context.pregnant ? "yes" : "no"} onChange={(event) => update("pregnant", event.target.value === "unknown" ? null : event.target.value === "yes")}><option value="unknown">Unknown / N/A</option><option value="yes">Yes</option><option value="no">No</option></select></label>
        </div>

        <label>Onset and duration<input value={context.duration ?? ""} onChange={(event) => update("duration", event.target.value)} placeholder="Sudden, progressive, intermittent; 3 days…" /></label>
        <label>Known conditions<textarea className="compactTextarea" value={context.knownConditions ?? ""} onChange={(event) => update("knownConditions", event.target.value)} /></label>
        <label>Medications<textarea className="compactTextarea" value={context.medications ?? ""} onChange={(event) => update("medications", event.target.value)} /></label>
        <label>Allergies and severe intolerances<input value={context.allergies ?? ""} onChange={(event) => update("allergies", event.target.value)} /></label>

        <details className="formDetails">
          <summary>Optional measured vital signs</summary>
          <div className="fieldGrid three">
            <label>Temperature °C<input type="number" step="0.1" onChange={(event) => updateVital("temperatureC", event.target.value)} /></label>
            <label>Heart rate<input type="number" onChange={(event) => updateVital("heartRate", event.target.value)} /></label>
            <label>SpO₂ %<input type="number" onChange={(event) => updateVital("spo2", event.target.value)} /></label>
            <label>Systolic BP<input type="number" onChange={(event) => updateVital("systolicBp", event.target.value)} /></label>
            <label>Diastolic BP<input type="number" onChange={(event) => updateVital("diastolicBp", event.target.value)} /></label>
            <label>Pain 0–10<input type="number" min="0" max="10" onChange={(event) => updateVital("painScore", event.target.value)} /></label>
          </div>
        </details>

        <ClinicalPhotoCapture symptoms={context.symptoms} />

        <button className="primaryButton" disabled={loading || context.symptoms.trim().length < 2}>
          {loading ? "Analysis in progress…" : "Run evidence analysis"}
        </button>
        <p className="privacyNote">Submitted clinical text is not stored by this application. Configured external inference and medical-reference services may receive the minimum query required to return a result.</p>
        {error && <p className="errorText">{error}</p>}
      </form>

      <AnalysisPanel result={result} query={context.symptoms} />
    </div>
  );
}
