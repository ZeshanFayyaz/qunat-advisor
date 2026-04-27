import { Router } from "express";
import multer from "multer";
import { processImage } from "../lib/image.js";
import { callClassifier, callGenerator, isLive } from "../lib/anthropic.js";
import {
  fallbackRecommendation,
  mockClarify,
  mockClassify,
  mockMedicalCaution,
  mockProductQA,
  mockRecommend,
  mockRedirect,
} from "../lib/mock.js";
import { decideMode, GeneratorMode } from "../lib/routing.js";
import { deriveSkinProfile } from "../lib/skinProfile.js";
import {
  Classification,
  ClarifySchema,
  ClassificationSchema,
  ProductQASchema,
  QuizAnswers,
  QuizAnswersSchema,
  RecommendSchema,
  RedirectSchema,
  SkinProfile,
} from "../schemas/index.js";
import { CLASSIFIER_SYSTEM_PROMPT } from "../prompts/classifier.js";
import { RECOMMEND_SYSTEM_PROMPT } from "../prompts/recommend.js";
import { CLARIFY_SYSTEM_PROMPT } from "../prompts/clarify.js";
import { PRODUCT_QA_SYSTEM_PROMPT } from "../prompts/product_qa.js";
import {
  REDIRECT_SYSTEM_PROMPT,
  STATIC_MEDICAL_CAUTION,
  STATIC_OFF_TOPIC,
} from "../prompts/redirect.js";
import productsJson from "../data/products.json" with { type: "json" };
import bundlesJson from "../data/bundles.json" with { type: "json" };
import { logger } from "../lib/logger.js";
import { fetchShopifyProducts } from "../lib/shopify.js";

type Product = (typeof productsJson)[number];
type Bundle = (typeof bundlesJson)[number];

const productMap = new Map<string, Product>(productsJson.map((p) => [p.slug, p]));
const bundleMap = new Map<string, Bundle>(bundlesJson.map((b) => [b.slug, b]));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const adviseRouter = Router();

