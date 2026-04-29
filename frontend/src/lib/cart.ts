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

      // Notify the theme that the cart changed so the icon/drawer re-renders.
      // Different themes listen for different events — dispatch all common ones.
      try {
        // Dawn / modern Shopify themes
        document.dispatchEvent(new CustomEvent("cart:refresh"));
        document.dispatchEvent(new CustomEvent("cart:added"));
        document.dispatchEvent(new CustomEvent("cart:updated"));
        // Older / generic themes
        document.dispatchEvent(new Event("cart-updated"));
        // Fetch cart fresh — many themes refresh their state on this
        await fetch("/cart.js").then(r => r.json()).then(cart => {
          document.dispatchEvent(new CustomEvent("cart:change", { detail: cart }));
          // Update Dawn's cart-bubble count if present
          const bubble = document.querySelector(".cart-count-bubble");
          if (bubble) {
            const span = bubble.querySelector("span[aria-hidden]");
            if (span) span.textContent = String(cart.item_count);
            const visuallyHidden = bubble.querySelector(".visually-hidden");
            if (visuallyHidden) visuallyHidden.textContent = `${cart.item_count} items`;
          }
          // If no bubble exists yet (cart was empty), the parent might need it created.
          // Trigger a header section refresh — Dawn supports this via Section Rendering API.
          fetch("/?sections=cart-icon-bubble,cart-drawer")
            .then(r => r.json())
            .then(sections => {
              if (sections["cart-icon-bubble"]) {
                const cartIcon = document.querySelector("#cart-icon-bubble");
                if (cartIcon) cartIcon.innerHTML = sections["cart-icon-bubble"];
              }
              if (sections["cart-drawer"]) {
                const cartDrawer = document.querySelector("cart-drawer");
                if (cartDrawer) cartDrawer.innerHTML = sections["cart-drawer"];
              }
            })
            .catch(() => {});
        });
      } catch {
        /* Theme doesn't support these events — that's OK, cart still works on next page load */
      }

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
