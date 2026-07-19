import posthog from "posthog-js";

// Custom gameplay events, reported to PostHog.
//
// The whole game runs client-side (state lives in IndexedDB and never reaches a
// server), so these events are our ONLY window into what players actually do.
// PostHog is used instead of Vercel Web Analytics because Vercel gates *custom
// events* behind a paid plan — PostHog's free tier shows them (and page views)
// with no plan upgrade. `<Analytics />` in main.tsx still reports page views to
// Vercel too; that part is free and left as-is.
//
// Two rules keep the dashboard useful and privacy-clean:
//   1. Keep the event set small and stable — a handful of meaningful moments,
//      not one event per click. (Autocapture is deliberately OFF below.)
//   2. Property values must stay LOW-CARDINALITY: bucketed/enumerated strings
//      and small numbers only. Never send raw player/team ids, names, or
//      anything that could identify or fingerprint a person — PostHog groups
//      the dashboard by these values, so high-cardinality props make it
//      unreadable AND leak detail we don't want.

/** Every gameplay event and the exact shape of its properties. */
export interface GameEvents {
  /** A brand-new save was created. */
  league_created: { country: string; tier: 1 | 2 };
  /** The user simulated forward. `through` is how far (one game … a season). */
  season_simmed: { through: "game" | "month" | "deadline" | "season" };
  /** The user advanced past the offseason into a new season. */
  offseason_advanced: Record<string, never>;
  /** The user made a transfer bid for another club's player. */
  transfer_offer_made: Record<string, never>;
  /** The user accepted an AI club's offer for one of their players. */
  inbound_offer_accepted: Record<string, never>;
  /** The user signed a free agent to their senior roster. */
  free_agent_signed: Record<string, never>;
  /** The user changed their team's formation. */
  formation_changed: { formation: string };
  /** The user listed one of their players for loan. */
  player_loaned_out: { seasons: 1 | 2 | 3 };
}

let ready = false;

/**
 * Start PostHog. Reads the project key from `VITE_POSTHOG_KEY` (a public,
 * client-side ingest key — safe to ship in the bundle). If it's unset — e.g. a
 * local dev build with no key — analytics stays completely off and every
 * `trackEvent` call below is a silent no-op, so the game runs identically
 * whether or not analytics is configured. Call once, before the app renders.
 */
export function initAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return;
  try {
    posthog.init(key, {
      // Signup gives you a host; US cloud is the default.
      api_host: import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com",
      // Auto page views on client-side route changes (BrowserRouter), so we get
      // per-page feature usage without hand-instrumenting every page.
      capture_pageview: "history_change",
      capture_pageleave: true,
      // Anonymous site — don't mint a person profile per visitor.
      person_profiles: "identified_only",
      // We hand-pick the meaningful events below; keep the stream clean and
      // privacy-safe rather than logging every click/keystroke.
      autocapture: false,
    });
    ready = true;
  } catch {
    // Analytics must never break the game.
  }
}

/**
 * Report a gameplay event. Typed so a call can't send the wrong props, and
 * wrapped so analytics can never throw into gameplay — a tracking failure
 * should be invisible to the player. A no-op until `initAnalytics()` has run
 * with a configured key.
 */
export function trackEvent<K extends keyof GameEvents>(
  name: K,
  ...props: GameEvents[K] extends Record<string, never> ? [] : [GameEvents[K]]
): void {
  if (!ready) return;
  try {
    posthog.capture(name, props[0]);
  } catch {
    // Analytics must never break the game.
  }
}
