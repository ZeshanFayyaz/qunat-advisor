import type { ProductQA } from "../lib/types";
import { pdpUrl } from "../lib/cart";
import { track } from "../lib/analytics";

type Props = {
  data: ProductQA;
  onReset: () => void;
};

export function ProductQAState({ data, onReset }: Props) {
  return (
    <div class="qa-card">
      <p class="qa-eyebrow">About the formula</p>
      <p class="qa-redirect-body" style={{ fontSize: 16 }}>{data.answer}</p>

      {data.cta && data.cta.product && (
        <button
          class="qa-btn"
          type="button"
          onClick={() => {
            track("advisor_cta_clicked", { slug: data.cta!.slug, cta: "qa" });
            window.location.href = pdpUrl(data.cta!.product!.shopify_handle);
          }}
        >
          {data.cta.text} →
        </button>
      )}

      <div class="qa-footer-actions">
        <span />
        <button class="qa-btn--link" type="button" onClick={onReset}>
          Ask another question →
        </button>
      </div>
    </div>
  );
}
