/**
 * Routing thresholds from Section 4 of the blueprint.
 * Tunable without redeploy by moving to a remote config later.
 */
export const routing = {
  // High-confidence single concern: top >= 0.80 AND second < 0.50
  highSingleTop: 0.8,
  highSingleSecondCeiling: 0.5,

  // High-confidence dual: top two >= 0.70 AND third < 0.45
  highDualTop: 0.7,
  highDualThirdCeiling: 0.45,

  // Below this on top label => clarify
  minTopForRecommend: 0.55,

  // Ambiguous when top two are within this delta
  ambiguousDelta: 0.15,

  // Control flags
  outOfScopeThreshold: 0.7,
  medicalCautionThreshold: 0.5,
} as const;
