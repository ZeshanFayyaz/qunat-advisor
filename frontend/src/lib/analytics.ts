type EventName =
  | "advisor_opened"
  | "advisor_photo_submitted"
  | "advisor_clarify_shown"
  | "advisor_clarify_answered"
  | "advisor_recommendation_shown"
  | "advisor_cta_clicked"
  | "advisor_add_to_cart_clicked"
  | "advisor_redirect_shown"
  | "advisor_medical_caution_shown";

declare global {
  interface Window {
    Shopify?: {
      routes?: { root?: string };
      analytics?: { publish?: (name: string, payload: Record<string, unknown>) => void };
    };
    gtag?: (...args: unknown[]) => void;
  }
}

const sessionId = `qa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function getSessionId() {
  return sessionId;
}

export function track(event: EventName, payload: Record<string, unknown> = {}) {
  const enriched = { ...payload, session_id: sessionId, ts: Date.now() };
  try {
    if (typeof window !== "undefined") {
      window.Shopify?.analytics?.publish?.(event, enriched);
      window.gtag?.("event", event, enriched);
    }
  } catch {
    /* noop */
  }
  // eslint-disable-next-line no-console
  console.log(`[analytics] ${event}`, enriched);
}
