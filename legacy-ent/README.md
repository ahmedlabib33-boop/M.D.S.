# ENT Clinical Decision Support Assistant

> **⚠️ HONEST DISCLAIMER**: This is a **decision-support reference tool**, NOT a diagnostic device. It does NOT replace clinical examination, imaging, laboratory testing, or professional medical judgment. Always correlate suggestions with physical exam and verify against current local guidelines.

---

## 👤 Developed & Created

**Eng. Ahmed Labib**

*Clinical Decision Support Engineer | Medical AI Systems Architect*

---

## 📚 Knowledge Sources

This knowledge base is curated from established otolaryngology references:

| Source | Contribution |
|--------|-------------|
| **Cummings Otolaryngology: Head & Neck Surgery** | Definitive reference covering all ENT subspecialties |
| **Scott-Brown's Otorhinolaryngology** | Comprehensive British ENT reference with surgical detail |
| **UpToDate-style Clinical Summaries** | Evidence-based review format for differential diagnosis |
| **Branchial Arch Embryology — Standard Teaching** | Congenital anomalies including preauricular sinus |
| **AAO-HNS Clinical Practice Guidelines** | Referral criteria and management protocols |
| **NICE Clinical Knowledge Summaries (UK)** | Primary care ENT guidance |

> **Note:** Content compiled at a general educational level. It has **NOT** been independently re-verified against current primary literature. Always verify against current sources before clinical use.

---

## What This Is (Honestly)

A Python-based clinical decision-support system for Otolaryngology (ENT) that combines:

- **Structured Knowledge Base**: 17 ENT conditions with real clinical depth (symptoms, signs, differentials, management, complications, red flags, referral guidance)
- **Real ML Components** (not fake "AI" wrappers):
  - **TF-IDF + Cosine Similarity** for symptom-to-condition text matching
  - **Multinomial Naive Bayes** classifier with Laplace smoothing for condition probability estimation
  - **Ensemble combination** of both models for ranked differential suggestions
- **Red Flag Detector**: Rule-based urgent referral identification across 7 emergency categories
- **Patient Logger**: JSON-based vitals and assessment tracking (educational/reference use only)
- **Interactive CLI**: Natural language symptom parsing with structured output

---

## Files Included

| File | Description |
|------|-------------|
| `ent_clinical_assistant.py` | **Main application** (~440 lines) — all components in one file |
| `ent_knowledge_base.json` | Structured ENT knowledge base with 17 conditions |
| `test_ent_assistant.py` | Component validation suite (7 tests) |
| `requirements.txt` | Dependencies (stdlib-only for v1; optional enhancements listed) |
| `README.md` | This file |

---

## Quick Start

### 1. Run the Interactive Chatbot

```bash
python ent_clinical_assistant.py
```

This starts an interactive CLI. Type `help` for commands.

**Example session:**
```
ENT> assess child with ear pain fever bulging eardrum
ENT> condition cholesteatoma
ENT> patient P001
ENT> vitals
ENT> history
ENT> demo
ENT> quit
```

### 2. Run Validation Tests

```bash
python test_ent_assistant.py
```

All 7 component tests should pass, verifying:
- Knowledge base loading and indexing
- TF-IDF + Cosine Similarity matching
- Naive Bayes classification
- Red flag detection
- Patient logging
- Full assessment pipeline
- Condition detail retrieval

### 3. Use Programmatically

```python
from ent_clinical_assistant import ClinicalAssessmentEngine

engine = ClinicalAssessmentEngine()

# Run assessment
result = engine.assess("small pit in front of ear with pus discharge swelling")

# Print top match
print(result['ensemble_ranking'][0]['condition'])
# → "Preauricular Sinus Cellulitis / Abscess"

# Check red flags
print(result['red_flags']['urgent_referral_needed'])
# → True

# Get full condition details
detail = engine.get_condition_detail("congenital_preauricular_sinus")
print(detail['management'])
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INPUT (symptoms)                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼────────┐          ┌────────▼────────┐
│  TF-IDF +      │          │  Naive Bayes    │
│  Cosine Sim    │          │  Classifier     │
│  (symptom      │          │  (probabilistic │
│   matching)    │          │   ranking)      │
└───────┬────────┘          └────────┬────────┘
        │                             │
        └──────────────┬──────────────┘
                       │
              ┌────────▼────────┐
              │   ENSEMBLE      │  ← 60% NB + 40% TF-IDF
              │   COMBINER      │
              └────────┬────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼────────┐          ┌────────▼────────┐
│  RED FLAG      │          │  CONDITION      │
│  DETECTOR      │          │  DETAIL         │
│  (7 categories)│          │  LOOKUP         │
└───────┬────────┘          └─────────────────┘
        │
┌───────▼────────┐
│  PATIENT       │
│  LOGGER        │
│  (vitals +     │
│  assessments)  │
└────────────────┘
```

