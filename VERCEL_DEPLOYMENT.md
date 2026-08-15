# Vercel Deployment

## Build settings

- Framework: Next.js
- Root directory: `2` when deploying from the parent repository
- Install command: `npm install`
- Build command: `npm run build`
- Output: Next.js default
- `/api/analyze` maximum duration: 60 seconds

The synchronized HPO files are included in `data/`; no build-time knowledge download is required.

## Environment variables

Optional real hosted neural retrieval:

- `HF_TOKEN`
- `HF_MULTILINGUAL_EMBEDDING_MODEL=intfloat/multilingual-e5-large`
- `HF_MEDICAL_EMBEDDING_MODEL=sentence-transformers/embeddinggemma-300m-medical`

Optional Vercel AI Gateway language processing:

- `AI_GATEWAY_API_KEY`
- `AI_MODEL=openai/gpt-5.6-sol`
- `AI_VISION_MODEL` — explicitly select a vision-capable model ID available in your Gateway account

Official medical/food services:

- `MEDLINEPLUS_TOOL=bilingualMedicalDecisionSupport`
- `MEDLINEPLUS_EMAIL`
- `USDA_API_KEY` — optional data.gov key; without it the route uses USDA `DEMO_KEY` and may be rate limited

Knowledge pin:

- `HPO_RELEASE=v2026-06-23`

## Required pre-deployment verification

```powershell
npm install
npm run typecheck
npm test
npm audit --audit-level=high
npm run check:knowledge
npm run build
```

Verify `/api/health` after deployment. It reports whether full HPO, disease mapping, HF embeddings, and AI Gateway are actually configured.

## iOS compatibility

The Vercel web interface accepts versioned JSON selected through Safari, Files, or the iOS Share Sheet. Native ARKit capture remains in the preserved Swift companion. The server validates JSON statelessly and stores no patient measurement record.

## Production governance before clinical use

- Explicit privacy and provider-processing consent
- Authentication and authorization if patient-specific deployment is intended
- Rate limits, abuse controls, and request monitoring without raw PHI logging
- Provider DPA/BAA and regional compliance assessment
- Independent clinical validation and subgroup analysis
- Model/release monitoring with rollback
- Incident response and human escalation workflow
