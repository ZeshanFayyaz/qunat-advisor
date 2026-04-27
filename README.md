# Qunat Beauty — AI Skin Advisor

Local-demoable, Shopify-ready implementation.

## Flow

1. **Intro** — three equal paths in a tab picker:
   - **Picture** — camera capture or upload with sample-photo guidance modal
   - **Own Words** — free-text hero textarea for narrative descriptions
   - **Tags** — quick-tap concern chips
   Any combination works. Always-visible Instagram consultation CTA at the bottom for significant concerns.
2. **Quiz** — 6-question assessment in 3 sections (Skin Type / Sensitivity / Sun Response) + concerns multi-select + routine commitment.
3. **Processing** (rotating serif-italic copy).
4. **Result** — sales-oriented layout:
   - **MATCHA15 banner** at the top (when applicable) — prominent conversion surface
   - **Description** — skin profile badge + observational opener
   - **Bundle card** (hero) — strikethrough pricing, one-click shop-the-bundle
   - **— or —** divider
   - **Individual products** — compact list, each with its own "Shop X — $Price →" CTA
   - **Usage** — consolidated routine + timing table + pH + frequency warnings + SPF
   - **Instagram CTA** (if severity:significant was flagged)
   - Feedback + restart

**Clarify mode** supports both chip selections AND free-text clarifications ("+ None of these fit — let me describe it") for when the AI is genuinely confused.

## Business rules wired

- **Sensitive filter**: reactivity:sensitive/reactive or Q3="stings/burns" or Q4="flushes easily" → blocks GlycoGommage, swaps texture-reset/pre-makeup bundles for barrier-reset, adds low-frequency warning to AzelaiK ("start 2–3 nights/week, patch test first")
- **Bundle matcher**:
  - acne + PIH → `clarity-blueprint`
  - Melasma / sun-damage + Fitzpatrick IV+ → `pigmentation-protocol`
  - Sensitive / barrier / redness → `barrier-reset-essentials`
  - Dehydration → `hydration-essentials`
  - Oily / comedonal → `oil-control-essentials`
  - Rough texture (non-sensitive) → `texture-reset-kit`
- **Brightening duo reasoning** for pigmentation: NiAbutin C (AM) + Tranexamilk (PM) baked into `routine_note` explaining timing prevents irritation
- **Double cleanse rule**: always either the Double Cleanse Set bundle (25% off) OR a MATCHA15 upsell block
- **Routine size cap**: 1-2 → primary only, 3-4 → +1 support, 5+ → +2
- **Instagram consultation** fires on severity:significant and medical caution

## Run the demo locally (60s)

```bash
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
npm run dev
```

Opens at **http://localhost:5173**. Backend on :8787 in demo mode (no API key needed).

## Go live with Anthropic

```bash
cp backend/.env.example backend/.env
# Set MODE=live and ANTHROPIC_API_KEY=sk-ant-...
```

Restart backend. Frontend unchanged. Classifier + generator swap from mock heuristics to Claude Sonnet 4.5.

## Ship to Shopify

```bash
cd frontend && npm run build
cp dist/advisor.iife.js dist/advisor.css ../shopify-extension/assets/
cd ../shopify-extension && shopify app deploy
```

Then in the theme editor, add the **Skin Advisor** block and set the Backend API URL field. See `shopify-extension/README.md` for the full checklist.

## Run the gold-set eval

```bash
# With the backend running on :8787
cd backend && npx tsx ../eval/run.ts http://localhost:8787
```

27 cases, 100% passing in demo mode. Exercises every business rule.

## Layout

```
qunat-advisor/
├─ backend/               Express + Anthropic + Zod, demo-mode fallback
│  ├─ src/
│  │  ├─ data/            products.json, bundles.json
│  │  ├─ schemas/         Zod output contracts (enriched with quiz + profile + bundle)
│  │  ├─ prompts/         5 production prompts (classifier, recommend, clarify, product_qa, redirect)
│  │  ├─ lib/             anthropic, mock, skinProfile deriver, image, routing, logger
│  │  ├─ config/          routing thresholds
│  │  └─ routes/          advise orchestrator, products, bundles, feedback, health
├─ frontend/              Preact + Vite → single IIFE bundle
│  ├─ src/
│  │  ├─ components/      IntroState (free-text hero), QuizState, ProcessingState,
│  │  │                   ClarifyState, RecommendState (rich report), ProductQAState,
│  │  │                   RedirectState, SamplePhotosModal
│  │  ├─ state/           useReducer state machine (intro → quiz → processing → result)
│  │  ├─ lib/             types, api, cart, analytics, imageProcess
│  │  └─ styles.css       Fraunces + DM Sans monochrome + olive accent
├─ shopify-extension/     Theme App Extension block + deploy README
└─ eval/                  Gold-set runner + 27 cases
```