---

## ML Components (Real, Not Fake)

### 1. TF-IDF + Cosine Similarity Symptom Matcher

- **Corpus**: Each condition = document combining definition + symptoms + signs + complications + differential diagnoses
- **Tokenization**: Lowercase, punctuation removal, stop-word filtering, medical stop-word removal
- **TF-IDF**: Term frequency × inverse document frequency with smoothing
- **Vectorization**: L2-normalized sparse vectors
- **Matching**: Cosine similarity between query vector and all condition document vectors
- **Output**: Ranked list of conditions with similarity scores (0–1, not calibrated probabilities)

### 2. Multinomial Naive Bayes Classifier

- **Training**: Each condition is a "class" with its symptoms/signs/complications as features
- **Smoothing**: Laplace (add-1) smoothing to handle unseen features
- **Probability**: Softmax over log-probabilities for calibrated output
- **Output**: Proper probability distribution over all 17 conditions (sums to 1.0)

### 3. Ensemble Ranking

- **Combination**: 60% Naive Bayes probability + 40% TF-IDF similarity
- **Rationale**: NB is more probabilistically calibrated; TF-IDF captures broader semantic similarity
- **Confidence Tiers**:
  - HIGH: ≥ 0.75
  - MEDIUM: ≥ 0.50
  - LOW: ≥ 0.30
  - VERY_LOW: < 0.30

---

## Red Flag Detection

Seven emergency categories with keyword-based detection:

| Category | Examples |
|----------|----------|
| **Airway Emergency** | stridor, airway obstruction, drooling, inability to swallow secretions, trismus |
| **Neurological Emergency** | facial weakness, severe headache, neck stiffness, altered consciousness |
| **Severe Infection** | spreading cellulitis, high fever, perichondritis, mastoiditis, meningitis |
| **Severe Bleeding** | hemodynamic instability, uncontrolled bleeding, hypovolemia |
| **Malignancy Concern** | unilateral mass, persistent hoarseness >3 weeks in smoker, weight loss |
| **Vision Threat** | visual changes, periorbital swelling, orbital cellulitis, vision loss |
| **Cardiovascular** | chest pain, arrhythmia, severe daytime sleepiness (OSA driving risk) |

Also checks each matched condition's **explicit red flags** from the knowledge base for contextual relevance.

---

## Knowledge Base Coverage (17 Conditions)

