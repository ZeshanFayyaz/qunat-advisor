import { useState } from "preact/hooks";
import type { Clarification } from "../lib/types";

type Props = {
  data: Clarification;
  onAnswer: (answers: string[]) => void;
  onBack: () => void;
};

export function ClarifyState({ data, onAnswer, onBack }: Props) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState("");
  const [showFreeText, setShowFreeText] = useState(false);

  // Can continue if either all chips are selected OR the free-text has meaningful content
  const allChipsAnswered = data.questions.every((q) => selected[q.id]);
  const hasFreeText = freeText.trim().length >= 3;
  const canContinue = allChipsAnswered || hasFreeText;

  const handleSubmit = () => {
    const answers = [...Object.values(selected)];
    if (hasFreeText) answers.push(freeText.trim());
    onAnswer(answers);
  };

  return (
    <div class="qa-card">
      <p class="qa-eyebrow">One moment</p>
      <h2 class="qa-title">{data.opener}</h2>

      {data.questions.map((q) => (
        <div key={q.id} class="qa-question-block">
          <p class="qa-question">{q.text}</p>
          <div class="qa-chips">
            {q.chips.map((chip) => (
              <button
                key={chip}
                type="button"
                class={`qa-chip ${selected[q.id] === chip ? "is-active" : ""}`}
                onClick={() => setSelected({ ...selected, [q.id]: chip })}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Free-text escape hatch — always available */}
      {!showFreeText ? (
        <button
          type="button"
          class="qa-btn--link"
          style={{ marginTop: 20 }}
          onClick={() => setShowFreeText(true)}
        >
          + None of these fit — let me describe it
        </button>
      ) : (
        <div style={{ marginTop: 20 }}>
          <p class="qa-question" style={{ marginTop: 0 }}>
            Describe it in your own words
          </p>
          <textarea
            class="qa-textarea-inline"
            placeholder="E.g., the marks are only around my mouth and they're patchy, not distinct spots…"
            value={freeText}
            maxLength={600}
            autoFocus
            onInput={(e) => setFreeText((e.currentTarget as HTMLTextAreaElement).value)}
          />
        </div>
      )}

      <div class="qa-action-row">
        <button type="button" class="qa-btn--link" onClick={onBack}>
          ← Start over
        </button>
        <button type="button" class="qa-btn" disabled={!canContinue} onClick={handleSubmit}>
          Continue →
        </button>
      </div>
    </div>
  );
}
