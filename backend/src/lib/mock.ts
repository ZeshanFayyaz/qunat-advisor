/**
 * Demo-mode logic. Mirrors the live path's outputs so the frontend can't tell
 * which mode it's in. All business rules from the brief live here:
 *
 *  - Sensitive filter: if reactivity = sensitive/reactive → prioritize barrier,
 *    block high-% acids (GlycoGommage), add low-frequency warnings for AzelaiK.
 *  - Brightening duo: if severe pigmentation, AM/PM split reasoning.
 *  - Bundle matching: pick the most relevant bundle given the top concern(s).
 *  - Double cleanse rule: always either (a) recommend the double-cleanse-set
 *    bundle at 25% off, or (b) show a MATCHA15 upsell for MatchaMelt.
 *  - Instagram consultation: surfaced when severity = significant OR medical
 *    is adjacent but not triggered.
 *  - Routine size cap: if user said 1-2 → no supporting products beyond primary.
 */

import {
  Classification,
  Clarification,
  ProductQA,
  Recommendation,
  Redirect,
  SkinProfile,
} from "../schemas/index.js";

// ---------- helpers ----------

const kw = (text: string, list: string[]) => list.some((w) => text.includes(w));

function makeClassification(
  intent: Classification["intent"],
  concerns: Classification["concerns"],
  overrides: Partial<Classification> = {},
  text = ""
): Classification {
  return {
    intent,
    concerns,
    control_flags: { out_of_scope: 0, medical_caution: 0 },
    image_quality: overrides.image_quality ?? "no_image",
    disagreement: false,
    user_text_summary: text.slice(0, 360),
    reasoning_short: "(demo-mode heuristic)",
    severity_signal: overrides.severity_signal ?? "mild",
    ...overrides,
  };
}

// ---------- mock classifier ----------

export function mockClassify(userText: string, hasImage: boolean): Classification {
  const text = userText.trim().toLowerCase();
  const imageQuality = hasImage ? "usable" : "no_image";

  // Medical caution triggers
  if (
    kw(text, [
      "mole",
      "changing",
      "bleeding",
      "wound",
      "infection",
      "swollen",
      "allergic",
      "reaction",
      "prescription",
      "accutane",
      "isotretinoin",
      "skin cancer",
      "lesion",
    ])
  ) {
    return makeClassification(
      "medical",
      [],
      {
        control_flags: { out_of_scope: 0.05, medical_caution: 0.95 },
        image_quality: imageQuality,
        reasoning_short: "(demo) medical keywords present",
      },
      userText
    );
  }

  // Off-topic
  if (
    kw(text, [
      "ordinary",
      "cerave",
      "shampoo",
      "hair",
      "weather",
      "joke",
      "recipe",
      "code",
      "javascript",
      "coupon",
      "discount code",
      "lipstick",
      "mascara",
    ]) ||
    (text.length > 0 && kw(text, ["vs your", "versus your", "compared to"]))
  ) {
    return makeClassification(
      "off_topic",
      [],
      {
        control_flags: { out_of_scope: 0.9, medical_caution: 0 },
        image_quality: imageQuality,
      },
      userText
    );
  }

  // Product Q&A
  if (
    kw(text, [
      "what's in",
      "whats in",
      "ingredients in",
      "how do i use",
      "how should i use",
      "can i use",
      "is your",
      "does your",
      "ph of",
      "sting",
      "routine order",
    ])
  ) {
    return makeClassification(
      "product_qa",
      [],
      { image_quality: imageQuality },
      userText
    );
  }

  // Concern heuristics
  const concerns: Classification["concerns"] = [];

  const hasAcneInflamm =
    kw(text, ["pimple", "break out", "break-out", "zit", "cyst", "red bumps", "painful", "inflamed", "acne"]) ||
    // Explicit active-acne phrasing — wins even if leftover/old is also present
    /\b(have|getting|i get|keep getting)\s+\w*\s*breakouts?\b/.test(text) ||
    (/\bbreakouts?\b/.test(text) &&
      !/\b(old|past|leftover|marks?\s+(from|of)|scars?\s+(from|of))\b/.test(text));
  const hasAcneComedonal = kw(text, ["blackhead", "whitehead", "clogged", "comedone", "congest"]);
  const hasPIH = kw(text, [
    "post-acne",
    "post acne",
    "marks from",
    "leftover marks",
    "red marks",
    "dark marks",
    "scars from acne",
  ]);
  const hasMelasma = kw(text, ["melasma", "mask of pregnancy", "patches"]);
  const hasSunSpots = kw(text, ["sun spot", "sun damage", "age spot"]);
  const hasPigmentation = kw(text, ["dark spot", "pigmentation", "hyperpigment", "uneven tone"]);
  const hasDullness = kw(text, ["dull", "tired", "lackluster", "no glow", "flat"]);
  const hasRough = kw(text, ["rough", "bumpy", "texture", "orange peel"]);
  const hasDehydration = kw(text, ["dehydrated", "drinks in", "plump", "tight skin"]);
  const hasDryness = kw(text, ["dry", "flaky", "peeling", "barrier"]);
  const hasOily = kw(text, ["oily", "shiny", "greasy", "t-zone", "t zone"]);
  const hasFineLines = kw(text, ["fine line", "wrinkle", "aging", "anti-aging", "crow", "plumper"]);
  const hasRedness = kw(text, ["red cheeks", "rosacea", "sensitive", "reactive"]);
  const hasMakeupRemoval =
    kw(text, ["makeup remover", "first cleanse", "spf off"]) ||
    /\bremove\b.*\b(makeup|spf)\b/.test(text) ||
    /\bcleans\w+\b.*\b(makeup|spf)\b/.test(text);

  if (hasAcneInflamm) concerns.push({ label: "acne_inflammatory", confidence: 0.88 });
  if (hasAcneComedonal) concerns.push({ label: "acne_comedonal", confidence: 0.82 });
  if (hasPIH) concerns.push({ label: "post_acne_marks", confidence: 0.85 });
  if (hasMelasma) concerns.push({ label: "melasma", confidence: 0.9 });
  if (hasSunSpots) concerns.push({ label: "sun_damage_pigmentation", confidence: 0.85 });
  if (hasPigmentation && !hasMelasma && !hasSunSpots && !hasPIH)
    concerns.push({ label: "post_acne_marks", confidence: 0.62 });
  if (hasRough) concerns.push({ label: "rough_texture", confidence: 0.83 });
  if (hasDryness) concerns.push({ label: "dryness_barrier", confidence: 0.87 });
  if (hasDehydration && !hasDryness) concerns.push({ label: "dehydration", confidence: 0.82 });
  if (hasOily) concerns.push({ label: "oiliness_congestion", confidence: 0.86 });
  if (hasFineLines) concerns.push({ label: "fine_lines_early_aging", confidence: 0.84 });
  if (hasRedness) concerns.push({ label: "redness_sensitivity", confidence: 0.82 });
  if (hasMakeupRemoval) concerns.push({ label: "makeup_removal_need", confidence: 0.9 });
  if (hasDullness && concerns.length === 0)
    concerns.push({ label: "dullness_uneven_tone", confidence: 0.58 });
  else if (hasDullness) concerns.push({ label: "dullness_uneven_tone", confidence: 0.55 });

  // Severity: strong words bump the signal
  let severity: "mild" | "moderate" | "significant" = "mild";
  if (
    kw(text, [
      "severe",
      "terrible",
      "awful",
      "so bad",
      "can't take",
      "desperate",
      "struggling",
      "nothing works",
      "out of control",
      "painful",
      "constantly",
      "cystic",
    ])
  ) {
    severity = "significant";
  } else if (kw(text, ["really", "very", "lots of", "a lot", "bothering me"])) {
    severity = "moderate";
  }

  // Empty input
  if (concerns.length === 0 && !hasImage && text.length === 0) {
    return makeClassification(
      "concern_match",
      [],
      { image_quality: "no_image", reasoning_short: "(demo) no input — clarify" },
      userText
    );
  }

  // Image-only
  if (concerns.length === 0 && hasImage) {
    concerns.push({ label: "acne_inflammatory", confidence: 0.72 });
    concerns.push({ label: "post_acne_marks", confidence: 0.45 });
  }

  if (concerns.length === 0) {
    return makeClassification(
      "concern_match",
      [{ label: "dullness_uneven_tone", confidence: 0.4 }],
      { image_quality: imageQuality },
      userText
    );
  }

  concerns.sort((a, b) => b.confidence - a.confidence);

  return makeClassification(
    "concern_match",
    concerns.slice(0, 3),
    { image_quality: imageQuality, severity_signal: severity },
    userText
  );
}

