import type {
  AdviseResponse,
  Classification,
  Clarification,
  ProductQA,
  Recommendation,
  Redirect,
  SkinProfile,
} from "../lib/types";

export type IntroData = {
  text: string;
  image: Blob | null;
  imagePreviewUrl: string | null;
};

export type ViewState =
  | { kind: "intro" }
  | { kind: "quiz"; intro: IntroData }
  | { kind: "processing" }
  | { kind: "clarify"; data: Clarification; classification: Classification | null }
  | { kind: "recommend"; data: Recommendation; profile: SkinProfile }
  | { kind: "product_qa"; data: ProductQA }
  | { kind: "redirect"; data: Redirect }
  | { kind: "medical_caution"; data: Redirect }
  | { kind: "error"; message: string };

export type Action =
  | { type: "reset" }
  | { type: "intro_submit"; intro: IntroData }
  | { type: "back_to_intro" }
  | { type: "submit" }
  | { type: "result"; payload: AdviseResponse }
  | { type: "error"; message: string };

export function reducer(state: ViewState, action: Action): ViewState {
  switch (action.type) {
    case "reset":
      return { kind: "intro" };
    case "intro_submit":
      return { kind: "quiz", intro: action.intro };
    case "back_to_intro":
      return { kind: "intro" };
    case "submit":
      return { kind: "processing" };
    case "result": {
      const { response, classification, profile } = action.payload;
      switch (response.mode) {
        case "clarify":
          return { kind: "clarify", data: response as Clarification, classification };
        case "recommend":
          return { kind: "recommend", data: response as Recommendation, profile };
        case "product_qa":
          return { kind: "product_qa", data: response as ProductQA };
        case "redirect":
          return { kind: "redirect", data: response as Redirect };
        case "medical_caution":
          return { kind: "medical_caution", data: response as Redirect };
      }
      return state;
    }
    case "error":
      return { kind: "error", message: action.message };
  }
}

export const initialState: ViewState = { kind: "intro" };
