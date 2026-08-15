"use client";

import { useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import type { PatientContext } from "@/lib/types";
import { measurementAccuracyNotice, parseMeasurementImport, supportedMeasurementNames } from "@/lib/measurements";

type MeshMeta = {name: string; size: number; type: string};

export default function MeasurementsTab({context, setContext}: {
  context: PatientContext;
  setContext: Dispatch<SetStateAction<PatientContext>>;
}) {
  const [notice, setNotice] = useState(measurementAccuracyNotice);
  const [error, setError] = useState("");
  const [meshFiles, setMeshFiles] = useState<MeshMeta[]>([]);

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (file.size > 1_000_000) {
      setError("The measurement JSON exceeds the 1 MB session limit.");
      return;
    }
    try {
      const parsed = parseMeasurementImport(JSON.parse(await file.text()));
      setContext((current) => ({...current, measurements: parsed.measurements}));
      setNotice(parsed.notice);
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
        <div><span className="sectionLabel">Native iOS → private browser session</span><h2>iPhone 15 Pro Max measurements</h2></div>
        <span className="sourceBadge">ARKit · LiDAR · TrueDepth</span>
      </div>
      <div className="measurementWorkflow">
        <article><b>01</b><strong>Capture in the native Swift companion</strong><p>Safari does not expose clinical ARKit/LiDAR capture APIs. The included Swift source performs capture on the device.</p></article>
        <article><b>02</b><strong>Export through Files or Share Sheet</strong><p>The companion exports the versioned JSON contract and optional USDZ/PLY mesh.</p></article>
        <article><b>03</b><strong>Select the file in iOS Safari</strong><p>The Vercel app validates it locally and keeps it only for this browser session.</p></article>
      </div>

      <div className="uploadGrid">
        <label className="dropZone">
          <span>Measurement JSON</span><strong>Select exported .json</strong><small>iOS Files picker compatible · maximum 1 MB</small>
          <input type="file" accept=".json,application/json" onChange={importJson} />
        </label>
        <label className="dropZone">
          <span>Optional 3D geometry</span><strong>Select USDZ or PLY</strong><small>Metadata is displayed locally; the mesh is not uploaded or persisted.</small>
          <input type="file" multiple accept=".usdz,.ply,model/vnd.usdz+zip,application/octet-stream" onChange={selectMesh} />
        </label>
      </div>

      {error && <p className="errorText">{error}</p>}
      <p className="cautionText">{notice}</p>

      <div className="measurementData">
        <div>
          <h3>Accepted measurement contract</h3>
          <div className="chipRow">{supportedMeasurementNames.map((name) => <code className="dataChip" key={name}>{name}</code>)}</div>
          <a className="secondaryLink" href="/downloads/ios-measurement-contract.schema.json" download>Download JSON Schema</a>
        </div>
        <div>
          <h3>Current session measurements</h3>
          {(context.measurements ?? []).length === 0 ? <p>No measurement file imported.</p> : context.measurements?.map((item) => <article className="measurementRow" key={item.name}><strong>{item.name.replaceAll("_", " ")}</strong><span>{item.value} {item.unit}</span><small>{item.method} · {item.confidence}</small></article>)}
          {meshFiles.map((file) => <article className="measurementRow" key={file.name}><strong>{file.name}</strong><span>{file.type}</span><small>{(file.size / 1024 / 1024).toFixed(2)} MB · local metadata only</small></article>)}
          {((context.measurements?.length ?? 0) > 0 || meshFiles.length > 0) && <button className="textButton dangerText" onClick={() => {setContext((current) => ({...current, measurements: []}));setMeshFiles([]);}}>Clear session measurements</button>}
        </div>
      </div>
    </section>
  );
}