// ---------- mock generators ----------

/**
 * Bundle match rules. Returned bundle is subject to routine-size filtering
 * downstream.
 */
function pickBundle(c: Classification, profile: SkinProfile): {
  slug:
    | "the-full-qunat-routine"
    | "the-double-cleanse-routine"
    | "the-barrier-defense"
    | "skin-hydration-essentials"
    | "the-pigment-protocol"
    | "texture-reset";
  reason: string;
} | null {
  const top = c.concerns[0]?.label;
  const second = c.concerns[1]?.label;
  const third = c.concerns[2]?.label;

  // "All-in" signal — recommend Full Qunat Routine when skin is genuinely
  // multi-concern or user signaled high commitment. This is our premium push.
  const hasManyDistinctConcerns = [top, second, third].filter(Boolean).length >= 3;
  const wantsFullRoutine =
    profile.routine_size === "5+" ||
    (c.severity_signal === "significant" && hasManyDistinctConcerns);

  if (wantsFullRoutine) {
    return {
      slug: "the-full-qunat-routine",
      reason:
        "Your skin signaled more than one concern at once — and you're open to a proper protocol. The Full Qunat Routine is every formula in the line, sequenced to work together. Our deepest price.",
    };
  }

  // Severe pigmentation → Pigment Protocol (acne overlap handled here too,
  // since we don't have a separate acne+PIH bundle)
  const hasPigmentation =
    top === "post_acne_marks" ||
    top === "melasma" ||
    top === "sun_damage_pigmentation" ||
    second === "post_acne_marks" ||
    second === "melasma" ||
    second === "sun_damage_pigmentation";

  if (
    hasPigmentation &&
    (c.severity_signal === "moderate" ||
      c.severity_signal === "significant" ||
      profile.high_pigmentation_risk ||
      top === "acne_inflammatory" ||
      second === "acne_inflammatory")
  ) {
    return {
      slug: "the-pigment-protocol",
      reason:
        "Three actives working on different pathways — tranexamic acid, niacinamide + alpha arbutin + ascorbyl glucoside, and azelaic acid. Used on different days or times so they stack without irritating.",
    };
  }

  // Sensitive / barrier / redness → Barrier Defense
  if (
    profile.sensitive_filter_active ||
    top === "redness_sensitivity" ||
    top === "dryness_barrier"
  ) {
    return {
      slug: "the-barrier-defense",
      reason:
        "The complete reset for reactive or compromised skin. Hydrate, calm, seal — in that order, nightly, until the barrier holds again.",
    };
  }

  // Dehydration → Hydration Essentials
  if (top === "dehydration" || second === "dehydration") {
    return {
      slug: "skin-hydration-essentials",
      reason:
        "Multi-depth hyaluronic acid, then a ceramide-squalane seal. For skin that drinks in everything.",
    };
  }

  // Rough texture → Texture Reset (not for sensitive skin — sensitive
  // filter above already routed them to Barrier Defense)
  if (top === "rough_texture") {
    return {
      slug: "texture-reset",
      reason:
        "GlycoGommage weekly, AzelaiK nightly — surface smoother, deeper layer clearer.",
    };
  }

  // For oiliness / acne alone, we don't have a dedicated bundle anymore.
  // The individual product recommendation (AzelaiK + BHA cleanser) carries.
  // But if they're clearly routine-committed, nudge them toward Full Qunat.
  if (
    (top === "oiliness_congestion" || top === "acne_comedonal" || top === "acne_inflammatory") &&
    profile.routine_size === "3-4" &&
    hasManyDistinctConcerns
  ) {
    return {
      slug: "the-full-qunat-routine",
      reason:
        "Multiple things going on at once — actives that handle each layer. The full set is our most complete answer.",
    };
  }

  return null;
}

