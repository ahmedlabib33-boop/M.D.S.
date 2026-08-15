import { XMLParser } from "fast-xml-parser";

function stripHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function contentMap(content: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const items = Array.isArray(content) ? content : content ? [content] : [];
  for (const item of items as any[]) {
    const name = item?.["@_name"] ?? "unknown";
    const text = stripHtml(item?.["#text"] ?? item);
    (out[name] ??= []).push(text);
  }
  return out;
}

export async function searchMedlinePlus(query: string, max = 6) {
  if (!query.trim()) return [];
  const params = new URLSearchParams({
    db: "healthTopics",
    term: query,
    rettype: "brief",
    retmax: String(max),
    tool: process.env.MEDLINEPLUS_TOOL || "bilingualMedicalDecisionSupport",
  });
  if (process.env.MEDLINEPLUS_EMAIL) params.set("email", process.env.MEDLINEPLUS_EMAIL);

  try {
    const res = await fetch(`https://wsearch.nlm.nih.gov/ws/query?${params}`, {
      headers: {"User-Agent": "BilingualMedicalDecisionSupport/2.0"},
      next: {revalidate: 43200},
    });
    if (!res.ok) throw new Error(`MedlinePlus HTTP ${res.status}`);
    const xml = await res.text();
    const parser = new XMLParser({ignoreAttributes: false, textNodeName: "#text"});
    const parsed = parser.parse(xml);
    const docs = parsed?.nlmSearchResult?.list?.document;
    const list = Array.isArray(docs) ? docs : docs ? [docs] : [];

    return list.map((doc: any) => {
      const cm = contentMap(doc.content);
      return {
        title: cm.title?.[0] || cm.FullSummary?.[0] || "MedlinePlus topic",
        url: cm.url?.[0],
        summary: cm.snippet?.[0] || cm.FullSummary?.[0] || "",
      };
    });
  } catch (error) {
    console.error("MedlinePlus lookup failed", error);
    return [];
  }
}
