import { z } from "zod";

export const CONCERN_LABELS = [
  "acne_inflammatory",
  "acne_comedonal",
  "post_acne_marks",
  "melasma",
  "sun_damage_pigmentation",
  "dullness_uneven_tone",
  "rough_texture",
  "dehydration",
  "dryness_barrier",
  "oiliness_congestion",
  "fine_lines_early_aging",
  "redness_sensitivity",
  "makeup_removal_need",
] as const;

export const PRODUCT_SLUGS = [
  "azelaik-12-micro-emulsion",
  "niabutin-c-serum",
  "glycogommage-peeling-gel",
  "matchamelt-balm",
  "dermaseal-moisturizing-mask",
  "hydrapep-serum",
  "bha-gentle-cleanser",
  "tranexamilk",
] as const;

export const BUNDLE_SLUGS = [
  "the-full-qunat-routine",
  "the-double-cleanse-routine",
  "the-barrier-defense",
  "skin-hydration-essentials",
  "the-pigment-protocol",
  "texture-reset",
] as const;

export const SKIN_TYPE = ["oily", "combination", "dry", "normal"] as const;
export const REACTIVITY = ["resilient", "occasional", "sensitive", "reactive"] as const;
export const FITZPATRICK = ["I", "II", "III", "IV", "V", "VI"] as const;
export const ROUTINE_SIZE = ["1-2", "3-4", "5+"] as const;

export const ConcernLabel = z.enum(CONCERN_LABELS);
export const ProductSlug = z.enum(PRODUCT_SLUGS);
export const BundleSlug = z.enum(BUNDLE_SLUGS);

// --------- Quiz inputs (from frontend) ---------

export const QuizAnswersSchema = z.object({
  skin_feel_midday: z.enum(["A", "B", "C", "D"]).optional(),
  pore_visibility: z.enum(["A", "B", "C", "D"]).optional(),
  overall_sensitivity: z.enum(["A", "B", "C", "D"]).optional(),
  reaction_to_products: z.enum(["A", "B", "C", "D"]).optional(),
  flushing_tendency: z.enum(["A", "B", "C"]).optional(),
  natural_tone: z.enum(["A", "B", "C", "D", "E"]).optional(),
  sun_behavior: z.enum(["A", "B", "C", "D", "E"]).optional(),
  specific_concerns: z.array(z.string()).optional(),
  routine_commitment: z.enum(["1-2", "3-4", "5+"]).optional(),
});
export type QuizAnswers = z.infer<typeof QuizAnswersSchema>;

// --------- Derived skin profile ---------

export const SkinProfileSchema = z.object({
  skin_type: z.enum(SKIN_TYPE).nullable(),
  reactivity: z.enum(REACTIVITY).nullable(),
  fitzpatrick: z.enum(FITZPATRICK).nullable(),
  routine_size: z.enum(ROUTINE_SIZE).nullable(),
  sensitive_filter_active: z.boolean(),
  high_pigmentation_risk: z.boolean(),
});
export type SkinProfile = z.infer<typeof SkinProfileSchema>;

// --------- Classification ---------

export const ClassificationSchema = z.object({
  intent: z.enum(["concern_match", "product_qa", "routine_question", "off_topic", "medical"]),
  concerns: z
    .array(
      z.object({
        label: ConcernLabel,
        confidence: z.number().min(0).max(1),
      })
    )
    .max(4),
  control_flags: z.object({
    out_of_scope: z.number().min(0).max(1),
    medical_caution: z.number().min(0).max(1),
  }),
  image_quality: z.enum([
    "usable",
    "too_blurry",
    "poor_lighting",
    "heavy_filter",
    "heavy_makeup",
    "no_skin_visible",
    "not_a_face",
    "no_image",
  ]),
  disagreement: z.boolean(),
  user_text_summary: z.string().max(400),
  reasoning_short: z.string().max(400).optional(),
  severity_signal: z.enum(["mild", "moderate", "significant"]).optional(),
});
export type Classification = z.infer<typeof ClassificationSchema>;

// --------- Recommendation (rich report) ---------

export const ProductReasonSchema = z.object({
  slug: ProductSlug,
  reason: z.string().max(400),
  usage: z.string().max(200).nullable(),
  frequency_warning: z.string().max(240).nullable(),
});

export const BundleRecommendationSchema = z.object({
  slug: BundleSlug,
  reason: z.string().max(400),
});

export const MatchaUpsellSchema = z.object({
  copy: z.string().max(240),
  code: z.literal("MATCHA15"),
  discount_pct: z.literal(15),
});

export const RecommendSchema = z.object({
  mode: z.literal("recommend"),
  skin_profile_line: z.string().max(120),
  opener: z.string().max(360),
  primary_product: ProductReasonSchema,
  supporting_products: z.array(ProductReasonSchema).max(3).default([]),
  bundle: BundleRecommendationSchema.nullable(),
  // Secondary bundle push — The Full Qunat Routine shown as a "go all-in" card
  // below the primary bundle. Suppressed for routine_size "1-2" users.
  secondary_bundle: BundleRecommendationSchema.nullable().default(null),
  ph_note: z.string().max(240).nullable(),
  sunscreen_reminder: z.boolean().default(true),
  routine_note: z.string().max(320).nullable(),
  double_cleanse_upsell: MatchaUpsellSchema.nullable(),
  instagram_consultation: z.boolean().default(false),
  cta_primary: z.string().max(48),
  cta_bundle: z.string().max(48).nullable(),
});
export type Recommendation = z.infer<typeof RecommendSchema>;

// --------- Clarify ---------

export const ClarifySchema = z.object({
  mode: z.literal("clarify"),
  opener: z.string().max(200),
  questions: z
    .array(
      z.object({
        id: z.string(),
        text: z.string().max(180),
        chips: z.array(z.string().max(40)).min(2).max(5),
      })
    )
    .min(1)
    .max(2),
});
export type Clarification = z.infer<typeof ClarifySchema>;

// --------- Product Q&A ---------

export const ProductQASchema = z.object({
  mode: z.literal("product_qa"),
  answer: z.string().max(1000),
  referenced_slugs: z.array(ProductSlug).max(3),
  cta: z
    .object({
      text: z.string().max(48),
      slug: ProductSlug,
    })
    .nullable(),
});
export type ProductQA = z.infer<typeof ProductQASchema>;

// --------- Redirect / medical ---------

export const RedirectSchema = z.object({
  mode: z.enum(["redirect", "medical_caution"]),
  message: z.string().max(400),
  suggested_chips: z.array(z.string().max(40)).max(5).optional().default([]),
  instagram_consultation: z.boolean().default(false),
});
export type Redirect = z.infer<typeof RedirectSchema>;