/**
 * Apply sensitive filter:
 *  - Never recommend GlycoGommage as a product or via bundles that include it.
 *  - Add frequency warnings for AzelaiK.
 */
function applySensitiveFilter(rec: Recommendation, profile: SkinProfile): Recommendation {
  if (!profile.sensitive_filter_active) return rec;

  const blocked = new Set(["glycogommage-peeling-gel"]);

  // If primary is blocked, swap to a safer hero
  if (blocked.has(rec.primary_product.slug)) {
    rec = {
      ...rec,
      primary_product: {
        slug: "hydrapep-serum",
        reason:
          "Because you flagged stinging or flushing, we're leading with a gentler pick. HydraPep rebuilds comfort and hydration so anything stronger has a stable base to work on.",
        usage: "AM and PM on damp skin",
        frequency_warning: null,
      },
    };
  }

  // Filter supporting products
  rec.supporting_products = rec.supporting_products.filter((p) => !blocked.has(p.slug));

  // Low-frequency note on AzelaiK
  const az = rec.primary_product.slug === "azelaik-12-micro-emulsion"
    ? rec.primary_product
    : rec.supporting_products.find((p) => p.slug === "azelaik-12-micro-emulsion");
  if (az) {
    az.frequency_warning =
      "Reactive skin tip: start 2–3 nights a week for the first two weeks, then work up to every other night before daily use. Patch behind the ear first.";
  }

  // Swap bundle if it contains GlycoGommage
  if (rec.bundle) {
    if (rec.bundle.slug === "texture-reset") {
      rec.bundle = {
        slug: "the-barrier-defense",
        reason:
          "Because you flagged sensitivity, we've switched from an exfoliation-led bundle to a barrier-focused one. Same price tier, friendlier on reactive skin.",
      };
    }
  }

  return rec;
}

/**
 * Apply routine-size preference: 1-2 → primary only, 3-4 → primary + 1-2 supports,
 * 5+ → primary + 2-3 supports. Bundles can still be shown regardless.
 */
function applyRoutineSizeCap(rec: Recommendation, size: string | null): Recommendation {
  if (!size) return rec;
  if (size === "1-2") {
    rec.supporting_products = [];
  } else if (size === "3-4") {
    rec.supporting_products = rec.supporting_products.slice(0, 2);
  }
  return rec;
}

/**
 * If the recommended bundle already contains MatchaMelt + BHA cleanser (or is the double-cleanse
 * set itself), suppress the upsell. Otherwise, show the MATCHA15 add-on.
 */
function decideDoubleCleanseUpsell(rec: Recommendation): Recommendation {
  const bundleIsDoubleCleanse = rec.bundle?.slug === "the-double-cleanse-routine";
  // Full Qunat Routine already includes MatchaMelt + BHA cleanser, so suppress upsell there too
  const bundleIncludesDoubleCleanse =
    bundleIsDoubleCleanse || rec.bundle?.slug === "the-full-qunat-routine";

  // If the bundle already contains MatchaMelt + BHA cleanser (Double Cleanse Routine
  // OR Full Qunat Routine which includes both), suppress the upsell.
  if (bundleIncludesDoubleCleanse) {
    return { ...rec, double_cleanse_upsell: null };
  }

  const allRecommendedSlugs = [
    rec.primary_product.slug,
    ...rec.supporting_products.map((p) => p.slug),
  ];
  const hasMatcha = allRecommendedSlugs.includes("matchamelt-balm");

  const copy = hasMatcha
    ? "You're set on the oil-based first cleanse — MatchaMelt is already in your routine. If you haven't picked up BHA Gentle Cleanser yet, bundle them together and save 25%."
    : "Happy with your current gel cleanser? Add on MatchaMelt as your oil-based first cleanse with code MATCHA15 for 15% off. (Every routine — even actives-heavy ones — starts with a real makeup / SPF lift.)";

  return {
    ...rec,
    double_cleanse_upsell: {
      copy,
      code: "MATCHA15",
      discount_pct: 15,
    },
  };
}

/**
 * Secondary bundle push — always offer The Full Qunat Routine as the "go all-in"
 * option on every recommendation, EXCEPT:
 *  - primary bundle is already the-full-qunat-routine
 *  - user explicitly chose routine_size "1-2" (they want minimal)
 *  - the primary recommendation mode is makeup_removal_need (too mismatched)
 */
