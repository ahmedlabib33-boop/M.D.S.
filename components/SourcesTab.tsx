import manifest from "@/data/source_manifest.json";
import BrandSignature from "./BrandSignature";

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
              <div><strong>{source.name}</strong></div>
              <p>{source.role}</p>
              <small>{source.release}</small>
              {"url" in source && source.url && <a href={source.url} target="_blank" rel="noreferrer">Open source ↗</a>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
