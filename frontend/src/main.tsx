import { render } from "preact";
import { App } from "./App";
import "./styles.css";

function mount() {
  const el = document.getElementById("qunat-advisor");
  if (!el) {
    console.warn("[Qunat Advisor] mount point #qunat-advisor not found");
    return;
  }
  render(<App />, el);
}

// Mount immediately if DOM is ready, otherwise wait.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