function applyFullRoutinePush(rec: Recommendation, profile: SkinProfile): Recommendation {
  // Suppressions
  if (rec.bundle?.slug === "the-full-qunat-routine") return rec;
  if (profile.routine_size === "1-2") return rec;
  if (rec.primary_product.slug === "matchamelt-balm") return rec;
  // Full Qunat Routine contains GlycoGommage, which is a no-go for reactive skin.
  if (profile.sensitive_filter_active) return rec;

  return {
    ...rec,
    secondary_bundle: {
      slug: "the-full-qunat-routine",
      reason:
        "Or go all-in. The Full Qunat Routine is every formula in the line, sequenced to work together — from first cleanse to final seal. Our most complete protocol, at the deepest price.",
    },
  };
}

/**
 * Build a base recommendation given the top concern label.
 */
function baseRecommendation(c: Classification): Recommendation {
  const top = c.concerns[0];
  const second = c.concerns[1];
  const label = top?.label ?? "dullness_uneven_tone";

  // Table of base recs — will be mutated by profile + bundle + upsell logic.
  const library: Record<string, Recommendation> = {
    acne_inflammatory: {
      mode: "recommend",
      skin_profile_line: "",
      opener:
        "What you're describing sounds consistent with inflammatory breakouts. One of our hero formulas was built exactly for this.",
      primary_product: {
        slug: "azelaik-12-micro-emulsion",
        reason:
          "AzelaiK 12% is built around micronized azelaic acid — one of the rare actives that targets active breakouts and the marks they leave, in one step. The micro-emulsion base keeps it comfortable on reactive skin.",
        usage: "PM, after cleansing and before moisturizer",
        frequency_warning: null,
      },
      supporting_products: [
        {
          slug: "bha-gentle-cleanser",
          reason:
            "Pair with the BHA Gentle Cleanser to keep pores clear daily without stripping the barrier that acne skin needs.",
          usage: "AM and PM",
          frequency_warning: null,
        },
      ],
      bundle: null,
      secondary_bundle: null,
      ph_note: "AzelaiK is formulated at pH 5.0–5.5 — matching your skin's natural acidity for maximum comfort.",
      sunscreen_reminder: true,
      routine_note: "Cleanse AM and PM with BHA Gentle Cleanser. Apply AzelaiK 12% PM after towel-drying.",
      double_cleanse_upsell: null,
      instagram_consultation: false,
      cta_primary: "Shop AzelaiK 12%",
      cta_bundle: null,
    },
    acne_comedonal: {
      mode: "recommend",
      skin_profile_line: "",
      opener: "Clogged pores and blackheads usually come down to how you cleanse. We have a formula built for exactly that.",
      primary_product: {
        slug: "bha-gentle-cleanser",
        reason:
          "The BHA Gentle Cleanser uses 1% salicylic acid in a mild surfactant base to clear congestion daily, with niacinamide and hyaluronic acid so it never leaves skin stripped.",
        usage: "AM and PM",
        frequency_warning: null,
      },
      supporting_products: [
        {
          slug: "glycogommage-peeling-gel",
          reason:
            "Layer in GlycoGommage once or twice a week for deeper decongestion — 3% glycolic acid plus gentle polishing particles.",
          usage:
            "Use 1–2 times a week in the evening. Read the 'how to' instructions carefully — apply to dry skin, then rinse with warm water.",
          frequency_warning: null,
        },
      ],
      bundle: null,
      secondary_bundle: null,
      ph_note: "BHA Gentle Cleanser is formulated at skin-friendly pH and rinses clean without stripping.",
      sunscreen_reminder: true,
      routine_note:
        "Daily BHA cleanse. GlycoGommage replaces MatchaMelt one night a week — apply to dry skin, massage 30 seconds, rinse off, then continue with toner and moisturizer.",
      double_cleanse_upsell: null,
      instagram_consultation: false,
      cta_primary: "Shop BHA Cleanser",
      cta_bundle: null,
    },
    post_acne_marks: {
      mode: "recommend",
      skin_profile_line: "",
      opener: "Marks left behind by past breakouts are some of the most persistent things to fade. We have a targeted approach.",
      primary_product: {
        slug: "tranexamilk",
        reason:
          "Tranexamilk is formulated around 4% tranexamic acid — a targeted active for stubborn post-acne pigmentation — in a milky, comfortable emulsion.",
        usage: "PM",
        frequency_warning: null,
      },
      supporting_products: [
        {
          slug: "niabutin-c-serum",
          reason:
            "NiAbutin C in the morning adds layered brightening — ascorbyl glucoside, alpha arbutin, and niacinamide — so you're working tone from two angles without doubling up irritation.",
          usage: "AM",
          frequency_warning: null,
        },
      ],
      bundle: null,
      secondary_bundle: null,
      ph_note: "Tranexamilk sits at a comfortable pH ~5.2, so it layers cleanly under moisturizer.",
      sunscreen_reminder: true,
      routine_note: "AM: NiAbutin C. PM: Tranexamilk. The actives work on different pathways, spaced across the day so they stack without competing.",
      double_cleanse_upsell: null,
      instagram_consultation: false,
      cta_primary: "Shop Tranexamilk",
      cta_bundle: null,
    },
    melasma: {
      mode: "recommend",
      skin_profile_line: "",
      opener: "Patchy symmetric pigmentation like melasma asks for a targeted active — not just a brightener.",
      primary_product: {
        slug: "tranexamilk",
        reason:
          "Tranexamilk pairs 4% tranexamic acid — one of the leading topicals for melasma — with a soothing emulsion that won't provoke pigmented skin.",
        usage: "PM",
        frequency_warning: null,
      },
      supporting_products: [
        {
          slug: "niabutin-c-serum",
          reason:
            "NiAbutin C in the AM gives daily brightening support. The two actives are timed across AM/PM deliberately — this keeps them from competing or irritating.",
          usage: "AM",
          frequency_warning: null,
        },
        {
          slug: "hydrapep-serum",
          reason: "HydraPep underneath keeps the barrier resilient while you treat — pigmented skin reacts to barrier stress.",
          usage: "AM and PM, under everything else",
          frequency_warning: null,
        },
      ],
      bundle: null,
      secondary_bundle: null,
      ph_note: "Tranexamilk sits at skin-friendly pH, layers comfortably under moisturizer.",
      sunscreen_reminder: true,
      routine_note: "AM: HydraPep → NiAbutin C → moisturizer → SPF. PM: HydraPep → Tranexamilk → moisturizer.",
      double_cleanse_upsell: null,
      instagram_consultation: false,
      cta_primary: "Shop Tranexamilk",
      cta_bundle: null,
    },
    sun_damage_pigmentation: {
      mode: "recommend",
      skin_profile_line: "",
      opener: "Sun-driven spots and uneven tone respond best to a two-pronged approach — and daily SPF is non-negotiable.",
      primary_product: {
        slug: "tranexamilk",
        reason: "4% tranexamic acid targets sun-induced pigmentation in a milky emulsion base that stays tolerable on daily skin.",
        usage: "PM",
        frequency_warning: null,
      },
      supporting_products: [
        {
          slug: "niabutin-c-serum",
          reason:
            "NiAbutin C in the morning adds layered brightening — and the AM/PM split keeps the two actives working without irritation.",
          usage: "AM",
          frequency_warning: null,
        },
      ],
      bundle: null,
      secondary_bundle: null,
      ph_note: "Tranexamilk sits at ~pH 5.2 — comfortable to layer under any moisturizer.",
      sunscreen_reminder: true,
      routine_note: "AM: NiAbutin C. PM: Tranexamilk. SPF every single day — pigmentation rewinds the moment UV gets in.",
      double_cleanse_upsell: null,
      instagram_consultation: false,
      cta_primary: "Shop Tranexamilk",
      cta_bundle: null,
    },
    dullness_uneven_tone: {
      mode: "recommend",
      skin_profile_line: "",
      opener: "A tired, flat look usually comes from a mix of surface buildup and uneven tone.",
      primary_product: {
        slug: "niabutin-c-serum",
        reason:
          "NiAbutin C layers ascorbyl glucoside, alpha arbutin, and niacinamide — a daily-use brightening stack without the sting of pure vitamin C.",
        usage: "AM",
        frequency_warning: null,
      },
      supporting_products: [
        {
          slug: "glycogommage-peeling-gel",
          reason: "GlycoGommage 1–2× weekly lifts surface buildup so the serum has a cleaner canvas.",
          usage:
            "Use 1–2 times a week in the evening. Read the 'how to' instructions carefully — apply to dry skin, then rinse with warm water.",
          frequency_warning: null,
        },
      ],
      bundle: null,
      secondary_bundle: null,
      ph_note: "NiAbutin C is formulated at ~pH 5.2 — comfortable for daily use even on sensitive skin.",
      sunscreen_reminder: true,
      routine_note:
        "NiAbutin C daily in the AM. GlycoGommage replaces MatchaMelt one night a week — apply to dry skin, rinse off, then continue normally.",
      double_cleanse_upsell: null,
      instagram_consultation: false,
      cta_primary: "Shop NiAbutin C",
      cta_bundle: null,
    },
    rough_texture: {
      mode: "recommend",
      skin_profile_line: "",
      opener: "Texture that feels grainy or uneven usually lifts quickly with the right exfoliant.",
      primary_product: {
        slug: "glycogommage-peeling-gel",
        reason:
          "GlycoGommage combines 3% glycolic acid with microcrystalline cellulose for dual chemical and gentle physical exfoliation in a rinse-off format.",
        usage:
          "Use 1–2 times a week in the evening. Read the 'how to' instructions carefully — apply to dry skin, massage 30 seconds, then rinse with warm water.",
        frequency_warning: null,
      },
      supporting_products: [
        {
          slug: "hydrapep-serum",
          reason: "Follow with HydraPep to rehydrate post-exfoliation — multi-weight HA plus peptides for bounce.",
          usage: "AM and PM on damp skin",
          frequency_warning: null,
        },
      ],
      bundle: null,
      secondary_bundle: null,
      ph_note: "GlycoGommage is formulated at pH 5.0–5.2 — strong enough to work, gentle enough to rinse off.",
      sunscreen_reminder: true,
      routine_note:
        "GlycoGommage replaces MatchaMelt one night a week — rinse off, then continue with toner and moisturizer. HydraPep every day morning and evening.",
      double_cleanse_upsell: null,
      instagram_consultation: false,
      cta_primary: "Shop GlycoGommage",
      cta_bundle: null,
    },
    dehydration: {
      mode: "recommend",
      skin_profile_line: "",
      opener: "Skin that drinks in everything usually needs water, not heavier cream.",
      primary_product: {
        slug: "hydrapep-serum",
        reason:
          "HydraPep layers three molecular weights of hyaluronic acid for multi-depth hydration, plus 3% Matrixyl 3000 for a quiet bounce over time.",
        usage: "AM and PM on damp skin",
        frequency_warning: null,
      },
      supporting_products: [
        {
          slug: "dermaseal-moisturizing-mask",
          reason: "Seal it in at night with DermaSeal — ceramide NP and squalane lock the water in.",
          usage: "Overnight mask, 3–5× per week",
          frequency_warning: null,
        },
      ],
      bundle: null,
      secondary_bundle: null,
      ph_note: "HydraPep sits at pH 5.3–5.7 — neutral layering under anything else.",
      sunscreen_reminder: true,
      routine_note: "HydraPep on damp skin AM and PM. DermaSeal as an overnight mask a few nights a week.",
      double_cleanse_upsell: null,
      instagram_consultation: false,
      cta_primary: "Shop HydraPep",
      cta_bundle: null,
    },
    dryness_barrier: {
      mode: "recommend",
      skin_profile_line: "",
      opener: "Tight, flaky skin usually signals the barrier needs reinforcement first.",
      primary_product: {
        slug: "dermaseal-moisturizing-mask",
        reason:
          "DermaSeal layers ceramide NP, squalane, and occlusives to rebuild the barrier — a proper reset for compromised skin.",
        usage: "Nightly as a leave-on mask until the barrier settles",
        frequency_warning: null,
      },
      supporting_products: [
        {
          slug: "hydrapep-serum",
          reason: "HydraPep underneath adds deep hydration so the occlusive has something to seal in.",
          usage: "AM and PM on damp skin",
          frequency_warning: null,
        },
      ],
      bundle: null,
      secondary_bundle: null,
      ph_note: "DermaSeal is formulated at pH 5.4–5.6 — matched to a healthy barrier.",
      sunscreen_reminder: true,
      routine_note: "HydraPep first on damp skin, DermaSeal on top. Use nightly until the barrier settles, then taper to 2–3× per week.",
      double_cleanse_upsell: null,
      instagram_consultation: false,
      cta_primary: "Shop DermaSeal",
      cta_bundle: null,
    },
    oiliness_congestion: {
      mode: "recommend",
      skin_profile_line: "",
      opener: "Oily, congested skin responds best to a daily BHA cleanse and light, thoughtful hydration.",
      primary_product: {
        slug: "bha-gentle-cleanser",
        reason:
          "1% salicylic acid in a non-stripping surfactant base — designed to keep oily, congested skin clear without provoking it.",
        usage: "AM and PM",
        frequency_warning: null,
      },
      supporting_products: [
        {
          slug: "niabutin-c-serum",
          reason: "NiAbutin C brings niacinamide into the routine — for the look of pores and tone over time.",
          usage: "AM",
          frequency_warning: null,
        },
      ],
      bundle: null,
      secondary_bundle: null,
      ph_note: null,
      sunscreen_reminder: true,
      routine_note: "BHA Gentle Cleanser AM and PM. NiAbutin C in the morning.",
      double_cleanse_upsell: null,
      instagram_consultation: false,
      cta_primary: "Shop BHA Cleanser",
      cta_bundle: null,
    },
    fine_lines_early_aging: {
      mode: "recommend",
      skin_profile_line: "",
      opener: "Early fine lines usually come down to hydration and peptide support — before anything more aggressive.",
      primary_product: {
        slug: "hydrapep-serum",
        reason:
          "HydraPep pairs three weights of hyaluronic acid with 3% Matrixyl 3000 — a peptide complex used in the industry for visible smoothing over time.",
        usage: "AM and PM on damp skin",
        frequency_warning: null,
      },
      supporting_products: [],
      bundle: null,
      secondary_bundle: null,
      ph_note: "HydraPep's pH (5.3–5.7) means it layers under anything else without interference.",
      sunscreen_reminder: true,
      routine_note: "HydraPep AM and PM on damp skin. Daily SPF to protect the work you're doing.",
      double_cleanse_upsell: null,
      instagram_consultation: false,
      cta_primary: "Shop HydraPep",
      cta_bundle: null,
    },
    redness_sensitivity: {
      mode: "recommend",
      skin_profile_line: "",
      opener: "Reactive, red-prone skin asks for anti-inflammatory support over aggressive actives.",
      primary_product: {
        slug: "azelaik-12-micro-emulsion",
        reason:
          "AzelaiK 12% is one of the few treatments that calms visible redness while it works. Micronized in a micro-emulsion base for tolerance.",
        usage: "PM",
        frequency_warning:
          "On reactive skin, start 2–3 nights a week for the first two weeks, then work up. Patch behind the ear before first full application.",
      },
      supporting_products: [
        {
          slug: "dermaseal-moisturizing-mask",
          reason: "DermaSeal a few nights a week reinforces the barrier — reactive skin usually has a weak one.",
          usage: "Overnight mask, 2–3× per week",
          frequency_warning: null,
        },
      ],
      bundle: null,
      secondary_bundle: null,
      ph_note: "AzelaiK at pH 5.0–5.5 and DermaSeal at pH 5.4–5.6 — both sit close to your skin's natural acidity.",
      sunscreen_reminder: true,
      routine_note: "AzelaiK PM. DermaSeal as an overnight mask two to three times a week.",
      double_cleanse_upsell: null,
      instagram_consultation: false,
      cta_primary: "Shop AzelaiK 12%",
      cta_bundle: null,
    },
    makeup_removal_need: {
      mode: "recommend",
      skin_profile_line: "",
      opener: "The first cleanse matters — especially if you wear heavy SPF or makeup.",
      primary_product: {
        slug: "matchamelt-balm",
        reason:
          "MatchaMelt is a balm-to-oil cleanse that lifts makeup and SPF cleanly, without stripping the barrier underneath.",
        usage: "PM on dry skin, first step of double cleanse",
        frequency_warning: null,
      },
      supporting_products: [
        {
          slug: "bha-gentle-cleanser",
          reason:
            "Follow with BHA Gentle Cleanser for the second step — especially useful if skin skews congested.",
          usage: "AM and PM",
          frequency_warning: null,
        },
      ],
      bundle: null,
      secondary_bundle: null,
      ph_note: null,
      sunscreen_reminder: true,
      routine_note: "MatchaMelt first on dry skin, rinse, then BHA Gentle Cleanser.",
      double_cleanse_upsell: null,
      instagram_consultation: false,
      cta_primary: "Shop MatchaMelt",
      cta_bundle: null,
    },
  };

  return library[label] ?? library.dullness_uneven_tone;
}

