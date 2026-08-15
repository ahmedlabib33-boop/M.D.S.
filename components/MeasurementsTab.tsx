"use client";

import { useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import type { PatientContext } from "@/lib/types";
import { createManualMeasurements, measurementAccuracyNotice, parseMeasurementImport, supportedMeasurementDefinitions } from "@/lib/measurements";

type MeshMeta = {name: string; size: number; type: string};

export default function MeasurementsTab({context, setContext}: {
  context: PatientContext;
  setContext: Dispatch<SetStateAction<PatientContext>>;
}) {
  const [notice, setNotice] = useState(measurementAccuracyNotice);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [method, setMethod] = useState("iPhone Measure app or manual measuring tool");
  const [meshFiles, setMeshFiles] = useState<MeshMeta[]>([]);

  function saveGuidedMeasurements() {
    setError("");
    setSavedMessage("");
    try {
      const additions = createManualMeasurements(manualValues, method);
      if (additions.length === 0) throw new Error("Enter at least one measurement.");
      setContext((current) => {
        const names = new Set(additions.map((item) => item.name));
        const retained = (current.measurements ?? []).filter((item) => !names.has(item.name));
        return {...current, measurements: [...retained, ...additions]};
      });
      setSavedMessage(`${additions.length} measurement${additions.length === 1 ? "" : "s"} saved to the active patient record.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Measurements could not be saved.");
    }
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setSavedMessage("");
    if (file.size > 1_000_000) {
      setError("The measurement file exceeds the 1 MB limit.");
      return;
    }
    try {
      const parsed = parseMeasurementImport(JSON.parse(await file.text()));
      setContext((current) => ({...current, measurements: parsed.measurements}));
      setNotice(parsed.notice);
      setSavedMessage(`${parsed.measurements.length} iPhone measurement${parsed.measurements.length === 1 ? "" : "s"} imported. No JSON editing was required.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Invalid measurement file.");
    }
    event.target.value = "";
  }

  function selectMesh(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const invalid = files.find((file) => !/\.(usdz|ply)$/i.test(file.name));
    if (invalid) {
      setError("Only USDZ and PLY mesh files are accepted.");
      return;
    }
    setMeshFiles(files.map((file) => ({name: file.name, size: file.size, type: file.name.split(".").pop()?.toUpperCase() ?? ""})));
    setError("");
  }

  return (
    <section className="workspacePanel panel">
      <div className="panelHeader">
        <div><span className="sectionLabel">Easy entry first · advanced import optional</span><h2>Body and iPhone measurements</h2></div>
        <span className="sourceBadge">Manual · Measure app · ARKit</span>
      </div>

      <div className="simpleMeasurementIntro"><strong>No JSON knowledge is needed.</strong><p>Measure only what you actually have, enter the number beside its unit, then save. For greater repeatability, keep the same posture, landmark and measuring method each time.</p></div>

      <label className="methodChoice">How were these values measured?<select value={method} onChange={(event) => setMethod(event.target.value)}><option>iPhone Measure app or manual measuring tool</option><option>Tape measure or ruler</option><option>Clinical instrument</option></select></label>
      <div className="guidedMeasurementGrid">
        {supportedMeasurementDefinitions.map((item) => <label key={item.name}><span>{item.label}<small>{item.context}</small></span><span className="unitInput"><input inputMode="decimal" type="number" min="0" step="0.1" value={manualValues[item.name] ?? ""} onChange={(event) => setManualValues((current) => ({...current, [item.name]: event.target.value}))} aria-label={`${item.label} in ${item.unit}`} /><b>{item.unit}</b></span></label>)}
      </div>
      <button className="primaryButton measurementSave" onClick={saveGuidedMeasurements}>Save entered measurements</button>
      {savedMessage && <p className="successText">{savedMessage}</p>}
      {error && <p className="errorText">{error}</p>}
      <p className="cautionText">{notice}</p>

      <details className="advancedMeasurements">
        <summary>Advanced iPhone companion import</summary>
        <div className="measurementWorkflow" style={{gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))"}}>
          <article><b>01</b><strong>Capture</strong><p>Use the native Swift companion maintained in the repository. Safari cannot directly expose raw LiDAR or ARKit capture.</p></article>
          <article><b>02</b><strong>Share</strong><p>Choose Export in the companion and save the generated file to Files or the Share Sheet.</p></article>
          <article><b>03</b><strong>Import</strong><p>Select that file below. The app validates and reads it automatically.</p></article>
        </div>
        <div className="uploadGrid">
          <label className="dropZone"><span>iPhone measurement file</span><strong>Select exported .json</strong><small>Choose the file; do not edit its contents.</small><input type="file" accept=".json,application/json" onChange={importJson} /></label>
          <label className="dropZone"><span>Optional 3D geometry</span><strong>Select USDZ or PLY</strong><small>Metadata only; the mesh is not clinically interpreted.</small><input type="file" multiple accept=".usdz,.ply,model/vnd.usdz+zip,application/octet-stream" onChange={selectMesh} /></label>
        </div>
      </details>

      <div className="measurementData single">
        <div>
          <h3>Saved measurements</h3>
          {(context.measurements ?? []).length === 0 ? <p>No measurements saved for the active patient.</p> : context.measurements?.map((item) => <article className="measurementRow" key={item.name}><strong>{supportedMeasurementDefinitions.find((entry) => entry.name === item.name)?.label ?? item.name.replaceAll("_", " ")}</strong><span>{item.value} {item.unit}</span><small>{item.method} · {item.confidence ?? "unknown"} confidence</small></article>)}
          {meshFiles.map((file) => <article className="measurementRow" key={file.name}><strong>{file.name}</strong><span>{file.type}</span><small>{(file.size / 1024 / 1024).toFixed(2)} MB · local metadata only</small></article>)}
          {((context.measurements?.length ?? 0) > 0 || meshFiles.length > 0) && <button className="textButton dangerText" onClick={() => {if (window.confirm("Clear all measurements for the active patient?")) {setContext((current) => ({...current, measurements: []}));setMeshFiles([]);setManualValues({});}}}>Clear measurements</button>}
        </div>
      </div>
    </section>
  );
}