adviseRouter.post("/", upload.single("image"), async (req, res) => {
  const started = Date.now();
  try {
    const userText = typeof req.body.text === "string" ? req.body.text.slice(0, 1500) : "";
    const priorClassification: Classification | null = req.body.prior_classification
      ? safeParseJSON(req.body.prior_classification)
      : null;
    const clarifyAnswers: string[] =
      Array.isArray(req.body.clarify_answers)
        ? req.body.clarify_answers.slice(0, 3)
        : typeof req.body.clarify_answers === "string"
          ? safeParseJSON(req.body.clarify_answers) ?? []
          : [];

    // Quiz answers
    const quizRaw = req.body.quiz ? safeParseJSON(req.body.quiz) : null;
    const quiz: QuizAnswers | null = quizRaw
      ? QuizAnswersSchema.safeParse(quizRaw).success
        ? quizRaw
        : null
      : null;
    const profile: SkinProfile = deriveSkinProfile(quiz);

    // STEP 1 — classify
    let classification: Classification;
    if (priorClassification && clarifyAnswers.length > 0) {
      classification = reclassifyWithAnswers(priorClassification, clarifyAnswers);
    } else {
      const image = req.file ? await processImage(req.file.buffer) : null;

      // The classifier sees raw user text + clarify answers only.
      // Profile metadata (skin type, Fitzpatrick, etc.) is reserved for the generator —
      // mixing it into classifier text biases concern detection (e.g. "dry" leaks in).
      const combinedText = [userText, ...clarifyAnswers].filter(Boolean).join(" | ");

      if (isLive()) {
        classification = await callClassifier(
          CLASSIFIER_SYSTEM_PROMPT,
          combinedText,
          image ? { base64: image.base64, mediaType: image.mediaType } : null,
          ClassificationSchema
        );
      } else {
        classification = mockClassify(combinedText, !!image);
      }
    }

    // Merge specific_concerns from quiz into classification if they're not already present
    if (quiz?.specific_concerns?.length) {
      classification = mergeQuizConcerns(classification, quiz.specific_concerns);
    }

    // STEP 2 — route
    let mode = decideMode(classification);

    // Sales-bot guarantee #1: never clarify twice. If the user already answered
    // clarify questions, force a recommendation regardless of confidence.
    if (mode === "clarify" && clarifyAnswers.length > 0) {
      mode = "recommend";
    }

    // Sales-bot guarantee #1b: even on first turn, if classifier has zero
    // usable signal (no concerns), don't ask for clarification — serve the
    // safe defaults. Better to give a generic answer than to seem confused.
    let usedFallback = false;
    if (mode === "clarify" && classification.concerns.length === 0) {
      mode = "recommend";
      usedFallback = true;
    }

    // Sales-bot guarantee #2: never refuse. redirect / medical_caution become
    // a fallback recommendation with the soft "complicated than most" framing
    // and an Instagram CTA.
    if (mode === "redirect" || mode === "medical_caution") {
      mode = "recommend";
      usedFallback = true;
    }

    // STEP 3 — generate (with 7.5s timeout safety net)
    let payload: any;
    try {
      if (usedFallback) {
        payload = fallbackRecommendation(profile);
      } else {
        payload = await Promise.race([
          generate(mode, classification, userText, profile),
          new Promise((_resolve, reject) =>
            setTimeout(() => reject(new Error("generate_timeout")), 7500)
          ),
        ]);
      }
    } catch (err: any) {
      logger.warn("generate_failed_using_fallback", {
        error: err?.message,
        mode,
        live: isLive(),
      });
      payload = fallbackRecommendation(profile);
      mode = "recommend";
    }

    // STEP 4 — enrich with catalog metadata
    const enriched = enrichWithCatalog(payload);

    // STEP 5 — enrich with live Shopify data (prices, images, discounts)
    const withLive = await enrichWithShopifyLive(enriched);

    const ms = Date.now() - started;
    logger.info("advise", {
      ms,
      mode,
      top: classification.concerns[0],
      intent: classification.intent,
      image_quality: classification.image_quality,
      had_image: !!req.file,
      had_quiz: !!quiz,
      skin_type: profile.skin_type,
      reactivity: profile.reactivity,
      fitzpatrick: profile.fitzpatrick,
      live: isLive(),
    });

    res.json({
      mode,
      classification,
      profile,
      response: withLive,
    });
  } catch (err: any) {
    logger.error("advise_error", { error: err?.message, stack: err?.stack });
    // Sales-bot guarantee #3: even on catastrophic failure, serve a fallback
    // recommendation. The user never sees "we couldn't help you."
    const profile = deriveSkinProfile(null);
    const fallback = fallbackRecommendation(profile);
    res.status(200).json({
      mode: "recommend",
      classification: null,
      profile,
      response: fallback,
    });
  }
});

async function generate(
  mode: GeneratorMode,
  classification: Classification,
  userText: string,
  profile: SkinProfile
) {
  switch (mode) {
    case "medical_caution":
      return isLive()
        ? await callGenerator(REDIRECT_SYSTEM_PROMPT, classification, RedirectSchema)
        : STATIC_MEDICAL_CAUTION;

    case "redirect":
      return STATIC_OFF_TOPIC;

    case "clarify":
      return isLive()
        ? await callGenerator(CLARIFY_SYSTEM_PROMPT, classification, ClarifySchema)
        : mockClarify(classification);

    case "product_qa":
      return isLive()
        ? await callGenerator(
            PRODUCT_QA_SYSTEM_PROMPT,
            { ...classification, user_question: userText },
            ProductQASchema
          )
        : mockProductQA(userText);

    case "recommend":
      return isLive()
        ? await callGenerator(
            RECOMMEND_SYSTEM_PROMPT,
            { classification, profile },
            RecommendSchema
          )
        : mockRecommend(classification, profile);
  }
}

/**
 * Hydrate slugs with real product/bundle data for the frontend.
 */
