import type { QuizAnswers, SkinProfile } from "../schemas/index.js";

/**
 * Derives a structured skin profile from quiz answers using deductive rules:
 *
 * Skin type:
 *   Q1 alone is the signal; Q2 refines.
 *   Shiny T-zone + tight cheeks → Combination (override).
 *
 * Reactivity:
 *   Stings/burns + flushes easily → reactive / sensitive filter active.
 *
 * Fitzpatrick:
 *   A = 0, B = 1, C = 2, D = 3, E = 4 for Q5 + Q6. Sum:
 *     0          → I
 *     1–2        → II
 *     3–4        → III
 *     5          → IV
 *     6          → V
 *     7–8        → VI
 *   (Max possible = 4 + 4 = 8 with the two-question setup.)
 *
 * High pigmentation risk:
 *   Fitzpatrick IV+ OR sum >= 5.
 */
export function deriveSkinProfile(q: QuizAnswers | null | undefined): SkinProfile {
  if (!q) {
    return {
      skin_type: null,
      reactivity: null,
      fitzpatrick: null,
      routine_size: null,
      sensitive_filter_active: false,
      high_pigmentation_risk: false,
    };
  }

  // -------- Skin type --------
  let skin_type: SkinProfile["skin_type"] = null;
  const feel = q.skin_feel_midday;
  const pores = q.pore_visibility;

  if (feel === "A") skin_type = "oily";
  else if (feel === "B") skin_type = "combination";
  else if (feel === "C") skin_type = "dry";
  else if (feel === "D") skin_type = "normal";

  // Deductive override: shiny T-zone + any pore signal suggesting combo reinforces it.
  // If user picks A (shiny everywhere) but Q2 says pores only on nose/chin → combination.
  if (feel === "A" && pores === "B") {
    skin_type = "combination";
  }

  // -------- Reactivity --------
  let reactivity: SkinProfile["reactivity"] = null;
  const reactionScore =
    q.reaction_to_products === "A" ? 0
    : q.reaction_to_products === "B" ? 1
    : q.reaction_to_products === "C" ? 3
    : q.reaction_to_products === "D" ? 2
    : -1;
  const flushScore =
    q.flushing_tendency === "A" ? 2
    : q.flushing_tendency === "B" ? 1
    : q.flushing_tendency === "C" ? 0
    : -1;

  if (reactionScore >= 0 || flushScore >= 0) {
    const combined = Math.max(reactionScore, 0) + Math.max(flushScore, 0);
    if (combined === 0) reactivity = "resilient";
    else if (combined <= 2) reactivity = "occasional";
    else if (combined <= 4) reactivity = "sensitive";
    else reactivity = "reactive";
  }

  // Sensitive filter: uses the dedicated overall_sensitivity question if answered,
  // otherwise falls back to inferring from reaction/flushing.
  // Mod-or-very-sensitive on Q-overall = hard block (per Qunat business rules).
  const sensitive_filter_active =
    q.overall_sensitivity === "A" ||
    q.overall_sensitivity === "B" ||
    q.reaction_to_products === "C" ||
    q.reaction_to_products === "D" ||
    q.flushing_tendency === "A";

  // -------- Fitzpatrick --------
  const toneScore =
    q.natural_tone === "A" ? 0
    : q.natural_tone === "B" ? 1
    : q.natural_tone === "C" ? 2
    : q.natural_tone === "D" ? 3
    : q.natural_tone === "E" ? 4
    : -1;
  const sunScore =
    q.sun_behavior === "A" ? 0
    : q.sun_behavior === "B" ? 1
    : q.sun_behavior === "C" ? 2
    : q.sun_behavior === "D" ? 3
    : q.sun_behavior === "E" ? 4
    : -1;

  let fitzpatrick: SkinProfile["fitzpatrick"] = null;
  let high_pigmentation_risk = false;
  if (toneScore >= 0 && sunScore >= 0) {
    const sum = toneScore + sunScore;
    if (sum === 0) fitzpatrick = "I";
    else if (sum <= 2) fitzpatrick = "II";
    else if (sum <= 4) fitzpatrick = "III";
    else if (sum === 5) fitzpatrick = "IV";
    else if (sum === 6) fitzpatrick = "V";
    else fitzpatrick = "VI";
    high_pigmentation_risk = sum >= 5;
  }

  return {
    skin_type,
    reactivity,
    fitzpatrick,
    routine_size: q.routine_commitment ?? null,
    sensitive_filter_active,
    high_pigmentation_risk,
  };
}

/**
 * Format the profile into a human-readable one-liner for the result card.
 * e.g. "Combination / Sensitive / Type IV"
 */
export function formatSkinProfileLine(p: SkinProfile): string {
  const parts: string[] = [];
  if (p.skin_type) parts.push(capitalize(p.skin_type));
  if (p.reactivity) parts.push(capitalize(p.reactivity));
  if (p.fitzpatrick) parts.push(`Type ${p.fitzpatrick}`);
  return parts.join(" / ") || "Your skin profile";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
