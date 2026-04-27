import { useState } from "preact/hooks";
import type { QuizAnswers } from "../lib/types";

type Props = {
  onSubmit: (answers: QuizAnswers) => void;
  onBack: () => void;
};

const Q1 = {
  id: "skin_feel_midday" as const,
  label: "1 · How does your skin feel midday if you haven't applied any products?",
  options: [
    { key: "A", label: "Shiny and greasy all over" },
    { key: "B", label: "Shiny in the T-zone but tight on the cheeks" },
    { key: "C", label: "Tight, flaky, or rough" },
    { key: "D", label: "Comfortable and balanced" },
  ] as const,
};

const Q2 = {
  id: "pore_visibility" as const,
  label: "2 · How visible are your pores?",
  options: [
    { key: "A", label: "Very visible and enlarged all over" },
    { key: "B", label: "Only visible in my T-zone" },
    { key: "C", label: "Hardly visible / very small" },
    { key: "D", label: "Average-sized pores" },
  ] as const,
};

const Q3 = {
  id: "overall_sensitivity" as const,
  label: "3 · How would you describe your skin's sensitivity overall?",
  options: [
    { key: "A", label: "Very sensitive — reacts to most products" },
    { key: "B", label: "Moderately sensitive" },
    { key: "C", label: "Occasionally reactive" },
    { key: "D", label: "Not sensitive" },
  ] as const,
};

const Q4 = {
  id: "reaction_to_products" as const,
  label: "4 · How does your skin react to new skincare products?",
  options: [
    { key: "A", label: "Rarely reacts — I can use almost anything" },
    { key: "B", label: "Occasionally gets itchy or red" },
    { key: "C", label: "Frequently stings, burns, or turns red" },
    { key: "D", label: "Breaks out into small bumps immediately" },
  ] as const,
};

const Q5 = {
  id: "flushing_tendency" as const,
  label: "5 · Does your skin flush or turn red easily (exercise, spicy food, sun)?",
  options: [
    { key: "A", label: "Yes, very easily" },
    { key: "B", label: "Only after intense heat or effort" },
    { key: "C", label: "Rarely" },
  ] as const,
};

const Q6 = {
  id: "natural_tone" as const,
  label: "6 · What's your natural skin tone (in an area not exposed to sun)?",
  options: [
    { key: "A", label: "Very fair / ivory" },
    { key: "B", label: "Fair / pale" },
    { key: "C", label: "Light brown / olive" },
    { key: "D", label: "Moderate brown" },
    { key: "E", label: "Dark brown / black" },
  ] as const,
};

const Q7 = {
  id: "sun_behavior" as const,
  label: "7 · What happens when you stay in the sun without protection?",
  options: [
    { key: "A", label: "Always burns, never tans" },
    { key: "B", label: "Burns easily, tans minimally" },
    { key: "C", label: "Burns sometimes, tans gradually" },
    { key: "D", label: "Rarely burns, tans easily" },
    { key: "E", label: "Never burns, tans very deeply" },
  ] as const,
};

const CONCERNS = [
  "Active breakouts / Acne",
  "Dark spots / Hyperpigmentation",
  "Fine lines and wrinkles",
  "Redness / Visible capillaries",
  "Blackheads / Clogged pores",
  "Dullness / Lack of glow",
];

const ROUTINE_OPTIONS: { key: "1-2" | "3-4" | "5+"; label: string; note: string }[] = [
  { key: "1-2", label: "1–2 products", note: "Keep it simple" },
  { key: "3-4", label: "3–4 products", note: "A proper routine" },
  { key: "5+", label: "5+ products", note: "Full protocol" },
];

type SingleQuestion = typeof Q1 | typeof Q2 | typeof Q3 | typeof Q4 | typeof Q5 | typeof Q6 | typeof Q7;

