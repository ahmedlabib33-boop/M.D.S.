"use client";

import { useState, type FormEvent } from "react";
import type { PatientRecord, Sex } from "@/lib/types";
import { patientVaultBackup, patientVaultStorageNotice } from "@/lib/patient-records";

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function SessionTab({patients, activePatientId, vaultStatus, onCreate, onOpen, onDelete, onResetActive, onExportAll}: {
  patients: PatientRecord[];
  activePatientId: string | null;
  vaultStatus: string;
  onCreate: (name: string, sex: Sex) => Promise<void>;
  onOpen: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onResetActive: () => void;
  onExportAll: () => void;
}) {
  const [name, setName] = useState("");
  const [sex, setSex] = useState<Sex | "">("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!sex) return setError("Select Male or Female.");
    setSaving(true);
    setError("");
    try {
      await onCreate(name, sex);
      setName("");
      setSex("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Patient record could not be created.");
    } finally {
      setSaving(false);
    }
  }

  function exportPatient(patient: PatientRecord) {
    downloadJson(patientVaultBackup([patient]), `patient-${patient.id}-${new Date().toISOString().slice(0, 10)}.json`);
  }

  return (
    <section className="workspacePanel panel">
      <div className="panelHeader">
        <div><span className="sectionLabel">Private multi-patient vault</span><h2>Patient records</h2></div>
        <span className="liveBadge">{vaultStatus}</span>
      </div>
      <p className="cautionText">{patientVaultStorageNotice} Browser storage is not a substitute for an authenticated, compliant clinical record system.</p>

      <div className="patientWorkspace">
        <form className="patientCreate" onSubmit={create}>
          <h3>Create patient record</h3>
          <label>Patient name<input autoComplete="off" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} placeholder="Enter the patient name" required /></label>
          <label>Sex<select value={sex} onChange={(event) => setSex(event.target.value as Sex | "")} required><option value="" disabled>Select</option><option value="male">Male</option><option value="female">Female</option></select></label>
          <button className="primaryButton" disabled={saving}>{saving ? "Saving…" : "Create and open patient"}</button>
          {error && <p className="errorText">{error}</p>}
        </form>

        <div className="patientList">
          <div className="patientListHeader"><h3>Saved on this device</h3><span>{patients.length} patient{patients.length === 1 ? "" : "s"}</span></div>
          {patients.length === 0 ? <div className="emptyPatient"><strong>No saved patients</strong><p>Create the first record. No sample or invented patient data is included.</p></div> : patients.map((patient) => (
            <article className={patient.id === activePatientId ? "patientCard active" : "patientCard"} key={patient.id}>
              <div><strong>{patient.name}</strong><span>{patient.sex === "female" ? "Female" : "Male"}</span><small>Updated {new Date(patient.updatedAt).toLocaleString()}</small></div>
              <dl><div><dt>Assessments</dt><dd>{patient.assessments.length}</dd></div><div><dt>Measurements</dt><dd>{patient.context.measurements?.length ?? 0}</dd></div></dl>
              <div className="patientActions"><button className="secondaryButton" onClick={() => onOpen(patient.id)}>{patient.id === activePatientId ? "Open active record" : "Open"}</button><button className="textButton" onClick={() => exportPatient(patient)}>Export backup</button><button className="textButton dangerText" onClick={() => {if (window.confirm(`Delete ${patient.name}'s locally saved record? This cannot be undone.`)) void onDelete(patient.id);}}>Delete</button></div>
            </article>
          ))}
        </div>
      </div>

      {patients.length > 0 && <div className="actionRow"><button className="secondaryButton" onClick={onExportAll}>Export all patient records</button>{activePatientId && <button className="secondaryButton dangerText" onClick={() => {if (window.confirm("Clear symptoms, measurements and assessments for the active patient while keeping the name and sex?")) onResetActive();}}>Reset active clinical data</button>}</div>}
    </section>
  );
}
