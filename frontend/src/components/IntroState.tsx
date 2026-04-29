import { useRef, useState } from "preact/hooks";
import { downscaleImage } from "../lib/imageProcess";
import { SamplePhotosModal } from "./SamplePhotosModal";
import type { IntroData } from "../state/machine";
import { track } from "../lib/analytics";

type Props = {
  onSubmit: (data: IntroData) => void;
};

type Path = "photo" | "words" | "tags";

const CHIPS = [
  "Breakouts",
  "Dark spots",
  "Dullness",
  "Dryness",
  "Fine lines",
  "Oily skin",
  "Redness",
  "Rough texture",
];

export function IntroState({ onSubmit }: Props) {
  const [activePath, setActivePath] = useState<Path>("photo");
  const [thumb, setThumb] = useState<{ url: string; blob: Blob; name: string } | null>(null);
  const [text, setText] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [showSample, setShowSample] = useState(false);
  const [working, setWorking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    const blob = await downscaleImage(file);
    const url = URL.createObjectURL(blob);
    setThumb({ url, blob, name: file.name });
  };

  const toggleChip = (c: string) => {
    setChips((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c].slice(0, 4)));
  };

  const canSubmit = !working && (thumb || text.trim().length > 0 || chips.length > 0);

  const submit = () => {
    if (!canSubmit) return;
    setWorking(true);
    const combined = [chips.length ? chips.join(", ") : "", text.trim()]
      .filter(Boolean)
      .join(". ");
    onSubmit({
      text: combined,
      image: thumb?.blob ?? null,
      imagePreviewUrl: thumb?.url ?? null,
    });
  };

  return (
    <>
      <div class="qa-card">
        <p class="qa-eyebrow">Skin Advisor</p>
        <h2 class="qa-title">
          Tell us about your skin — <em>your way.</em>
        </h2>
        <p class="qa-subtitle">
          Pick any path below. Combine them for the best match.
        </p>

        {/* Three-path tabs */}
        <div class="qa-path-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activePath === "photo"}
            class={`qa-path-tab ${activePath === "photo" ? "is-active" : ""}`}
            onClick={() => setActivePath("photo")}
          >
            <span class="qa-path-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </span>
            <span class="qa-path-label">Picture</span>
            <span class="qa-path-sub">{thumb ? "Photo ready" : "Take or upload"}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activePath === "words"}
            class={`qa-path-tab ${activePath === "words" ? "is-active" : ""}`}
            onClick={() => setActivePath("words")}
          >
            <span class="qa-path-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 19h16M4 5l8 12L20 5" />
              </svg>
            </span>
            <span class="qa-path-label">Own Words</span>
            <span class="qa-path-sub">
              {text ? `${text.length} chars` : "Write about it"}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activePath === "tags"}
            class={`qa-path-tab ${activePath === "tags" ? "is-active" : ""}`}
            onClick={() => setActivePath("tags")}
          >
            <span class="qa-path-recommended">Recommended</span>
            <span class="qa-path-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 12V4h8l10 10-8 8L3 12z" />
                <circle cx="8" cy="8" r="1.5" fill="currentColor" />
              </svg>
            </span>
            <span class="qa-path-label">Tags</span>
            <span class="qa-path-sub">
              {chips.length > 0 ? `${chips.length} selected` : "Tap concerns"}
            </span>
          </button>
        </div>

        {/* Active path content */}
        <div class="qa-path-content">
          {activePath === "photo" && (
            <div>
              {!thumb ? (
                <>
                  <label class="qa-capture-primary">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      // @ts-ignore
                      onChange={(e) => handleFile((e.currentTarget as HTMLInputElement).files?.[0])}
                    />
                    <svg class="qa-camera-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <p class="qa-capture-label">Add a photo</p>
                    <p class="qa-capture-hint">Take new or choose from gallery · no filters</p>
                  </label>
                  <button
                    type="button"
                    class="qa-photo-sample-link"
                    style={{ marginTop: 14, display: "inline-block" }}
                    onClick={() => setShowSample(true)}
                  >
                    See sample photos →
                  </button>
                </>
              ) : (
                <div class="qa-thumb">
                  <img src={thumb.url} alt="Your skin" />
                  <div class="qa-thumb-info">
                    <strong>{thumb.name.slice(0, 40)}</strong>
                    <span>Ready to analyze</span>
                  </div>
                  <button
                    class="qa-btn--link"
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(thumb.url);
                      setThumb(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    Retake
                  </button>
                </div>
              )}
            </div>
          )}

          {activePath === "words" && (
            <textarea
              class="qa-intro-textarea"
              placeholder="My skin has been breaking out on my chin for weeks, and the marks from old breakouts just won't fade. I have combination skin and live somewhere humid…"
              value={text}
              maxLength={1200}
              autoFocus
              onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
            />
          )}

          {activePath === "tags" && (
            <div class="qa-chips">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  class={`qa-chip ${chips.includes(c) ? "is-active" : ""}`}
                  onClick={() => toggleChip(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        <div class="qa-action-row">
          <p class="qa-trust" style={{ marginTop: 0 }}>
            We don't store your photo. Analysis runs once, then it's gone.
          </p>
          <button class="qa-btn" disabled={!canSubmit} onClick={submit} type="button">
            Continue →
          </button>
        </div>
      </div>

      {/* Always-visible Instagram consultation — safety net for significant concerns */}
      <div class="qa-instagram qa-instagram--intro">
        <div class="qa-instagram-icon">
          <svg viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="#fff" stroke="none" />
          </svg>
        </div>
        <div class="qa-instagram-body">
          <strong>Significant skin concerns?</strong>
          <span>
            Get a free in-depth consultation with one of our licensed skin specialists — DM us on
            Instagram at <b>@qunatbeauty</b>.
          </span>
        </div>
        <a
          class="qa-instagram-cta"
          href="https://instagram.com/qunatbeauty"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("advisor_cta_clicked", { cta: "instagram_intro" })}
        >
          Open DMs →
        </a>
      </div>

      {showSample && <SamplePhotosModal onClose={() => setShowSample(false)} />}
    </>
  );
}
