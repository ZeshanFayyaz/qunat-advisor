import { useState } from "preact/hooks";
import type { Recommendation, Classification, SkinProfile, ProductReason } from "../lib/types";
import { addToCart, pdpUrl } from "../lib/cart";
import { postFeedback } from "../lib/api";
import { track, getSessionId } from "../lib/analytics";
import { EmailCaptureCard } from "./EmailCaptureCard";

type Props = {
  data: Recommendation;
  classification: Classification | null;
  profile: SkinProfile;
  onReset: () => void;
};

export function RecommendState({ data, classification, onReset }: Props) {
  const topConcern = classification?.concerns?.[0]?.label ?? "general";
  const allConcernsString =
    classification?.concerns
      ?.map((c) => `${c.label} (${Math.round(c.confidence * 100)}%)`)
      .join(", ") ?? "general";
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [matchaAdded, setMatchaAdded] = useState(false);

  const primary = data.primary_product;
  const bundle = data.bundle?.bundle ?? null;
  const secondaryBundle = data.secondary_bundle?.bundle ?? null;
  
  // When a bundle is recommended, the "Shop individually" list is derived
  // from the bundle's contents — so the user sees consistency between
  // "buy the bundle" and "buy these one at a time."
  // When no bundle is recommended, fall back to primary + supporting picks.
  const allProducts = bundle
    ? bundle.products.map((bp: any) => {
        // Find matching reason from primary/supporting if available
        const matchingPick = [primary, ...data.supporting_products].find(
          (pr) => pr.slug === bp.slug
        );
        return {
          slug: bp.slug,
          reason: matchingPick?.reason ?? `Part of the ${bundle.name}.`,
          usage: matchingPick?.usage ?? null,
          frequency_warning: matchingPick?.frequency_warning ?? null,
          product: bp,
        };
      })
    : [primary, ...data.supporting_products];

  const handleBundleShop = async (which: "primary" | "secondary") => {
    const target = which === "primary" ? bundle : secondaryBundle;
    if (!target) return;
    track("advisor_cta_clicked", { slug: target.slug, cta: `${which}_bundle` });
    setAdding(target.slug);
    const handles = target.products.map((p) => p.shopify_handle);
    track("advisor_add_to_cart_clicked", {
      slugs: target.products.map((p) => p.slug),
      bundle: target.slug,
    });
    const { url } = await addToCart(handles);
    window.open(url, "_blank");
  };

  const handleFeedback = (r: "up" | "down") => {
    setRating(r);
    postFeedback({
      session_id: getSessionId(),
      rating: r,
      slug: primary.slug,
      classification,
    });
  };

  // Aggregate frequency warnings from any product that has one — shown once in Usage
  const frequencyWarnings = allProducts
    .filter((p) => p.frequency_warning)
    .map((p) => ({ product: p.product?.name ?? p.slug, note: p.frequency_warning! }));

  return (
    <div class="qa-result">
      {/* 1. MATCHA15 BANNER — prominent at top when applicable */}
      {data.double_cleanse_upsell && (
        <div class="qa-matcha-banner">
          <div class="qa-matcha-banner-icon">M</div>
          <div class="qa-matcha-banner-body">
            <p class="qa-matcha-banner-eyebrow">
              <span class="qa-matcha-code">{data.double_cleanse_upsell.code}</span>
              15% off MatchaMelt
            </p>
            <p class="qa-matcha-banner-copy">{data.double_cleanse_upsell.copy}</p>
          </div>
          <button
            type="button"
            class="qa-matcha-banner-cta"
            disabled={matchaAdded}
            onClick={async () => {
              track("advisor_cta_clicked", { slug: "matchamelt-balm", cta: "matcha_upsell" });
              const result = await addToCart(["matchamelt-balm"]);
              if (result.ok) {
                track("advisor_add_to_cart_clicked", { slug: "matchamelt-balm", cta: "matcha_upsell" });
                setMatchaAdded(true);
              } else {
                // Cart API failed (likely demo mode) — fall back to PDP
                window.open(pdpUrl("matchamelt-balm"), "_blank");
              }
            }}
          >
            {matchaAdded ? "Added to cart ✓" : "Add MatchaMelt →"}
          </button>
        </div>
      )}

      {/* 2. DESCRIPTION OF SKIN + TOP RECOMMENDATION */}
      <div class="qa-card qa-result-intro">
        <div class="qa-profile-badge">
          <span class="qa-profile-label">Your skin</span>
          <span>{data.skin_profile_line}</span>
        </div>

        <p class="qa-recommendation-header">Your Match</p>
        <p class="qa-report-opener">
          {data.opener}
        </p>
      </div>

      <EmailCaptureCard
        entryPoint="result"
        variant="full"
        topConcern={topConcern}
        allConcerns={allConcernsString}
      />

      {/* 3. BUNDLE — hero / primary sales moment if present */}
      {bundle && data.bundle && (
        <>
          <div class={`qa-bundle ${bundle.is_hero ? "qa-bundle--hero" : ""}`}>
            <div class="qa-bundle-header">
              <div>
                <p class="qa-bundle-tag">
                  {bundle.is_hero ? "Recommended with every routine" : "Your bundle"}
                </p>
                <h3 class="qa-bundle-name">{bundle.name}</h3>
                <p class="qa-bundle-tagline">{bundle.tagline}</p>
              </div>
              {bundle.discount_pct ? (
                <span class="qa-bundle-discount">{bundle.discount_pct}% off</span>
              ) : null}
            </div>

            <div class="qa-bundle-products">
              {bundle.products.map((p) => (
                <div key={p.slug} class="qa-bundle-product">
                  {p.image ? <img src={p.image} alt="" /> : null}
                  <span>{p.name}</span>
                </div>
              ))}
            </div>

            <p class="qa-bundle-reason">{data.bundle.reason}</p>

            <div class="qa-bundle-bottom">
              <div class="qa-bundle-price">
                {bundle.price_after ? (
                  <span class="qa-bundle-price-after">{bundle.price_after}</span>
                ) : null}
                {bundle.price_before ? (
                  <span class="qa-bundle-price-before">{bundle.price_before}</span>
                ) : null}
              </div>
              <button
                class="qa-btn qa-bundle-cta"
                type="button"
                disabled={adding === bundle.slug}
                onClick={() => handleBundleShop("primary")}
              >
                {adding === bundle.slug ? "Adding…" : data.cta_bundle || "Shop the bundle"}
              </button>
            </div>
          </div>

          {/* Secondary bundle — "or go all-in" with The Full Qunat Routine */}
          {secondaryBundle && data.secondary_bundle && (
            <div class="qa-secondary-bundle">
              <div class="qa-secondary-bundle-body">
                <p class="qa-secondary-bundle-tag">Or go all-in</p>
                <h4 class="qa-secondary-bundle-name">{secondaryBundle.name}</h4>
                <p class="qa-secondary-bundle-reason">{data.secondary_bundle.reason}</p>
                <div class="qa-secondary-bundle-foot">
                  {secondaryBundle.price_after ? (
                    <span class="qa-secondary-bundle-price">
                      <strong>{secondaryBundle.price_after}</strong>
                      {secondaryBundle.price_before ? (
                        <span>{secondaryBundle.price_before}</span>
                      ) : null}
                      {secondaryBundle.discount_pct ? (
                        <em>{secondaryBundle.discount_pct}% off</em>
                      ) : null}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    class="qa-btn qa-btn--ghost"
                    disabled={adding === secondaryBundle.slug}
                    onClick={() => handleBundleShop("secondary")}
                  >
                    {adding === secondaryBundle.slug
                      ? "Adding…"
                      : `Shop the full routine →`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* OR divider between bundles and individual products */}
          <div class="qa-or-divider">
            <span>or</span>
          </div>
        </>
      )}

      {/* If NO primary bundle but secondary Full Routine is offered — show it standalone */}
      {!bundle && secondaryBundle && data.secondary_bundle && (
        <>
          <div class="qa-secondary-bundle">
            <div class="qa-secondary-bundle-body">
              <p class="qa-secondary-bundle-tag">Or go all-in</p>
              <h4 class="qa-secondary-bundle-name">{secondaryBundle.name}</h4>
              <p class="qa-secondary-bundle-reason">{data.secondary_bundle.reason}</p>
              <div class="qa-secondary-bundle-foot">
                {secondaryBundle.price_after ? (
                  <span class="qa-secondary-bundle-price">
                    <strong>{secondaryBundle.price_after}</strong>
                    {secondaryBundle.price_before ? (
                      <span>{secondaryBundle.price_before}</span>
                    ) : null}
                    {secondaryBundle.discount_pct ? (
                      <em>{secondaryBundle.discount_pct}% off</em>
                    ) : null}
                  </span>
                ) : null}
                <button
                  type="button"
                  class="qa-btn qa-btn--ghost"
                  disabled={adding === secondaryBundle.slug}
                  onClick={() => handleBundleShop("secondary")}
                >
                  {adding === secondaryBundle.slug
                    ? "Adding…"
                    : `Shop the full routine →`}
                </button>
              </div>
            </div>
          </div>
          <div class="qa-or-divider">
            <span>or</span>
          </div>
        </>
      )}

      {/* 4. INDIVIDUAL PRODUCTS */}
      <div class="qa-card qa-individual-card">
        <p class="qa-section-heading">
          {bundle ? "Shop individually" : "Your products"}
        </p>
        <p class="qa-section-sub">
          {bundle
            ? "Prefer to pick one at a time? Add the piece you need most first."
            : "Built around what your skin is asking for."}
        </p>

        <div class="qa-products-list">
          {allProducts.map((pr, idx) => {
            const p = pr.product;
            if (!p) return null;
            const isPrimary = idx === 0;
            return (
              <div key={pr.slug} class="qa-product-row">
                {p.image ? (
                  <img src={p.image} alt={p.name} loading="lazy" class="qa-product-row-img" />
                ) : (
                  <div class="qa-product-row-img qa-product-row-img--placeholder" />
                )}
                <div class="qa-product-row-body">
                  <div class="qa-product-row-top">
                    <div>
                      <p class="qa-product-row-tag">{isPrimary ? "Start here" : "Pair with"}</p>
                      <h4 class="qa-product-row-name">{p.name}</h4>
                    </div>
                  </div>
                  <p class="qa-product-row-reason">{pr.reason}</p>
                  <a
                    href={pdpUrl(p.shopify_handle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="qa-btn"
                    onClick={() => {
                      track("advisor_cta_clicked", {
                        slug: p.slug,
                        cta: isPrimary ? "primary" : "supporting",
                      });
                    }}
                  >
                    Shop {p.name.split(" ")[0]} →
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. USAGE — consolidated routine + notes */}
      <div class="qa-card qa-usage-card">
        <p class="qa-section-heading">How to use</p>

        {data.routine_note && (
          <div class="qa-usage-block qa-usage-block--routine">
            <p class="qa-usage-label">Your routine</p>
            <p class="qa-usage-body">{data.routine_note}</p>
          </div>
        )}

        {/* Per-product usage timing */}
        {allProducts.some((p) => p.usage) && (
          <div class="qa-usage-block">
            <p class="qa-usage-label">Timing</p>
            <ul class="qa-usage-list">
              {allProducts
                .filter((p) => p.usage)
                .map((pr) => (
                  <li key={pr.slug}>
                    <strong>{pr.product?.name ?? pr.slug}</strong>
                    <span>{pr.usage}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* Frequency warnings (sensitive skin) */}
        {frequencyWarnings.length > 0 && (
          <div class="qa-usage-block qa-usage-block--warning">
            <p class="qa-usage-label">For reactive skin</p>
            {frequencyWarnings.map((w) => (
              <p key={w.product} class="qa-usage-body">
                <strong>{w.product}:</strong> {w.note}
              </p>
            ))}
          </div>
        )}

        {/* pH note */}
        {data.ph_note && (
          <div class="qa-usage-block qa-usage-block--ph">
            <p class="qa-usage-label">pH balance</p>
            <p class="qa-usage-body">{data.ph_note}</p>
          </div>
        )}

        {/* Sunscreen reminder */}
        {data.sunscreen_reminder && (
          <div class="qa-usage-block qa-usage-block--spf">
            <p class="qa-usage-label">Sunscreen</p>
            <p class="qa-usage-body">
              Non-negotiable — daily SPF is what keeps everything you're treating from coming back.
            </p>
          </div>
        )}
      </div>


      {/* 6. Instagram consultation — only when AI flagged severity */}
      {data.instagram_consultation && (
        <div class="qa-instagram">
          <div class="qa-instagram-icon">
            <svg viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="#fff" stroke="none" />
            </svg>
          </div>
          <div class="qa-instagram-body">
            <strong>Want deeper guidance?</strong>
            <span>
              For a free in-depth consultation with one of our licensed skin specialists, DM us on
              Instagram at <b>@qunatbeauty</b>.
            </span>
          </div>
          <a
            class="qa-instagram-cta"
            href="https://instagram.com/qunatbeauty"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("advisor_cta_clicked", { cta: "instagram_consultation" })}
          >
            Open DMs →
          </a>
        </div>
      )}

      {/* Footer actions */}
      <div class="qa-card qa-footer-card">
        <div class="qa-footer-actions">
          <div class="qa-feedback">
            <span>Helpful?</span>
            <button
              type="button"
              class={`qa-feedback-btn ${rating === "up" ? "is-active" : ""}`}
              aria-label="Yes"
              onClick={() => handleFeedback("up")}
            >
              ↑
            </button>
            <button
              type="button"
              class={`qa-feedback-btn ${rating === "down" ? "is-active" : ""}`}
              aria-label="No"
              onClick={() => handleFeedback("down")}
            >
              ↓
            </button>
          </div>
          <button class="qa-btn--link" type="button" onClick={onReset}>
            Start over →
          </button>
        </div>
        <p class="qa-trust" style={{ marginTop: 16 }}>
          This is skincare guidance, not medical advice. For medical concerns, consult a professional.
        </p>
      </div>
    </div>
  );
}
