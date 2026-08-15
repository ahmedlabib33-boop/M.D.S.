import manifest from "@/data/source_manifest.json";
import BrandSignature from "./BrandSignature";

const downloads = [
  ["iOS LiDAR Swift companion", "/downloads/ios_lidar_measurement.swift"],
  ["iPhone measurement guide (Markdown)", "/downloads/iphone_15_pro_max_measurement_guide.md"],
  ["iPhone measurement guide (Word)", "/downloads/iphone_15_pro_max_measurement_guide.docx"],
  ["iOS JSON measurement schema", "/downloads/ios-measurement-contract.schema.json"],
  ["Original Python clinical engine", "/downloads/ent_clinical_assistant.py"],
  ["Original iOS Python importer", "/downloads/ios_measurement_importer.py"],
  ["Original medical source list", "/downloads/Sources.csv"],
  ["Original ENT knowledge base", "/downloads/ent_knowledge_base.json"],
];

export default function SourcesTab() {
  return (
    <section className="workspacePanel panel">
      <BrandSignature />
      <div className="sourceRegistry">
        <div className="panelHeader"><div><span className="sectionLabel">Attribution and currency</span><h2>Medical knowledge source registry</h2></div><span className="sourceBadge">{manifest.knowledge_sources.length} medical sources</span></div>
        <p className="authorshipBanner">{manifest.medical_authorship_notice}</p>
        <div className="sourceCards">
          {manifest.knowledge_sources.map((source) => (
            <article key={source.id}>
              <div><span>{source.access}</span><strong>{source.name}</strong></div>
              <p>{source.role}</p>
              <small>{source.release}</small>
              {"url" in source && source.url && <a href={source.url} target="_blank" rel="noreferrer">Open source ↗</a>}
            </article>
          ))}
        </div>
      </div>
      <div className="downloadSection">
        <span className="sectionLabel">Preserved project resources</span><h2>Downloads</h2>
        <div className="downloadGrid">{downloads.map(([label, url]) => <a key={url} href={url} download><span>{label}</span><strong>Download ↓</strong></a>)}</div>
      </div>
    </section>
  );
}