export function mockRecommend(
  c: Classification,
  profile: SkinProfile
): Recommendation {
  let rec = baseRecommendation(c);

  // Acne + PIH special case → route back through acne_inflammatory but tag for bundle pick
  const top = c.concerns[0]?.label;
  const second = c.concerns[1]?.label;
  if (
    (top === "acne_inflammatory" && second === "post_acne_marks") ||
    (top === "post_acne_marks" && second === "acne_inflammatory")
  ) {
    rec = baseRecommendation({ ...c, concerns: [{ label: "acne_inflammatory", confidence: 1 }, c.concerns[1]].filter(Boolean) as any });
  }

  // Bundle match
  const bundle = pickBundle(c, profile);
  if (bundle) {
    rec.bundle = bundle;
    rec.cta_bundle = "Shop the bundle";
  }

  // Sensitive filter
  rec = applySensitiveFilter(rec, profile);

  // Routine size cap
  rec = applyRoutineSizeCap(rec, profile.routine_size);

  // Double cleanse upsell logic (must run after all product decisions)
  rec = decideDoubleCleanseUpsell(rec);

  // Secondary bundle: Full Qunat Routine push on every recommendation
  // EXCEPT when the primary bundle is already the-full-qunat-routine
  // OR the user explicitly chose "1-2 products" routine commitment.
  rec = applyFullRoutinePush(rec, profile);

  // Instagram consultation surface: severity = significant
  if (c.severity_signal === "significant") {
    rec.instagram_consultation = true;
  }

  // Profile line
  rec.skin_profile_line = buildProfileLine(profile);

  return rec;
}