### Ear
- Congenital Preauricular Sinus (incl. cellulitis/abscess complication)
- Acute Otitis Media (AOM)
- Otitis Externa (Swimmer's Ear)
- Cholesteatoma
- Acute Mastoiditis
- Benign Paroxysmal Positional Vertigo (BPPV)
- Tinnitus

### Nose/Sinus
- Acute Rhinosinusitis
- Allergic Rhinitis
- Nasal Polyps
- Epistaxis (Nosebleed)

### Throat/Voice
- Acute Tonsillitis / Peritonsillar Abscess (Quinsy)
- Acute Laryngitis
- Vocal Fold Nodules

### Airway/Sleep
- Obstructive Sleep Apnea (OSA) — Adult

### Salivary Gland
- Sialadenitis

---

## Patient Logger

Tracks:
- **Vital Signs**: Temperature, HR, BP, RR, SpO2, pain score, weight, height, notes
- **Assessments**: Full assessment output with timestamp
- **History**: Trend analysis over time

**⚠️ NOT a replacement for EHR** — for educational tracking and reference only.

---

## Honest Limitations & Roadmap

### Current Limitations

1. **Small Knowledge Base**: 17 conditions vs. 200+ in comprehensive ENT practice
2. **No Clinical Dataset**: Models trained on KB text, not real patient encounters
3. **No Temporal Modeling**: Can't track symptom progression
4. **Limited NLP**: Simple tokenization, no medical NER or negation detection ("no fever" still matches "fever")
5. **No Imaging/Lab Integration**: Can't process audiograms, CT scans, cultures
6. **Not Regulated**: Not FDA 510(k), not CE-marked, not HIPAA-compliant
7. **Uncalibrated Confidence**: Scores are relative rankings, NOT absolute disease probabilities

### What "Best-in-Class" Would Require

| Feature | Current | Best-in-Class |
|---------|---------|---------------|
| Knowledge Base | 17 conditions, static | 500+ conditions, weekly updates, SNOMED-CT coded |
| ML Model | TF-IDF + Naive Bayes | Fine-tuned clinical LLM (Med-PaLM/GatorTron) or XGBoost on EHR data |
| NLP | Simple tokenization | spaCy/SciSpaCy with medical NER, negation detection, temporal extraction |
| Validation | None | Multi-site prospective study vs. board-certified ENT specialists |
| Integration | Standalone CLI | HL7/FHIR EHR connectivity, DICOM imaging, lab APIs |
| Safety | Basic red flags | Adversarial testing, bias auditing, explainable AI (XAI) |
| Deployment | Local Python | Cloud with HIPAA/GDPR compliance, audit logging |
| Regulatory | None | FDA Class II/III or CE-marked as diagnostic support |

### Realistic Next Steps (3–6 months)

1. Expand KB to 50+ core ENT conditions with SNOMED-CT coding
2. Add negation detection ("no fever" should not match fever)
3. Add symptom duration/severity extraction
4. Build web interface (Flask/FastAPI)
5. Add explainability (which symptoms drove each match)
6. Conduct internal validation with ENT residents

---

## 📱 iPhone 15 Pro Max LiDAR Integration

The system includes an **iOS companion module** that uses the iPhone 15 Pro Max's LiDAR scanner and TrueDepth camera to capture body measurements and import them into patient records.

### What the iPhone Can Measure (Honestly)

| Measurement | Accuracy | Clinical Use |
|-------------|----------|--------------|
| **Neck circumference** | ±0.5–1.0 cm | OSA screening, trend tracking |
| **Facial width / asymmetry** | ±1–2 mm | Reconstructive baseline, palsy follow-up |
| **Pinna (ear) dimensions** | ±1–2 mm | Microtia assessment, surgical planning |
| **Height** | ±1–2 cm | BMI calculation, growth tracking |
| **Head circumference** | ±0.5–1.0 cm | Pediatric screening |
| **3D mesh scan** | ±1–2 mm surface | Pre-operative planning, documentation |

**NOT measurable:** Body temperature, blood pressure, SpO2, weight, heart sounds, hearing thresholds, endoscopic views.

### iOS → Python Workflow

```
iPhone 15 Pro Max
    ↓ LiDAR + ARKit capture
Swift app (ios_lidar_measurement.swift)
    ↓ Export JSON via AirDrop
Python backend (ios_measurement_importer.py)
    ↓ Parse → VitalSigns → PatientLogger
    ↓ Auto-recommendations (e.g., neck >43cm → OSA screening)
ENT Clinical Assistant
```

### Quick Start: iOS Import

```python
from ent_clinical_assistant import ClinicalAssessmentEngine
from ios_measurement_importer import iOSMeasurementImporter

engine = ClinicalAssessmentEngine()
importer = iOSMeasurementImporter(engine.patient_logger)

# Import from iOS exported JSON
report = importer.import_from_file("patient_measurements.json", "P001")

# Access recommendations
for rec in report["recommendations"]:
    print(rec)
# → "🟡 Neck circumference 44.2cm exceeds OSA risk threshold..."
```

### Files for iOS Integration

| File | Description |
|------|-------------|
| `ios_lidar_measurement.swift` | iOS app — ARKit/LiDAR capture, SwiftUI interface, JSON export |
| `ios_measurement_importer.py` | Python module — JSON parsing, vital mapping, clinical recommendations |
| `iphone_15_pro_max_measurement_guide.md` | Complete capability documentation with accuracy specs |

---

## License & Usage

This is an **educational and reference tool**. It is **NOT** intended for:
- Direct patient diagnosis
- Replacement of clinical judgment
- Use as a medical device without regulatory approval

By using this tool, you acknowledge that it provides **decision support only** and that all clinical decisions must be made by qualified healthcare professionals.

---

## Technical Notes

- **Python Version**: 3.8+ (uses dataclasses, typing)
- **Dependencies**: Python standard library only (no pip install needed for v1)
- **No External APIs**: Fully offline, no data leaves your machine
- **Storage**: JSON files for knowledge base and patient logs

---

## Contact / Contributions

This was built as a demonstration of honest clinical decision-support architecture. For production medical AI, consult regulatory affairs specialists and clinical validation experts.
