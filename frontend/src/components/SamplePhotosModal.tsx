import { useEffect } from "preact/hooks";

type Props = {
  onClose: () => void;
};

// Simple SVG illustrations embedded as data URIs — stay crisp, no external loads.
const GOOD = [
  {
    caption: "Natural daylight, face the window",
    bg: "linear-gradient(135deg, #f4e8d8 0%, #d9c19a 100%)",
    eyebrow: "✓",
  },
  {
    caption: "Bare skin, no filters",
    bg: "linear-gradient(135deg, #f7f3ed 0%, #c4b29b 100%)",
    eyebrow: "✓",
  },
  {
    caption: "Face centered, neutral look",
    bg: "linear-gradient(135deg, #e8dcc8 0%, #a88f6f 100%)",
    eyebrow: "✓",
  },
];
const BAD = [
  {
    caption: "Overhead light, harsh shadows",
    bg: "linear-gradient(135deg, #2a2a28 0%, #5a5248 100%)",
    eyebrow: "✕",
  },
  {
    caption: "Filters or beauty mode on",
    bg: "linear-gradient(135deg, #f7e6f0 0%, #c88ab0 100%)",
    eyebrow: "✕",
  },
  {
    caption: "Makeup covering the concern",
    bg: "linear-gradient(135deg, #d4b89a 0%, #b5906c 100%)",
    eyebrow: "✕",
  },
];

export function SamplePhotosModal({ onClose }: Props) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    // Lock body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div class="qa-modal-backdrop" onClick={onClose}>
      <div
        class="qa-modal"
        role="dialog"
        aria-labelledby="qa-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="qa-modal-title">How to take a photo the advisor can read.</h3>
        <p>
          Good lighting matters more than a good camera. A quick guide below — aim for the top row.
        </p>

        <div class="qa-section-label" style={{ marginTop: 0 }}>What works</div>
        <div class="qa-sample-grid">
          {GOOD.map((s) => (
            <div key={s.caption} class="qa-sample">
              <div class="qa-sample-img" style={{ background: s.bg }} />
              <div class="qa-sample-caption is-good">
                <strong>{s.eyebrow}</strong> {s.caption}
              </div>
            </div>
          ))}
        </div>

        <div class="qa-section-label">What to avoid</div>
        <div class="qa-sample-grid">
          {BAD.map((s) => (
            <div key={s.caption} class="qa-sample">
              <div class="qa-sample-img" style={{ background: s.bg }} />
              <div class="qa-sample-caption is-bad">
                <strong>{s.eyebrow}</strong> {s.caption}
              </div>
            </div>
          ))}
        </div>

        <div class="qa-action-row qa-action-row--bare">
          <span />
          <button class="qa-btn" onClick={onClose} type="button">
            Got it →
          </button>
        </div>
      </div>
    </div>
  );
}
