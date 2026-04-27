import { useEffect, useState } from "preact/hooks";

const MESSAGES = [
  "Reading your skin…",
  "Mapping to the right formula…",
  "Cross-checking ingredients…",
  "Composing your routine…",
];

export function ProcessingState() {
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Rotating copy
    const messageTimer = setInterval(
      () => setIdx((i) => (i + 1) % MESSAGES.length),
      1400
    );
    return () => clearInterval(messageTimer);
  }, []);

  useEffect(() => {
    // Progress bar that fills smoothly to ~95% over 7 seconds.
    // It never hits 100 — the response landing animates the final 5%.
    let raf = 0;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      // Logistic curve — feels natural, slows as it approaches 95%.
      const t = elapsed / 7000;
      const pct = Math.min(95, 95 * (1 - Math.exp(-t * 2)));
      setProgress(pct);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div class="qa-card qa-processing" aria-live="polite">
      <p class="qa-processing-text">{MESSAGES[idx]}</p>

      <div class="qa-progress-track" aria-hidden="true">
        <div class="qa-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <p class="qa-processing-meta">
        Building a routine that's right for <em>your</em> skin.
      </p>
    </div>
  );
}