function enrichWithCatalog(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const p = payload as any;

  const enrichProductSlot = (slot: any) => {
    if (!slot || !slot.slug) return slot;
    const prod = productMap.get(slot.slug);
    if (!prod) return slot;
    return {
      ...slot,
      product: {
        slug: prod.slug,
        name: prod.name,
        shopify_handle: prod.shopify_handle,
        one_line: prod.one_line,
        hero_ingredients: prod.hero_ingredients,
        caution: prod.caution,
        // price + image populated by enrichWithShopifyLive
      },
    };
  };

  const enrichBundleSlot = (slot: any) => {
    if (!slot || !slot.slug) return slot;
    const bundle = bundleMap.get(slot.slug);
    if (!bundle) return slot;
    const products = bundle.products
      .map((s) => productMap.get(s))
      .filter(Boolean)
      .map((prod) => ({
        slug: prod!.slug,
        name: prod!.name,
        shopify_handle: prod!.shopify_handle,
      }));
    return {
      ...slot,
      bundle: {
        slug: bundle.slug,
        name: bundle.name,
        tagline: bundle.tagline,
        shopify_handle: bundle.shopify_handle,
        is_hero: (bundle as any).is_hero ?? false,
        is_all_in: (bundle as any).is_all_in ?? false,
        is_double_cleanse: (bundle as any).is_double_cleanse ?? false,
        positioning: bundle.positioning,
        why: bundle.why,
        products,
        // price_before, price_after, discount_pct populated by enrichWithShopifyLive
      },
    };
  };

  if (p.mode === "recommend") {
    return {
      ...p,
      primary_product: enrichProductSlot(p.primary_product),
      supporting_products: Array.isArray(p.supporting_products)
        ? p.supporting_products.map(enrichProductSlot)
        : [],
      bundle: enrichBundleSlot(p.bundle),
      secondary_bundle: enrichBundleSlot(p.secondary_bundle),
    };
  }

  if (p.mode === "product_qa" && p.cta) {
    return { ...p, cta: enrichProductSlot(p.cta) };
  }

  return p;
}

/**
 * Walk the payload, collect every shopify_handle referenced, fetch them all in parallel,
 * and merge live price/image/discount fields into each slot.
 */
async function enrichWithShopifyLive(payload: unknown): Promise<unknown> {
  if (!payload || typeof payload !== "object") return payload;
  const p = payload as any;

  // Collect all handles we'll need live data for
  const handles: string[] = [];
  const push = (h?: string) => { if (h) handles.push(h); };

  if (p.mode === "recommend") {
    push(p.primary_product?.product?.shopify_handle);
    if (Array.isArray(p.supporting_products)) {
      p.supporting_products.forEach((s: any) => push(s.product?.shopify_handle));
    }
    if (p.bundle?.bundle) {
      push(p.bundle.bundle.shopify_handle);
      if (Array.isArray(p.bundle.bundle.products)) {
        p.bundle.bundle.products.forEach((pp: any) => push(pp.shopify_handle));
      }
    }
    if (p.secondary_bundle?.bundle) {
      push(p.secondary_bundle.bundle.shopify_handle);
      if (Array.isArray(p.secondary_bundle.bundle.products)) {
        p.secondary_bundle.bundle.products.forEach((pp: any) => push(pp.shopify_handle));
      }
    }
  } else if (p.mode === "product_qa" && p.cta?.product) {
    push(p.cta.product.shopify_handle);
  }

  if (handles.length === 0) return p;

  const live = await fetchShopifyProducts(handles);

  // Helper to merge live fields into a product slot
  const mergeProduct = (prod: any) => {
    if (!prod?.shopify_handle) return prod;
    const lv = live[prod.shopify_handle];
    if (!lv) return prod;
    return {
      ...prod,
      price: lv.price_formatted,
      price_raw: lv.price,
      compare_at_price: lv.compare_at_price_formatted,
      discount_pct: lv.discount_pct,
      currency: lv.currency,
      image: lv.image ?? prod.image ?? null,
      available: lv.available,
    };
  };

  if (p.mode === "recommend") {
    const out = { ...p };
    if (out.primary_product?.product) {
      out.primary_product = {
        ...out.primary_product,
        product: mergeProduct(out.primary_product.product),
      };
    }
    if (Array.isArray(out.supporting_products)) {
      out.supporting_products = out.supporting_products.map((s: any) => ({
        ...s,
        product: mergeProduct(s.product),
      }));
    }
    if (out.bundle?.bundle) {
      const bundleLive = live[out.bundle.bundle.shopify_handle];
      out.bundle = {
        ...out.bundle,
        bundle: {
          ...out.bundle.bundle,
          price_after: bundleLive?.price_formatted ?? null,
          price_before: bundleLive?.compare_at_price_formatted ?? null,
          discount_pct: bundleLive?.discount_pct ?? null,
          image: bundleLive?.image ?? out.bundle.bundle.image ?? null,
          available: bundleLive?.available ?? true,
          products: out.bundle.bundle.products.map(mergeProduct),
        },
      };
    }
    if (out.secondary_bundle?.bundle) {
      const sbLive = live[out.secondary_bundle.bundle.shopify_handle];
      out.secondary_bundle = {
        ...out.secondary_bundle,
        bundle: {
          ...out.secondary_bundle.bundle,
          price_after: sbLive?.price_formatted ?? null,
          price_before: sbLive?.compare_at_price_formatted ?? null,
          discount_pct: sbLive?.discount_pct ?? null,
          image: sbLive?.image ?? out.secondary_bundle.bundle.image ?? null,
          available: sbLive?.available ?? true,
          products: out.secondary_bundle.bundle.products.map(mergeProduct),
        },
      };
    }
    return out;
  }

  if (p.mode === "product_qa" && p.cta?.product) {
    return {
      ...p,
      cta: { ...p.cta, product: mergeProduct(p.cta.product) },
    };
  }

  return p;
}

