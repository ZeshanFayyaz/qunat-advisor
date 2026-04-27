import { useEffect, useReducer, useRef } from "preact/hooks";
import { initialState, reducer, IntroData } from "./state/machine";
import { advise } from "./lib/api";
import { track } from "./lib/analytics";
import type { QuizAnswers } from "./lib/types";
import { IntroState } from "./components/IntroState";
import { QuizState } from "./components/QuizState";
import { ProcessingState } from "./components/ProcessingState";
import { ClarifyState } from "./components/ClarifyState";
import { RecommendState } from "./components/RecommendState";
import { ProductQAState } from "./components/ProductQAState";
import { RedirectState } from "./components/RedirectState";

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const lastIntro = useRef<IntroData | null>(null);
  const lastQuiz = useRef<QuizAnswers | null>(null);
  const priorClassification = useRef<unknown>(null);

  useEffect(() => {
    track("advisor_opened");
  }, []);

  const submitToAPI = async (opts: {
    text: string;
    image: Blob | null;
    quiz?: QuizAnswers | null;
    clarifyAnswers?: string[];
  }) => {
    dispatch({ type: "submit" });
    track(opts.image ? "advisor_photo_submitted" : "advisor_clarify_answered", {
      text_length: opts.text.length,
    });
    try {
      const res = await advise({
        text: opts.text,
        image: opts.image,
        quiz: opts.quiz ?? undefined,
        priorClassification: priorClassification.current ?? undefined,
        clarifyAnswers: opts.clarifyAnswers,
      });
      priorClassification.current = res.classification;

      if (res.mode === "clarify") track("advisor_clarify_shown");
      if (res.mode === "recommend") track("advisor_recommendation_shown");
      if (res.mode === "redirect") track("advisor_redirect_shown");
      if (res.mode === "medical_caution") track("advisor_medical_caution_shown");

      dispatch({ type: "result", payload: res });
    } catch (e: any) {
      dispatch({ type: "error", message: e?.message ?? "Something went wrong" });
    }
  };

  const reset = () => {
    priorClassification.current = null;
    lastIntro.current = null;
    lastQuiz.current = null;
    dispatch({ type: "reset" });
  };

  return (
    <div class="qunat-advisor">
      {state.kind === "intro" && (
        <IntroState
          onSubmit={(data) => {
            lastIntro.current = data;
            dispatch({ type: "intro_submit", intro: data });
          }}
        />
      )}

      {state.kind === "quiz" && (
        <QuizState
          onBack={() => dispatch({ type: "back_to_intro" })}
          onSubmit={(answers) => {
            lastQuiz.current = answers;
            submitToAPI({
              text: state.intro.text,
              image: state.intro.image,
              quiz: answers,
            });
          }}
        />
      )}

      {state.kind === "processing" && <ProcessingState />}

      {state.kind === "clarify" && (
        <ClarifyState
          data={state.data}
          onBack={reset}
          onAnswer={(answers) => {
            submitToAPI({
              text: lastIntro.current?.text ?? "",
              image: null,
              quiz: lastQuiz.current,
              clarifyAnswers: answers,
            });
          }}
        />
      )}

      {state.kind === "recommend" && (
        <RecommendState
          data={state.data}
          classification={priorClassification.current as any}
          profile={state.profile}
          onReset={reset}
        />
      )}

      {state.kind === "product_qa" && (
        <ProductQAState data={state.data} onReset={reset} />
      )}

      {state.kind === "redirect" && (
        <RedirectState
          data={state.data}
          onChipSelect={(chip) => submitToAPI({ text: chip, image: null, quiz: lastQuiz.current })}
          onReset={reset}
        />
      )}

      {state.kind === "medical_caution" && (
        <RedirectState data={state.data} onChipSelect={() => {}} onReset={reset} />
      )}

      {state.kind === "error" && (
        <div class="qa-card">
          <p class="qa-eyebrow">Hmm</p>
          <h2 class="qa-title" style={{ fontSize: 24 }}>
            Something didn't work.
          </h2>
          <p class="qa-redirect-body">{state.message}. Want to try again?</p>
          <button class="qa-btn" type="button" onClick={reset}>
            Start over →
          </button>
        </div>
      )}
    </div>
  );
}
