/**
 * Shopify live-fetch module.
 *
 * Pulls price, compare_at_price, and image from each product's public JSON
 * endpoint at qunatbeauty.com/products/{handle}.json — the same public API
 * Shopify exposes for every store.
 *
 * Why live-fetch instead of hardcoding:
 *   - Prices change. If the advisor shows stale prices, users click through
 *     and see different numbers on the PDP. Trust killer.
 *   - Discounts change. Shopify's native compare_at_price → "Save X%" math
 *     is the single source of truth.
 *   - Images change. Same risk of stale data.
 *
 * Cache: in-memory 5-minute TTL per handle. Cold response adds ~100-200ms
 * per unique product, but after the first hit every subsequent advise
 * response for 5 minutes is instant.
 *
 * Failure mode: if Shopify is unreachable, we return null for that product's
 * live data. The frontend gracefully renders without price/image — the
 * "Shop" CTA still works because it only needs the handle.
 */

import { logger } from "./logger.js";

type LiveProduct = {
  title: string;
  handle: string;
  price: number;
  price_formatted: string;
  compare_at_price: number | null;
  compare_at_price_formatted: string | null;
  discount_pct: number | null;
  currency: string;
  image: string | null;
  image_alt: string | null;
  available: boolean;
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT_MS = 2500;

type CacheEntry = { data: LiveProduct | null; expires: number };
const cache = new Map<string, CacheEntry>();

const STORE_DOMAIN =
  process.env.SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "") ??
  "qunatbeauty.com";

function formatPrice(amount: number, currency: string): string {
  // Shopify returns prices as strings like "19237.00"
  // Format with thousands separator. PKR style matches your admin display.
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export async function fetchShopifyProduct(
  handle: string
): Promise<LiveProduct | null> {
  const now = Date.now();
  const cached = cache.get(handle);
  if (cached && cached.expires > now) return cached.data;

  const url = `https://${STORE_DOMAIN}/products/${handle}.json`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);

    if (!res.ok) {
      logger.warn("shopify_fetch_non200", { handle, status: res.status });
      cache.set(handle, { data: null, expires: now + 30_000 });
      return null;
    }

    const json: any = await res.json();
    const p = json.product;
    const variant = p?.variants?.[0];
    if (!p || !variant) {
      cache.set(handle, { data: null, expires: now + CACHE_TTL_MS });
      return null;
    }

    const price = parseFloat(variant.price);
    const compareAt = variant.compare_at_price
      ? parseFloat(variant.compare_at_price)
      : null;
    const currency = variant.price_currency ?? "USD";
    const discountPct =
      compareAt && compareAt > price
        ? Math.round(((compareAt - price) / compareAt) * 100)
        : null;

    const image = p.image?.src ?? p.images?.[0]?.src ?? null;
    const imageAlt = p.image?.alt ?? p.images?.[0]?.alt ?? null;

    const data: LiveProduct = {
      title: p.title,
      handle: p.handle,
      price,
      price_formatted: formatPrice(price, currency),
      compare_at_price: compareAt,
      compare_at_price_formatted: compareAt ? formatPrice(compareAt, currency) : null,
      discount_pct: discountPct,
      currency,
      image,
      image_alt: imageAlt,
      available: variant.available !== false,
    };

    cache.set(handle, { data, expires: now + CACHE_TTL_MS });
    return data;
  } catch (err: any) {
    clearTimeout(timer);
    logger.warn("shopify_fetch_error", { handle, error: err?.message });
    // Cache the failure briefly so we don't hammer on outage
    cache.set(handle, { data: null, expires: now + 30_000 });
    return null;
  }
}

/**
 * Batch helper — fetch many handles in parallel.
 */
export async function fetchShopifyProducts(
  handles: string[]
): Promise<Record<string, LiveProduct | null>> {
  const unique = [...new Set(handles)];
  const results = await Promise.all(
    unique.map(async (h) => [h, await fetchShopifyProduct(h)] as const)
  );
  return Object.fromEntries(results);
}

export function clearShopifyCache() {
  cache.clear();
}
