import type { Redirect } from "../lib/types";
import { track } from "../lib/analytics";

type Props = {
  data: Redirect;
  onChipSelect: (chip: string) => void;
  onReset: () => void;
};

export function RedirectState({ data, onChipSelect, onReset }: Props) {
  const isMedical = data.mode === "medical_caution";
  return (
    <div class="qa-card">
      {isMedical && <span class="qa-medical-badge">A note</span>}
      <h2 class="qa-title" style={{ fontSize: 24 }}>
        <em>
          {isMedical
            ? "Let's get this seen properly first."
            : "That's outside what I can help with."}
        </em>
      </h2>
      <p class="qa-redirect-body">{data.message}</p>

      {data.suggested_chips && data.suggested_chips.length > 0 && !isMedical && (
        <div class="qa-chips">
          {data.suggested_chips.map((chip) => (
            <button
              key={chip}
              type="button"
              class="qa-chip"
              onClick={() => onChipSelect(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Instagram consultation — for medical caution or when severity was significant */}
      {data.instagram_consultation && (
        <div class="qa-instagram" style={{ marginTop: 24 }}>
          <div class="qa-instagram-icon">
            <svg viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="#fff" stroke="none" />
            </svg>
          </div>
          <div class="qa-instagram-body">
            <strong>Want personal guidance?</strong>
            <span>
              DM us on Instagram at @qunatbeauty for a free in-depth consultation with one of our
              licensed skin specialists.
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

      <div class="qa-footer-actions">
        <span />
        <button class="qa-btn--link" type="button" onClick={onReset}>
          Start over →
        </button>
      </div>
    </div>
  );
}
