import manifest from "@/data/source_manifest.json";

export default function BrandSignature({compact = false}: {compact?: boolean}) {
  const sources = manifest.knowledge_sources.map((source) => source.name).join(" • ");
  return (
    <section className={compact ? "signature signatureCompact" : "signature"} aria-label="Creator and medical knowledge sources">
      <div className="signatureLine">
        <span>Developed &amp; Created | Eng.</span>
        <strong>Ahmed Labib</strong>
      </div>
      <div className="signatureRule" />
      <div className="signatureSources">
        <span>Knowledge Sources</span>
        <p>{sources}</p>
      </div>
      {!compact && (
        <p className="authorshipNotice">
          Eng. Ahmed Labib created and engineered the software platform. The medical knowledge is attributed to the independent sources above.
        </p>
      )}
    </section>
  );
}
