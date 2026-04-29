import { useEffect, useState } from "preact/hooks";

const MESSAGES = [
  "Reading your skin…",
  "Mapping to the right formula…",
  "Cross-checking ingredients…",
  "Composing your routine…",
];

export function ProcessingState() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % MESSAGES.length), 1400);
    return () => clearInterval(t);
  }, []);

  return (
    <div class="qa-card qa-processing" aria-live="polite">
      <p class="qa-processing-text">{MESSAGES[idx]}</p>

      <div class="qa-progress-track" aria-hidden="true">
        <div class="qa-progress-fill" />
      </div>

      <p class="qa-processing-meta">
        Building a routine that's right for <em>your</em> skin.
      </p>
    </div>
  );
}
