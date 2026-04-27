import type { AdviseResponse, Product } from "./types";

declare global {
  interface Window {
    QUNAT_ADVISOR_API?: string;
  }
}

/**
 * Dev: same origin (Vite proxies /api to backend).
 * Prod: window.QUNAT_ADVISOR_API set by the Shopify Liquid block.
 */
function apiBase(): string {
  if (typeof window !== "undefined" && window.QUNAT_ADVISOR_API) {
    return window.QUNAT_ADVISOR_API.replace(/\/$/, "");
  }
  return "";
}

export async function advise(opts: {
  text?: string;
  image?: Blob | null;
  quiz?: unknown;
  priorClassification?: unknown;
  clarifyAnswers?: string[];
}): Promise<AdviseResponse> {
  const fd = new FormData();
  if (opts.text) fd.append("text", opts.text);
  if (opts.image) fd.append("image", opts.image, "skin.jpg");
  if (opts.quiz) fd.append("quiz", JSON.stringify(opts.quiz));
  if (opts.priorClassification)
    fd.append("prior_classification", JSON.stringify(opts.priorClassification));
  if (opts.clarifyAnswers?.length)
    fd.append("clarify_answers", JSON.stringify(opts.clarifyAnswers));

  const res = await fetch(`${apiBase()}/api/advise`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(`advise_failed_${res.status}`);
  return (await res.json()) as AdviseResponse;
}

export async function getProducts(): Promise<Product[]> {
  const res = await fetch(`${apiBase()}/api/products`);
  if (!res.ok) throw new Error("products_failed");
  const data = await res.json();
  return data.products;
}

export async function postFeedback(payload: {
  session_id: string;
  rating: "up" | "down";
  slug?: string;
  classification: unknown;
  comment?: string;
}) {
  try {
    await fetch(`${apiBase()}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // fire and forget
  }
}