function buildProfileLine(p: SkinProfile): string {
  const parts: string[] = [];
  if (p.skin_type) parts.push(capitalize(p.skin_type));
  if (p.reactivity) parts.push(capitalize(p.reactivity));
  if (p.fitzpatrick) parts.push(`Fitzpatrick Type ${p.fitzpatrick}`);
  return parts.join(" / ") || "Based on what you told us";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------- other mocks (unchanged from v1 aside from types) ----------

export function mockClarify(c: Classification): Clarification {
  const top = c.concerns[0]?.label;
  const second = c.concerns[1]?.label;

  if (top === "dullness_uneven_tone" && (second === "post_acne_marks" || !second)) {
    return {
      mode: "clarify",
      opener: "Before I match you, I want to get this right.",
      questions: [
        {
          id: "q1",
          text: "Which feels closer to what's on your mind?",
          chips: ["Overall dull, not glowy", "Specific dark marks", "Both — tone + spots"],
        },
        {
          id: "q2",
          text: "Do the marks come from past breakouts?",
          chips: ["Yes", "No", "Not sure"],
        },
      ],
    };
  }

  return {
    mode: "clarify",
    opener: "A few quick things will help me pick the right match.",
    questions: [
      {
        id: "q1",
        text: "Which describes your skin best right now?",
        chips: ["Breakouts", "Dark spots", "Dryness", "Dullness", "Fine lines"],
      },
    ],
  };
}

export function mockProductQA(userText: string): ProductQA {
  const t = userText.toLowerCase();
  if (t.includes("vitamin c") || t.includes("niabutin")) {
    return {
      mode: "product_qa",
      answer:
        "NiAbutin C is formulated around ascorbyl glucoside — a gentler, more stable vitamin C derivative than pure L-ascorbic acid — paired with alpha arbutin, niacinamide, and hydration from panthenol and sodium hyaluronate. For most sensitive skin, it's comfortable to layer daily. If your skin is very reactive, start every other morning.",
      referenced_slugs: ["niabutin-c-serum", "hydrapep-serum"],
      cta: { text: "Shop NiAbutin C", slug: "niabutin-c-serum" },
    };
  }
  if (t.includes("peel") || t.includes("glyco")) {
    return {
      mode: "product_qa",
      answer:
        "GlycoGommage pairs 3% glycolic acid with microcrystalline cellulose for dual chemical and physical exfoliation in a rinse-off gel, buffered by aloe and allantoin. Designed for rough texture and dullness from buildup — not for reactive or actively inflamed skin.",
      referenced_slugs: ["glycogommage-peeling-gel"],
      cta: { text: "Shop GlycoGommage", slug: "glycogommage-peeling-gel" },
    };
  }
  if (t.includes("azel")) {
    return {
      mode: "product_qa",
      answer:
        "AzelaiK 12% uses micronized azelaic acid in a micro-emulsion base — that's the ingredient engine for active breakouts, post-acne marks, and reactive redness. Panthenol and betaine support tolerance. Apply in the evening after cleansing, before moisturizer.",
      referenced_slugs: ["azelaik-12-micro-emulsion"],
      cta: { text: "Shop AzelaiK 12%", slug: "azelaik-12-micro-emulsion" },
    };
  }
  return {
    mode: "product_qa",
    answer:
      "Happy to help with the Qunat line — can you tell me which product or ingredient you're curious about? I can walk through any of the eight formulas.",
    referenced_slugs: [],
    cta: null,
  };
}

export function mockRedirect(): Redirect {
  return {
    mode: "redirect",
    message:
      "That's outside what I can help with — I'm here for your skin and the Qunat routine. Want me to look at a concern instead?",
    suggested_chips: ["Breakouts", "Dark spots", "Dryness", "Dullness", "Fine lines"],
    instagram_consultation: false,
  };
}

export function mockMedicalCaution(): Redirect {
  return {
    mode: "medical_caution",
    message:
      "I can't weigh in on this — anything that looks medical is for a dermatologist, not a skincare advisor. Please have it checked professionally. Once you're cleared, I'd love to help you build a gentle routine.",
    suggested_chips: ["Explore the range", "Gentle routine basics"],
    instagram_consultation: true,
  };
}

/**
 * Sales-bot fallback. When the model can't classify, times out, or refuses —
 * we never show "we can't help." We always serve a default recommendation
 * appropriate to the user's stated routine commitment, framed with a soft
 * "your skin seems more complicated than most" message and the Instagram CTA.
 *
 *   1-2 commitment → AzelaiK 12% (primary) + MatchaMelt addon
 *   3-4 commitment → The Barrier Defense bundle + MatchaMelt addon
 *   5+ commitment  → The Full Qunat Routine
 *
 * If routine_size is unknown, default to 3-4 (the most common commitment).
 */
export function fallbackRecommendation(profile: SkinProfile): Recommendation {
  const size = profile.routine_size ?? "3-4";

  const opener =
    "Your skin seems more complicated than most. Here's a gentle starter set we'd suggest — and our skin specialists can build something more tailored if you DM us on Instagram @qunatbeauty.";

  const skinProfileLine = buildProfileLine(profile);

  if (size === "1-2") {
    return {
      mode: "recommend",
      skin_profile_line: skinProfileLine,
      opener,
      primary_product: {
        slug: "azelaik-12-micro-emulsion",
        reason:
          "AzelaiK 12% is our most versatile single product — gentle enough for reactive skin, effective for breakouts, redness, and post-acne marks. A safe place to start.",
        usage: "Apply PM after cleansing, before moisturizer. Patch test for 2 nights first.",
        frequency_warning: profile.sensitive_filter_active
          ? "Start 2-3 nights/week and work up gradually if your skin tolerates it."
          : null,
      },
      supporting_products: [],
      bundle: null,
      secondary_bundle: null,
      ph_note: "AzelaiK is formulated at pH 5.0–5.5, comfortable for most skin types.",
      sunscreen_reminder: true,
      routine_note:
        "Start simple: cleanse, AzelaiK at night, moisturizer, SPF in the morning.",
      double_cleanse_upsell: {
        copy:
          "Add MatchaMelt as your evening makeup-and-SPF dissolver — use code MATCHA15 for 15% off.",
        code: "MATCHA15",
        discount_pct: 15,
      },
      instagram_consultation: true,
      cta_primary: "Shop AzelaiK 12%",
      cta_bundle: null,
    };
  }

  if (size === "5+") {
    return {
      mode: "recommend",
      skin_profile_line: skinProfileLine,
      opener,
      primary_product: {
        slug: "azelaik-12-micro-emulsion",
        reason:
          "Since you're open to a complete routine, we'd recommend the Full Qunat Routine — every formula in the line, sequenced to work together.",
        usage: "See the bundle for layering instructions.",
        frequency_warning: null,
      },
      supporting_products: [],
      bundle: {
        slug: "the-full-qunat-routine",
        reason:
          "Our most complete protocol. Every Qunat formula — cleansers, toner, serums, treatment, moisturizer — at our deepest savings. The most thorough way to address whatever's going on.",
      },
      secondary_bundle: null,
      ph_note: null,
      sunscreen_reminder: true,
      routine_note:
        "Layering order — MatchaMelt → BHA Cleanser → Tranexamilk toner → NiAbutin C (AM) / Tranexamilk (PM) → HydraPep → AzelaiK 12% → DermaSeal. GlycoGommage replaces MatchaMelt once a week (wash off, follow with normal routine).",
      double_cleanse_upsell: null,
      instagram_consultation: true,
      cta_primary: "Shop AzelaiK 12%",
      cta_bundle: "Shop the Full Routine",
    };
  }

  // 3-4 default
  return {
    mode: "recommend",
    skin_profile_line: skinProfileLine,
    opener,
    primary_product: {
      slug: "hydrapep-serum",
      reason:
        "Multi-depth hyaluronic acid + peptides. The most universally tolerated active in the line — a strong starting point for most skin.",
      usage: "Apply AM and PM after cleansing, before moisturizer.",
      frequency_warning: null,
    },
    supporting_products: [
      {
        slug: "azelaik-12-micro-emulsion",
        reason:
          "AzelaiK calms inflammation and works on post-acne marks. Pairs gently with HydraPep and DermaSeal.",
        usage: "PM only, after HydraPep, before DermaSeal.",
        frequency_warning: profile.sensitive_filter_active
          ? "Start 2-3 nights/week and work up gradually."
          : null,
      },
    ],
    bundle: {
      slug: "the-barrier-defense",
      reason:
        "HydraPep, AzelaiK, DermaSeal — three products that rebuild skin tolerance and treat without irritating. The safest comprehensive choice.",
    },
    secondary_bundle: null,
    ph_note: "All three formulas sit at pH 5.0–5.6, friendly to barrier function.",
    sunscreen_reminder: true,
    routine_note:
      "Cleanse → HydraPep → AzelaiK (PM) → DermaSeal. SPF every morning.",
    double_cleanse_upsell: {
      copy:
        "Add MatchaMelt as your evening makeup-and-SPF dissolver — use code MATCHA15 for 15% off.",
      code: "MATCHA15",
      discount_pct: 15,
    },
    instagram_consultation: true,
    cta_primary: "Shop HydraPep",
    cta_bundle: "Shop the Barrier Defense",
  };
}


