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
import posthog from "posthog-js";
import { App } from "./App.js";

posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
  api_host: import.meta.env.VITE_POSTHOG_HOST,
  defaults: "2026-05-30",
  // Autocapture fires an event on essentially every click, which in a game
  // this click-heavy meant 685k events in 30 days: 67% of all volume, and
  // ~170 events per visitor per day. That exhausted the 1M-events/month free
  // allowance on 2026-08-03, at which point PostHog stopped ingesting and we
  // lost all analytics (only $exception kept flowing, on its own quota).
  //
  // Nothing reads that data. Every dashboard and insight is built on the
  // explicit events in analytics.ts, whose own rule is "a handful of
  // meaningful moments, not one event per click". Turning autocapture off
  // does NOT affect $pageview (documented on the config option itself), so
  // web analytics, referrers and acquisition reporting are unchanged.
  autocapture: false,
  // Crash reports were previously invisible: error tracking had zero issues
  // recorded because exceptions were never captured, so a "the transfers page
  // keeps crashing" report came with no stack trace to work from. This sends
  // unhandled errors and rejections to error tracking; ErrorBoundary also
  // reports the ones React swallows on its way to unmounting the tree.
  capture_exceptions: true,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
