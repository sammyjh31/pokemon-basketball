import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { openBrowserSaves } from "./game/saveStorage";
import "./styles.css";
import "./onboarding.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/roboto-condensed/latin-700.css";
import "@fontsource/roboto-condensed/latin-800.css";
// Large saves live in IndexedDB; load them before the first synchronous read.
void openBrowserSaves().then(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);

import "./roster.css";
import "./scouting.css";
import "./results.css";

import "@fontsource/jersey-10/latin-400.css";
import "./kanto.css";

import "./retro-system.css";
import "./retro-franchise.css";
import "./retro-competition.css";
import "./retro-draft.css";
import "./retro-arcade.css";

import "./draftPolish.css";

import "./competitionPolish.css";
