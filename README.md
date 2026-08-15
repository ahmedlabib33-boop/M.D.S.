# Medical Intelligence Control Surface — Next.js / Vercel

A production-oriented, bilingual educational clinical decision-support platform. It is not a diagnostic device and does not claim disease probability or validated diagnostic accuracy.

## Creator signature

**Developed & Created | Eng. Ahmed Labib**

The UI permanently distinguishes `Ahmed Labib` in elite gold. Directly underneath, it displays the medical knowledge-source registry. Eng. Ahmed Labib created and engineered the software platform; the external medical knowledge remains attributed to its independent medical sources.

## Implemented application

Folder `1` remains unchanged. Folder `2` is the combined application and contains a preserved copy of folder `1` under `legacy-ent/`. Existing repository files under `public/downloads/` are retained for compatibility, but the application exposes no project-download controls.

The dashboard provides:

- Assessment with English, Arabic, and mixed-language symptom entry
- Four output registers: Clinical English, Plain English, العربية الطبية, and العربية المبسطة
- Deterministic emergency and urgent-care rules before model execution
- Full HPO phenotype search and phenotype-to-disease ontology overlap
- Preserved ENT specialist knowledge plus the original TF-IDF and Naive Bayes research engine
- Live MedlinePlus educational retrieval
- Live RxNorm normalization with official DailyMed labeling links
- Condition-aware nutrition education and high-risk restriction rules
- Live USDA FoodData Central lookup
- Named multi-patient records saved in IndexedDB on the current browser/device
- Guided body-measurement entry plus iPhone 15 Pro Max LiDAR / TrueDepth import and validation
- Local-only clinical photo intake with real resolution, exposure, contrast, and sharpness-signal checks
- Per-patient and whole-vault JSON backup exports
- Medical-only source registry without project download controls

## Real machine learning

The application distinguishes actual execution from fallback:

- Free browser-side ONNX embedding: `Xenova/multilingual-e5-small` via Transformers.js
- Optional hosted multilingual embedding: `intfloat/multilingual-e5-large`
- Optional hosted medical embedding: `sentence-transformers/embeddinggemma-300m-medical`
- Optional Vercel AI Gateway extraction and evidence-grounded bilingual synthesis

Similarity values are retrieval scores, not disease probabilities. If a model is unavailable, the UI states that deterministic or lexical fallback was used. The preserved Naive Bayes path is labelled as a legacy research comparison and is not represented as a validated clinical model.

## Full medical knowledge bundle

The following official HPO release has already been synchronized into `data/`:

- release: `v2026-06-23`
- 19,837 HPO terms
- 12,956 phenotype-to-disease annotation records
- negative HPOA annotations excluded from positive disease overlap

Refresh it with:

```powershell
npm run sync:knowledge
npm run check:knowledge
```

The generated files are committed/deployed as source data; Vercel does not need to download HPO at runtime.

## Patient records and repository boundary

The repository contains the application code and patient-vault implementation. It never contains real patient records. Named patient records use IndexedDB in the current browser, automatically save clinical context, measurements, and assessment history, and can be exported as a user-controlled JSON backup. The patient name is not sent to `/api/analyze`.

This free default works on Vercel without a database key. It is device-specific and can be cleared by browser/site-data removal. Cross-device or multi-user clinical operation requires authentication, authorization, audit logging, encryption policy, and a compliant external database; the app does not imply those controls exist.

Sex selection is limited to `Male` or `Female`, as requested.

## iPhone 15 Pro Max ingestion

iOS Safari cannot expose raw ARKit or LiDAR APIs directly to a website. The normal workflow no longer requires JSON:

1. Measure only the required dimension with the iPhone Measure app, a tape/ruler, or an appropriate clinical instrument.
2. Enter the value beside its visible unit in the guided measurement screen.
3. Select **Save entered measurements**. Values then auto-save to the active patient record on that device.

The advanced companion workflow remains available:

1. Use the preserved native Swift companion to capture supported ARKit, LiDAR, and TrueDepth geometry.
2. Export the versioned JSON contract through Files or the iOS Share Sheet.
3. Select the exported file in Safari; no manual JSON editing is required.
4. The app validates and normalizes it, then saves accepted values to the active local patient record.

USDZ and PLY files may be selected for session metadata, but this web app does not pretend to clinically interpret a 3D mesh. Measurement geometry is approximate and must be confirmed with appropriate clinical instruments.

## Clinical photo intake

The photo workflow accepts JPEG, PNG, or WebP up to 6 MB and performs real technical image-quality checks locally. After a per-upload consent checkbox, it can send the image and up to 4,000 characters of symptom context once to the configured vision model through Vercel AI Gateway. The application does not persist the payload. The model returns structured visible-feature observations and safety routing, not a confirmed diagnosis. If the model is unavailable, no findings are fabricated.

## Medical knowledge sources

The visible registry includes HPO, MedlinePlus/NLM, WHO Unified Medical Dictionary, RxNorm, DailyMed, USDA FoodData Central, Dietary Guidelines for Americans, NIH Office of Dietary Supplements, Cummings Otolaryngology, Scott-Brown’s Otorhinolaryngology, AAO-HNS guidelines, NICE CKS, and the original structured ENT knowledge base.

## Local run

```powershell
Copy-Item .env.example .env.local
npm install
npm run check:knowledge
npm run dev
```

Open `http://localhost:3000`.

## Validation commands

```powershell
npm run typecheck
npm test
npm audit --audit-level=high
npm run check:knowledge
npm run build
```

The original Python engine remains independently testable:

```powershell
Set-Location ..\1
python -X utf8 test_ent_assistant.py
```

## Privacy and safety

- Named patient records are stored in IndexedDB on the current browser/device and are never committed to Git.
- `/api/analyze` is stateless and uses `no-store`.
- No server-side patient database or persistence API is included.
- Server-owned keys belong in Vercel environment variables.
- External inference may receive submitted text only when the corresponding key is configured.
- Production handling of identifiable health information still requires a formal privacy policy, consent, security, clinical governance, and jurisdiction-specific compliance review.

## Important limitations

This software cannot contain all medical knowledge, diagnose every condition, exclude serious illness, prescribe treatment, or replace clinical examination and testing. Nutrition output is educational; it does not infer deficiency, prescribe therapeutic diets, or recommend supplement doses.
