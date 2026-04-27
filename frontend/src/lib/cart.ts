/**
 * Add to cart — Shopify AJAX API in production, console log in local demo.
 *
 * Shopify Liquid sets window.QUNAT_ADVISOR_SHOPIFY = true on the storefront.
 */

declare global {
  interface Window {
    QUNAT_ADVISOR_SHOPIFY?: boolean;
  }
}

export function pdpUrl(handle: string): string {
  if (typeof window !== "undefined" && window.Shopify?.routes?.root) {
    return `${window.Shopify.routes.root}products/${handle}?utm_source=skin_advisor`;
  }
  return `#demo-pdp-${handle}`;
}

export async function addToCart(handles: string[]): Promise<{ ok: boolean; url: string }> {
  // In Shopify, get variant IDs via /products/{handle}.js
  if (typeof window !== "undefined" && window.QUNAT_ADVISOR_SHOPIFY) {
    try {
      const variants = await Promise.all(
        handles.map((h) =>
          fetch(`/products/${h}.js`).then((r) => r.json()).then((d: any) => d.variants?.[0]?.id)
        )
      );
      const ids = variants.filter(Boolean);
      if (ids.length === 0) return { ok: false, url: "/cart" };
      await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: ids.map((id) => ({ id, quantity: 1 })) }),
      });
      return { ok: true, url: "/cart" };
    } catch {
      return { ok: false, url: "/cart" };
    }
  }

  // Local demo: log and succeed
  // eslint-disable-next-line no-console
  console.log("[demo cart] Would add to cart:", handles);
  return { ok: true, url: "#demo-cart" };
}
