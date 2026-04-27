# Qunat Skin Advisor — Shopify Deployment

This folder is a **Shopify Theme App Extension** that drops the advisor into any page on your storefront via the theme editor.

## Prereqs

- Shopify Partner account + an app created in the Partner Dashboard.
- Shopify CLI installed: `npm install -g @shopify/cli @shopify/app`.
- Your advisor backend deployed somewhere public (see `../backend/README.md` for options — Vercel, Fly, Railway, Render, Cloudflare Workers).

## Deployment steps

```bash
# 1. Build the frontend bundle
cd ../frontend
npm install
npm run build
# This emits frontend/dist/advisor.iife.js and frontend/dist/advisor.css.

# 2. Copy the built assets into the extension
mkdir -p ../shopify-extension/assets
cp dist/advisor.iife.js ../shopify-extension/assets/
cp dist/advisor.css ../shopify-extension/assets/

# 3. Link the extension to your Shopify app
cd ../shopify-extension
shopify app dev     # for testing on a dev store
shopify app deploy  # for production

# 4. In the Shopify theme editor, add the "Skin Advisor" block
#    to any page (homepage, product page, or a dedicated /pages/skin-advisor).
#    Set the "Backend API URL" field to your deployed backend URL.
```

## Backend URL configuration

The Liquid block exposes a single merchant-editable setting — `Backend API URL`. Paste the URL of your deployed backend (e.g. `https://advisor-api.qunatbeauty.com`) and the frontend bundle automatically routes all `/api/*` calls there.

No API keys are ever shipped to the browser.

## Rebuilding on frontend changes

```bash
cd frontend && npm run build
cp dist/advisor.iife.js dist/advisor.css ../shopify-extension/assets/
cd ../shopify-extension && shopify app deploy
```

Or script it:

```bash
# From the repo root
npm run build:frontend \
  && cp frontend/dist/advisor.iife.js shopify-extension/assets/ \
  && cp frontend/dist/advisor.css shopify-extension/assets/ \
  && cd shopify-extension && shopify app deploy
```

## CORS — whitelist your Shopify domains in the backend

In `backend/.env`, set:

```
ALLOWED_ORIGINS=https://qunatbeauty.com,https://*.myshopify.com,https://your-dev-store.myshopify.com
```

The backend's CORS middleware supports `*` wildcards in patterns.

## Minimal production checklist

- [ ] Backend deployed with `MODE=live` and valid `ANTHROPIC_API_KEY`
- [ ] `ALLOWED_ORIGINS` includes your Shopify storefront domain
- [ ] Frontend built and assets copied into `shopify-extension/assets/`
- [ ] Extension deployed via `shopify app deploy`
- [ ] Block added to a page in the theme editor with the backend URL configured
- [ ] Smoke test: submit a real photo on the live site, verify recommendation renders and "Build the routine" adds to cart