function SingleSelect({
  q,
  value,
  onChange,
}: {
  q: SingleQuestion;
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p class="qa-question">{q.label}</p>
      <div class="qa-quiz-options">
        {q.options.map((o) => (
          <button
            key={o.key}
            type="button"
            class={`qa-quiz-option ${value === o.key ? "is-active" : ""}`}
            onClick={() => onChange(o.key)}
          >
            <span class="qa-quiz-option-letter">{o.key}.</span>
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function QuizState({ onSubmit, onBack }: Props) {
  const [answers, setAnswers] = useState<QuizAnswers>({ specific_concerns: [] });

  const set = <K extends keyof QuizAnswers>(key: K, value: QuizAnswers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const toggleConcern = (c: string) => {
    setAnswers((prev) => {
      const curr = prev.specific_concerns ?? [];
      const next = curr.includes(c) ? curr.filter((x) => x !== c) : [...curr, c];
      return { ...prev, specific_concerns: next };
    });
  };

  // Progress: 9 inputs total (7 questions + concerns + routine).
  const filled = [
    answers.skin_feel_midday,
    answers.pore_visibility,
    answers.overall_sensitivity,
    answers.reaction_to_products,
    answers.flushing_tendency,
    answers.natural_tone,
    answers.sun_behavior,
    (answers.specific_concerns ?? []).length > 0 ? "x" : undefined,
    answers.routine_commitment,
  ];

  // Allow submit once the 7 main questions are done.
  const canSubmit =
    !!answers.skin_feel_midday &&
    !!answers.pore_visibility &&
    !!answers.overall_sensitivity &&
    !!answers.reaction_to_products &&
    !!answers.flushing_tendency &&
    !!answers.natural_tone &&
    !!answers.sun_behavior;

  return (
    <div class="qa-card">
      <p class="qa-eyebrow">A few quick questions</p>
      <h2 class="qa-title">
        Help us build <em>the right profile.</em>
      </h2>
      <p class="qa-subtitle">
        Skin type, sensitivity, and sun response — these shape which actives make sense for you.
        Takes under a minute.
      </p>

      <div class="qa-quiz-progress" aria-hidden="true">
        {filled.map((f, i) => (
          <span key={i} class={f ? "is-done" : ""} />
        ))}
      </div>

      <div class="qa-quiz-section">
        <p class="qa-quiz-group-label">Skin Type</p>
        <SingleSelect
          q={Q1}
          value={answers.skin_feel_midday}
          onChange={(v) => set("skin_feel_midday", v as QuizAnswers["skin_feel_midday"])}
        />
        <SingleSelect
          q={Q2}
          value={answers.pore_visibility}
          onChange={(v) => set("pore_visibility", v as QuizAnswers["pore_visibility"])}
        />
      </div>

      <div class="qa-quiz-section">
        <p class="qa-quiz-group-label">Sensitivity & Reactivity</p>
        <SingleSelect
          q={Q3}
          value={answers.overall_sensitivity}
          onChange={(v) => set("overall_sensitivity", v as QuizAnswers["overall_sensitivity"])}
        />
        <SingleSelect
          q={Q4}
          value={answers.reaction_to_products}
          onChange={(v) => set("reaction_to_products", v as QuizAnswers["reaction_to_products"])}
        />
        <SingleSelect
          q={Q5}
          value={answers.flushing_tendency}
          onChange={(v) => set("flushing_tendency", v as QuizAnswers["flushing_tendency"])}
        />
      </div>

      <div class="qa-quiz-section">
        <p class="qa-quiz-group-label">Sun Response</p>
        <SingleSelect
          q={Q6}
          value={answers.natural_tone}
          onChange={(v) => set("natural_tone", v as QuizAnswers["natural_tone"])}
        />
        <SingleSelect
          q={Q7}
          value={answers.sun_behavior}
          onChange={(v) => set("sun_behavior", v as QuizAnswers["sun_behavior"])}
        />
      </div>

      <div class="qa-quiz-section">
        <p class="qa-quiz-group-label">Specific Concerns</p>
        <p class="qa-question" style={{ marginTop: 0 }}>
          Which currently bother you? (Select all that apply)
        </p>
        <div class="qa-concerns-multi">
          {CONCERNS.map((c) => {
            const active = (answers.specific_concerns ?? []).includes(c);
            return (
              <button
                key={c}
                type="button"
                class={`qa-quiz-option ${active ? "is-active" : ""}`}
                onClick={() => toggleConcern(c)}
              >
                <span>{c}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div class="qa-quiz-section">
        <p class="qa-quiz-group-label">Routine Commitment</p>
        <p class="qa-question" style={{ marginTop: 0 }}>
          How many products are you willing to commit to?
        </p>
        <div class="qa-routine-radio">
          {ROUTINE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              class={`qa-chip ${answers.routine_commitment === opt.key ? "is-active" : ""}`}
              onClick={() => set("routine_commitment", opt.key)}
            >
              {opt.label} · <span style={{ opacity: 0.7 }}>{opt.note}</span>
            </button>
          ))}
        </div>
      </div>

      <div class="qa-action-row">
        <button type="button" class="qa-btn--link" onClick={onBack}>
          ← Back
        </button>
        <button
          type="button"
          class="qa-btn"
          disabled={!canSubmit}
          onClick={() => onSubmit(answers)}
        >
          Get my recommendation →
        </button>
      </div>
    </div>
  );
}
