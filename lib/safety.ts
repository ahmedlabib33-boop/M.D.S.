import { normalizeText } from "./text";
import type { PatientContext, SafetyFlag } from "./types";

type Rule = {
  id: string;
  severity: "emergency" | "urgent";
  any: string[];
  clinicalLabel: string;
  plainEnglish: string;
  medicalArabic: string;
};

const RULES: Rule[] = [
  {
    id: "airway",
    severity: "emergency",
    any: [
      "cannot breathe", "can't breathe", "severe difficulty breathing", "stridor",
      "blue lips", "cyanosis", "اختناق", "مش قادر اتنفس", "لا استطيع التنفس",
      "صعوبه شديده في التنفس", "ازرقاق الشفاه"
    ],
    clinicalLabel: "Possible airway compromise / severe respiratory distress",
    plainEnglish: "The description may indicate dangerously impaired breathing.",
    medicalArabic: "اشتباه تهديد لمجرى الهواء أو ضائقة تنفسية شديدة"
  },
  {
    id: "stroke",
    severity: "emergency",
    any: [
      "face droop", "facial droop", "sudden one sided weakness", "sudden weakness one side",
      "new slurred speech", "sudden aphasia", "sudden paralysis",
      "اعوجاج الوجه", "ضعف مفاجئ في جانب", "شلل مفاجئ", "تلعثم مفاجئ", "حبسه كلاميه مفاجئه"
    ],
    clinicalLabel: "Possible acute focal neurological deficit",
    plainEnglish: "These can be warning features of stroke or another acute neurological emergency.",
    medicalArabic: "اشتباه عجز عصبي بؤري حاد قد يتوافق مع سكتة دماغية"
  },
  {
    id: "cardiac",
    severity: "emergency",
    any: [
      "crushing chest pain", "chest pressure with sweating", "chest pain with shortness of breath",
      "الم صدر شديد", "ضغط علي الصدر", "الم الصدر مع ضيق التنفس", "الم الصدر مع عرق"
    ],
    clinicalLabel: "Possible acute coronary syndrome or cardiopulmonary emergency",
    plainEnglish: "Severe chest pain/pressure with systemic or breathing symptoms requires urgent emergency assessment.",
    medicalArabic: "اشتباه متلازمة شريان تاجي حادة أو طارئ قلبي رئوي"
  },
  {
    id: "anaphylaxis",
    severity: "emergency",
    any: [
      "tongue swelling", "throat swelling", "anaphylaxis", "wheezing after allergy",
      "تورم اللسان", "تورم الحلق", "حساسيه مفرطه", "صفير بعد حساسيه"
    ],
    clinicalLabel: "Possible anaphylaxis",
    plainEnglish: "Airway swelling or breathing symptoms after an allergic reaction can be life-threatening.",
    medicalArabic: "اشتباه تأق (حساسية مفرطة) مع احتمال تأثر مجرى الهواء"
  },
  {
    id: "major_bleeding",
    severity: "emergency",
    any: [
      "vomiting blood", "large amount of blood", "uncontrolled bleeding", "black stool with fainting",
      "قيء دموي", "نزيف لا يتوقف", "نزيف شديد", "براز اسود مع اغماء"
    ],
    clinicalLabel: "Possible major hemorrhage",
    plainEnglish: "The description may indicate significant internal or external bleeding.",
    medicalArabic: "اشتباه نزف شديد يحتاج تقييماً إسعافياً"
  },
  {
    id: "sepsis",
    severity: "urgent",
    any: [
      "high fever with confusion", "fever with confusion", "rapidly spreading cellulitis",
      "حمى شديده مع تشوش", "حراره مع هذيان", "التهاب جلدي ينتشر بسرعه"
    ],
    clinicalLabel: "Possible severe systemic infection",
    plainEnglish: "Systemic illness or rapidly spreading infection needs prompt clinical assessment.",
    medicalArabic: "اشتباه عدوى جهازية شديدة أو التهاب نسيج خلوي سريع الانتشار"
  },
  {
    id: "meningism",
    severity: "emergency",
    any: [
      "fever stiff neck confusion", "worst headache with stiff neck", "neck stiffness with fever",
      "تيبس الرقبه مع حمى", "صداع شديد مع تيبس الرقبه"
    ],
    clinicalLabel: "Possible meningitis / intracranial emergency",
    plainEnglish: "Fever, severe headache, neck stiffness or altered mental state can require emergency evaluation.",
    medicalArabic: "اشتباه التهاب سحايا أو حالة عصبية داخل القحف طارئة"
  },
  {
    id: "pregnancy_bleeding",
    severity: "urgent",
    any: [
      "pregnant bleeding severe pain", "pregnancy bleeding abdominal pain",
      "حامل ونزيف مع الم", "نزيف اثناء الحمل مع الم"
    ],
    clinicalLabel: "Pregnancy with bleeding/pain",
    plainEnglish: "Bleeding with pain during pregnancy requires prompt obstetric assessment.",
    medicalArabic: "نزف مع ألم أثناء الحمل يستلزم تقييماً عاجلاً للنساء والتوليد"
  },
  {
    id: "suicide",
    severity: "emergency",
    any: [
      "want to kill myself", "suicidal plan", "going to hurt myself",
      "عايز اموت نفسي", "هنتحر", "خطه للانتحار", "هأذي نفسي"
    ],
    clinicalLabel: "Possible imminent self-harm risk",
    plainEnglish: "The text may indicate immediate risk of self-harm.",
    medicalArabic: "اشتباه خطر وشيك لإيذاء النفس"
  }
];

export function evaluateSafety(ctx: PatientContext): SafetyFlag[] {
  const corpus = normalizeText([
    ctx.symptoms,
    ctx.duration ?? "",
    ctx.knownConditions ?? "",
    ctx.medications ?? ""
  ].join(" "));

  const flags: SafetyFlag[] = [];
  for (const rule of RULES) {
    const matched = rule.any.filter((phrase) =>
      corpus.includes(normalizeText(phrase))
    );
    if (matched.length) {
      flags.push({
        id: rule.id,
        severity: rule.severity,
        clinicalLabel: rule.clinicalLabel,
        plainEnglish: rule.plainEnglish,
        medicalArabic: rule.medicalArabic,
        matched,
      });
    }
  }

  // Context-sensitive safeguard, deliberately conservative.
  if (ctx.pregnant && /(نزيف|bleeding)/i.test(ctx.symptoms) && /(الم|pain)/i.test(ctx.symptoms)) {
    if (!flags.some((f) => f.id === "pregnancy_bleeding")) {
      flags.push({
        id: "pregnancy_bleeding",
        severity: "urgent",
        clinicalLabel: "Pregnancy with bleeding/pain",
        plainEnglish: "Bleeding with pain during pregnancy requires prompt obstetric assessment.",
        medicalArabic: "نزف مع ألم أثناء الحمل يستلزم تقييماً عاجلاً للنساء والتوليد",
        matched: ["pregnancy + bleeding + pain"],
      });
    }
  }
  return flags;
}
