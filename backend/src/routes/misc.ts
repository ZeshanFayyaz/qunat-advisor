import { Router } from "express";
import productsJson from "../data/products.json" with { type: "json" };
import bundlesJson from "../data/bundles.json" with { type: "json" };
import { logger } from "../lib/logger.js";

export const productsRouter = Router();
productsRouter.get("/", (_req, res) => {
  const pub = productsJson.map((p) => ({
    slug: p.slug,
    name: p.name,
    shopify_handle: p.shopify_handle,
    one_line: p.one_line,
    hero_ingredients: p.hero_ingredients,
    caution: p.caution,
    // price + image live-fetched from Shopify at /api/advise time
  }));
  res.json({ products: pub });
});

export const bundlesRouter = Router();
bundlesRouter.get("/", (_req, res) => {
  res.json({ bundles: bundlesJson });
});

export const feedbackRouter = Router();
feedbackRouter.post("/", (req, res) => {
  const { session_id, rating, slug, classification, comment } = req.body ?? {};
  logger.info("feedback", {
    session_id,
    rating,
    slug,
    top: classification?.concerns?.[0],
    comment: typeof comment === "string" ? comment.slice(0, 400) : undefined,
  });
  res.json({ ok: true });
});

export const healthRouter = Router();
healthRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    mode: process.env.MODE === "live" ? "live" : "demo",
    timestamp: new Date().toISOString(),
  });
});
