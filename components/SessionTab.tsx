"use client";

import type { AnalysisResponse, PatientContext } from "@/lib/types";

export default function SessionTab({context, history, onClear}: {
  context: PatientContext;
  history: AnalysisResponse[];
  onClear: () => void;
}) {
  function exportSession() {
    const payload = {
      exportedAt: new Date().toISOString(),
      creator: "Developed & Created | Eng. Ahmed Labib",
      persistence: "User-initiated download; the application does not retain this session.",
      patientContext: context,
      assessments: history,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "medical-session-" + new Date().toISOString().slice(0, 10) + ".json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const fields = [
    ["Symptoms", context.symptoms],
    ["Age", context.age],
    ["Sex", context.sex],
    ["Duration", context.duration],
    ["Conditions", context.knownConditions],
    ["Medications", context.medications],
    ["Allergies", context.allergies],
    ["Measurements", context.measurements?.length ?? 0],
    ["Assessments", history.length],
  ];

  return (
    <section className="workspacePanel panel">
      <div className="panelHeader">
        <div><span className="sectionLabel">Volatile browser memory</span><h2>Current session</h2></div>
        <span className="liveBadge">Not persisted</span>
      </div>
      <p className="cautionText">This information exists only in the current page session. Refreshing or closing the page clears it unless you explicitly download a copy.</p>
      <div className="sessionGrid">{fields.map(([label, value]) => <article key={String(label)}><span>{label}</span><strong>{value == null || value === "" ? "Not supplied" : String(value)}</strong></article>)}</div>
      <div className="actionRow"><button className="primaryButton" onClick={exportSession}>Download session JSON</button><button className="secondaryButton dangerText" onClick={onClear}>Clear current session</button></div>
    </section>
  );
}
