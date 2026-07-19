import "bootstrap/dist/css/bootstrap.min.css";
// Self-hosted IBM Plex (no runtime CDN, no layout shift). Only the weights the
// UI actually uses are loaded. Sans carries the whole interface; Mono is used
// for scores and stat numerals to get the broadcast-scoreboard feel.
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { App } from "./App.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
);