function mergeQuizConcerns(c: Classification, specificConcerns: string[]): Classification {
  // Map user-facing concern labels to taxonomy labels
  const map: Record<string, string> = {
    "Active breakouts / Acne": "acne_inflammatory",
    "Dark spots / Hyperpigmentation": "post_acne_marks",
    "Fine lines and wrinkles": "fine_lines_early_aging",
    "Redness / Visible capillaries": "redness_sensitivity",
    "Blackheads / Clogged pores": "acne_comedonal",
    "Dullness / Lack of \"glow\"": "dullness_uneven_tone",
    "Dullness / Lack of glow": "dullness_uneven_tone",
  };

  const newConcerns = [...c.concerns];
  for (const label of specificConcerns) {
    const mapped = map[label];
    if (!mapped) continue;
    const existing = newConcerns.find((x) => x.label === mapped);
    if (existing) {
      existing.confidence = Math.min(1, existing.confidence + 0.15);
    } else {
      newConcerns.push({ label: mapped as any, confidence: 0.75 });
    }
  }
  newConcerns.sort((a, b) => b.confidence - a.confidence);

  // If user selected concerns but intent was off-topic/product-qa, keep the original intent.
  // Only promote to concern_match when we had no concerns before.
  const intent =
    c.intent === "concern_match" || c.concerns.length === 0 ? "concern_match" : c.intent;

  return {
    ...c,
    intent,
    concerns: newConcerns.slice(0, 4),
  };
}

function reclassifyWithAnswers(prior: Classification, answers: string[]): Classification {
  const ans = answers.join(" ").toLowerCase();
  const updated = { ...prior, concerns: [...prior.concerns] };

  const bump = (label: string, amount: number) => {
    const idx = updated.concerns.findIndex((c) => c.label === label);
    if (idx === -1) {
      updated.concerns.push({ label: label as any, confidence: Math.min(1, 0.5 + amount) });
    } else {
      updated.concerns[idx] = {
        ...updated.concerns[idx],
        confidence: Math.max(0, Math.min(1, updated.concerns[idx].confidence + amount)),
      };
    }
  };

  if (ans.includes("overall dull")) bump("dullness_uneven_tone", 0.35);
  if (ans.includes("specific dark")) bump("post_acne_marks", 0.35);
  if (ans.includes("both")) {
    bump("dullness_uneven_tone", 0.2);
    bump("post_acne_marks", 0.25);
  }
  if (ans.includes("breakouts") || ans.includes("pimple")) bump("acne_inflammatory", 0.35);
  if (ans.includes("dark spots") || ans.includes("pigmentation")) bump("post_acne_marks", 0.3);
  if (ans.includes("dryness") || ans.includes("dry")) bump("dryness_barrier", 0.35);
  if (ans.includes("dullness")) bump("dullness_uneven_tone", 0.3);
  if (ans.includes("fine lines")) bump("fine_lines_early_aging", 0.35);

  updated.concerns.sort((a, b) => b.confidence - a.confidence);
  updated.concerns = updated.concerns.slice(0, 3);
  return updated;
}

function safeParseJSON<T = any>(s: string): T | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
