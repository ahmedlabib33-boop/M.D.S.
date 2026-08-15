const ARABIC_DIACRITICS = /[\u0617-\u061A\u064B-\u0652\u0670\u06D6-\u06ED]/g;

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s+\-/%]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((x) => x.length > 1);
}

export function lexicalScore(query: string, document: string): number {
  const q = tokenize(query);
  const d = tokenize(document);
  if (!q.length || !d.length) return 0;

  const freq = new Map<string, number>();
  for (const token of d) freq.set(token, (freq.get(token) ?? 0) + 1);

  let hit = 0;
  for (const token of q) {
    const f = freq.get(token) ?? 0;
    if (f) hit += 1 + Math.log1p(f);
  }

  const phraseBonus = normalizeText(document).includes(normalizeText(query)) ? 2 : 0;
  return (hit + phraseBonus) / Math.sqrt(q.length * Math.max(1, d.length));
}

export function detectLanguage(text: string): "ar" | "en" | "mixed" | "unknown" {
  const ar = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const en = (text.match(/[A-Za-z]/g) ?? []).length;
  if (!ar && !en) return "unknown";
  if (ar && en) return "mixed";
  return ar ? "ar" : "en";
}
