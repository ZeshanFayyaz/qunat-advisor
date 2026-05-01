import { useState } from "preact/hooks";
import { getSessionId } from "../lib/analytics";

interface Props {
  entryPoint: "intro" | "result";
  topConcern?: string;
  allConcerns?: string;
  skinType?: string | null;
  fitzpatrick?: string | null;
  routineSize?: string | null;
  variant?: "compact" | "full";
}

function apiBase(): string {
  if (typeof window !== "undefined" && (window as any).QUNAT_ADVISOR_API) {
    return ((window as any).QUNAT_ADVISOR_API as string).replace(/\/$/, "");
  }
  return "";
}

export function EmailCaptureCard({
  entryPoint,
  topConcern = "general",
  allConcerns = "",
  skinType = null,
  fitzpatrick = null,
  routineSize = null,
  variant = "full",
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    try {
      await fetch(`${apiBase()}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          topConcern,
          allConcerns,
          skinType,
          fitzpatrick,
          routineSize,
          entryPoint,
          sessionId: getSessionId(),
        }),
      });
      setSubmitted(true);
    } catch {
      // Silent fail — don't block UX
      setSubmitted(true);
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div class={`qa-email-card qa-email-card--${variant} qa-email-card--done`}>
        <p class="qa-email-thanks">Thanks — we'll be in touch with personalized tips.</p>
      </div>
    );
  }

  return (
    <div class={`qa-email-card qa-email-card--${variant}`}>
      <p class="qa-email-eyebrow">Personalized for you</p>
      <h3 class="qa-email-title">
        {variant === "compact"
          ? "Get tailored skincare tips"
          : "Save your routine — get tailored tips"}
      </h3>
      <p class="qa-email-sub">
        {variant === "compact"
          ? "Drop your email and we'll send recommendations matched to your skin."
          : "We'll send personalized advice and product drops matched to your specific skin profile."}
      </p>
      <div class="qa-email-form">
        <input
          type="text"
          class="qa-email-input"
          placeholder="Your name"
          value={name}
          onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
        />
        <input
          type="email"
          class="qa-email-input"
          placeholder="you@example.com"
          value={email}
          onInput={(e) => setEmail((e.currentTarget as HTMLInputElement).value)}
        />
        <button
          type="button"
          class="qa-btn"
          disabled={!email.trim() || submitting}
          onClick={handleSubmit}
        >
          {submitting ? "Saving..." : "Sign me up →"}
        </button>
      </div>
    </div>
  );
}