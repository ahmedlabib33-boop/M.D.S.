import fs from "node:fs/promises";
import path from "node:path";

const release = process.env.HPO_RELEASE || "v2026-06-23";
const dataDir = path.join(process.cwd(), "data");
const hpoUrl =
  process.env.HPO_JSON_URL ||
  `https://github.com/obophenotype/human-phenotype-ontology/releases/download/${release}/hp-base.json`;
const hpoaUrl =
  process.env.HPOA_URL ||
  "https://purl.obolibrary.org/obo/hp/hpoa/phenotype.hpoa";

async function fetchText(url) {
  const res = await fetch(url, {redirect: "follow"});
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return await res.text();
}

function compactId(id) {
  const match = String(id).match(/HP[_:](\d+)/);
  return match ? `HP:${match[1]}` : String(id);
}

function definition(meta) {
  return meta?.definition?.val || meta?.definition || undefined;
}

function synonyms(meta) {
  const values = meta?.synonyms || [];
  return values.map((x) => x?.val || x).filter(Boolean);
}

async function syncHpo() {
  console.log(`Downloading HPO ${release}...`);
  const raw = await fetchText(hpoUrl);
  const obj = JSON.parse(raw);
  const nodes = obj?.graphs?.flatMap((g) => g.nodes || []) || [];

  const terms = nodes
    .filter((n) => n?.lbl && /HP[_:]\d+/.test(String(n.id)))
    .filter((n) => !String(n.lbl).toLowerCase().startsWith("obsolete "))
    .map((n) => ({
      id: compactId(n.id),
      label: n.lbl,
      definition: definition(n.meta),
      synonyms: synonyms(n.meta),
    }));

  await fs.writeFile(
    path.join(dataDir, "hpo_compact.json"),
    JSON.stringify(terms),
    "utf8"
  );
  console.log(`HPO terms: ${terms.length}`);
  return terms.length;
}

async function syncDiseaseAnnotations() {
  console.log("Downloading HPO phenotype-to-disease annotations...");
  const text = await fetchText(hpoaUrl);
  const rows = text.split(/\r?\n/).filter((x) => x && !x.startsWith("#"));
  const diseases = new Map();
  const phenotypeDiseaseSets = new Map();

  for (const line of rows) {
    const c = line.split("\t");
    // Current HPOA layout begins with database_id, disease_name, qualifier, hpo_id.
    const diseaseId = c[0]?.trim();
    const diseaseName = c[1]?.trim();
    const qualifier = c[2]?.trim();
    const hpoId = c[3]?.trim();

    if (!diseaseId || !diseaseName || !/^HP:\d+$/.test(hpoId || "")) continue;
    if (qualifier === "NOT") continue;

    if (!diseases.has(diseaseId)) diseases.set(diseaseId, {id: diseaseId, name: diseaseName, hpo: new Set()});
    diseases.get(diseaseId).hpo.add(hpoId);

    if (!phenotypeDiseaseSets.has(hpoId)) phenotypeDiseaseSets.set(hpoId, new Set());
    phenotypeDiseaseSets.get(hpoId).add(diseaseId);
  }

  const compact = [...diseases.values()].map((d) => ({
    id: d.id,
    name: d.name,
    hpo: [...d.hpo],
  }));

  const phenotypeDiseaseCount = Object.fromEntries(
    [...phenotypeDiseaseSets.entries()].map(([k, v]) => [k, v.size])
  );

  await fs.writeFile(
    path.join(dataDir, "hpo_diseases_compact.json"),
    JSON.stringify(compact),
    "utf8"
  );
  await fs.writeFile(
    path.join(dataDir, "hpo_statistics.json"),
    JSON.stringify({
      release,
      generatedAt: new Date().toISOString(),
      diseaseCount: compact.length,
      phenotypeDiseaseCount,
    }),
    "utf8"
  );
  console.log(`Disease annotations: ${compact.length}`);
  return compact.length;
}

await fs.mkdir(dataDir, {recursive: true});
const hpoCount = await syncHpo();
const diseaseCount = await syncDiseaseAnnotations();

console.log(JSON.stringify({
  ok: true,
  release,
  hpoCount,
  diseaseCount,
  note: "These are ontology/reference data. They do not constitute a clinically validated diagnostic classifier."
}, null, 2));
