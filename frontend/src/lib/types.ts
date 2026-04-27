export type ConcernLabel =
  | "acne_inflammatory"
  | "acne_comedonal"
  | "post_acne_marks"
  | "melasma"
  | "sun_damage_pigmentation"
  | "dullness_uneven_tone"
  | "rough_texture"
  | "dehydration"
  | "dryness_barrier"
  | "oiliness_congestion"
  | "fine_lines_early_aging"
  | "redness_sensitivity"
  | "makeup_removal_need";

export type Classification = {
  intent: string;
  concerns: { label: ConcernLabel; confidence: number }[];
  control_flags: { out_of_scope: number; medical_caution: number };
  image_quality: string;
  disagreement: boolean;
  user_text_summary: string;
  severity_signal?: "mild" | "moderate" | "significant";
};

export type QuizAnswers = {
  skin_feel_midday?: "A" | "B" | "C" | "D";
  pore_visibility?: "A" | "B" | "C" | "D";
  overall_sensitivity?: "A" | "B" | "C" | "D";
  reaction_to_products?: "A" | "B" | "C" | "D";
  flushing_tendency?: "A" | "B" | "C";
  natural_tone?: "A" | "B" | "C" | "D" | "E";
  sun_behavior?: "A" | "B" | "C" | "D" | "E";
  specific_concerns?: string[];
  routine_commitment?: "1-2" | "3-4" | "5+";
};

export type SkinProfile = {
  skin_type: "oily" | "combination" | "dry" | "normal" | null;
  reactivity: "resilient" | "occasional" | "sensitive" | "reactive" | null;
  fitzpatrick: "I" | "II" | "III" | "IV" | "V" | "VI" | null;
  routine_size: "1-2" | "3-4" | "5+" | null;
  sensitive_filter_active: boolean;
  high_pigmentation_risk: boolean;
};

export type Product = {
  slug: string;
  name: string;
  price: string | null;
  price_raw?: number;
  compare_at_price?: string | null;
  discount_pct?: number | null;
  currency?: string;
  image: string | null;
  available?: boolean;
  shopify_handle: string;
  one_line: string;
  hero_ingredients: string[];
  caution: string | null;
};

export type BundleProduct = {
  slug: string;
  name: string;
  image?: string | null;
  price?: string | null;
  shopify_handle: string;
};

export type Bundle = {
  slug: string;
  name: string;
  tagline: string;
  shopify_handle: string;
  discount_pct: number | null;
  is_hero: boolean;
  is_all_in?: boolean;
  is_double_cleanse?: boolean;
  positioning: string;
  why: string;
  price_before: string | null;
  price_after: string | null;
  image?: string | null;
  available?: boolean;
  products: BundleProduct[];
};

export type ProductReason = {
  slug: string;
  reason: string;
  usage: string | null;
  frequency_warning: string | null;
  product?: Product;
};

export type BundleRecommendation = {
  slug: string;
  reason: string;
  bundle?: Bundle;
};

export type MatchaUpsell = {
  copy: string;
  code: "MATCHA15";
  discount_pct: 15;
};

export type Recommendation = {
  mode: "recommend";
  skin_profile_line: string;
  opener: string;
  primary_product: ProductReason;
  supporting_products: ProductReason[];
  bundle: BundleRecommendation | null;
  secondary_bundle: BundleRecommendation | null;
  ph_note: string | null;
  sunscreen_reminder: boolean;
  routine_note: string | null;
  double_cleanse_upsell: MatchaUpsell | null;
  instagram_consultation: boolean;
  cta_primary: string;
  cta_bundle: string | null;
};

export type Clarification = {
  mode: "clarify";
  opener: string;
  questions: { id: string; text: string; chips: string[] }[];
};

export type ProductQA = {
  mode: "product_qa";
  answer: string;
  referenced_slugs: string[];
  cta: { text: string; slug: string; product?: Product } | null;
};

export type Redirect = {
  mode: "redirect" | "medical_caution";
  message: string;
  suggested_chips?: string[];
  instagram_consultation?: boolean;
};

export type AdviseResponse = {
  mode: "recommend" | "clarify" | "product_qa" | "redirect" | "medical_caution";
  classification: Classification | null;
  profile: SkinProfile;
  response: Recommendation | Clarification | ProductQA | Redirect;
};
