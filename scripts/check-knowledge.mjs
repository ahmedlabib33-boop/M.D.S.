import fs from "node:fs";
import path from "node:path";

const data = path.join(process.cwd(), "data");
const files = [
  "ent_knowledge_base.json",
  "hpo_seed.json",
  "hpo_compact.json",
  "hpo_diseases_compact.json",
  "hpo_statistics.json",
];

for (const f of files) {
  const p = path.join(data, f);
  console.log(`${fs.existsSync(p) ? "OK " : "MISS"} ${f}`);
}
