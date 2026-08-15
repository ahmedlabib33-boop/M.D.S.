import seed from "@/data/hpo_seed.json";

const map = new Map(seed.map((x) => [x.label.toLowerCase(), x.arabic]));

export function arabicMedicalTerm(label: string): string | undefined {
  return map.get(label.toLowerCase());
}

const arabicToEnglishPairs: Array<[RegExp, string]> = [
  [/ضيق\s*التنفس|صعوبه\s*التنفس|مش\s*قادر\s*اتنفس/gi, "dyspnea difficulty breathing"],
  [/الم\s*الصدر|وجع\s*الصدر/gi, "chest pain"],
  [/صداع/gi, "headache"],
  [/دوخه|دوار/gi, "dizziness vertigo"],
  [/حمي|سخونيه|حراره/gi, "fever"],
  [/قيء|ترجيع/gi, "vomiting"],
  [/غثيان/gi, "nausea"],
  [/اسهال/gi, "diarrhea"],
  [/امساك/gi, "constipation"],
  [/الم\s*البطن|وجع\s*البطن/gi, "abdominal pain"],
  [/طفح\s*جلدي/gi, "skin rash"],
  [/تورم/gi, "swelling edema"],
  [/نزيف/gi, "bleeding"],
  [/اغماء|فقدان\s*الوعي/gi, "syncope loss of consciousness"],
  [/تشنج|نوبه\s*صرع/gi, "seizure"],
  [/ضعف\s*مفاجي/gi, "sudden weakness"],
  [/تنميل/gi, "numbness paresthesia"],
  [/خفقان/gi, "palpitations"],
  [/سعال|كحه/gi, "cough"],
  [/بلغم\s*بدم|كحه\s*بدم/gi, "hemoptysis coughing blood"],
  [/دم\s*في\s*البول/gi, "hematuria blood in urine"],
  [/اصفرار|يرقان/gi, "jaundice"],
];

export function augmentArabicQuery(text: string): string {
  let additions: string[] = [];
  for (const [rx, english] of arabicToEnglishPairs) {
    if (rx.test(text)) additions.push(english);
    rx.lastIndex = 0;
  }
  return additions.length ? `${text}\n${additions.join(" ")}` : text;
}
