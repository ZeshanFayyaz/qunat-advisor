import { Classification } from "../schemas/index.js";
import { routing } from "../config/routing.js";

export type GeneratorMode =
  | "recommend"
  | "clarify"
  | "product_qa"
  | "redirect"
  | "medical_caution";

export function decideMode(c: Classification): GeneratorMode {
  // Explicit intents win
  if (c.intent === "medical" || c.control_flags.medical_caution >= routing.medicalCautionThreshold) {
    return "medical_caution";
  }
  if (c.intent === "off_topic" || c.control_flags.out_of_scope >= routing.outOfScopeThreshold) {
    return "redirect";
  }
  if (c.intent === "product_qa" || c.intent === "routine_question") {
    return "product_qa";
  }

  // Concern-match routing
  const sorted = [...c.concerns].sort((a, b) => b.confidence - a.confidence);
  const top = sorted[0];
  const second = sorted[1];

  if (!top) return "clarify";

  // Disagreement between image and text -> always clarify
  if (c.disagreement) return "clarify";

  // Unusable image lowers our trust for purely visual concerns
  const imageUnusable =
    c.image_quality !== "usable" && c.image_quality !== "no_image";

  // High-confidence single concern
  if (
    top.confidence >= routing.highSingleTop &&
    (!second || second.confidence < routing.highSingleSecondCeiling) &&
    !imageUnusable
  ) {
    return "recommend";
  }

  // High-confidence dual concern
  if (
    top.confidence >= routing.highDualTop &&
    second &&
    second.confidence >= routing.highDualTop &&
    (sorted[2]?.confidence ?? 0) < routing.highDualThirdCeiling
  ) {
    return "recommend";
  }

  // Ambiguous between top two -> clarify
  if (
    top.confidence >= routing.minTopForRecommend &&
    second &&
    top.confidence - second.confidence < routing.ambiguousDelta
  ) {
    return "clarify";
  }

  // Below minimum -> clarify
  if (top.confidence < routing.minTopForRecommend) {
    return "clarify";
  }

  // Mid-confidence single concern (0.55–0.79) without a qualifying dual -> clarify.
  // This matches the blueprint: only high-confidence single (>=0.80) goes straight to recommend.
  if (top.confidence < routing.highSingleTop) {
    return "clarify";
  }

  // Single concern above high-single threshold but we landed here because the second
  // concern was close; be cautious if the image is unusable.
  return imageUnusable ? "clarify" : "recommend";
}
