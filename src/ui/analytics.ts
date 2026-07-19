import { track } from "@vercel/analytics";
import posthog from "posthog-js";

// Custom gameplay events reported to Vercel Web Analytics.
//
// The whole game runs client-side (state lives in IndexedDB and never reaches a
// server), so these track() calls are our ONLY window into what players
// actually do. `<Analytics />` in main.tsx already reports page views for free;
// this adds the in-game actions page views can't see.
//
// Two rules keep the dashboard useful and privacy-clean:
//   1. Keep the event set small and stable — a handful of meaningful moments,
//      not one event per click.
//   2. Property values must stay LOW-CARDINALITY: bucketed/enumerated strings
//      and small numbers only. Never send raw player/team ids, names, or
//      anything that could identify or fingerprint a person — Vercel groups the
//      dashboard by these values, so high-cardinality props make it unreadable
//      AND leak detail we don't want.

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
  /** The user released a player from their senior roster. */
  player_released: Record<string, never>;
  /** The user extended a player's contract on their senior roster. */
  contract_extended: Record<string, never>;
  /** The user signed a prospect to their youth academy. */
  player_signed_to_academy: Record<string, never>;
  /** The user promoted an academy player to the senior roster. */
  player_promoted_from_academy: Record<string, never>;
  /** The user accepted an AI club's loan offer for one of their listed players. */
  loan_offer_accepted: Record<string, never>;
  /** The user imported a save file. */
  league_imported: Record<string, never>;
}

/**
 * Report a gameplay event. Typed so a call can't send the wrong props, and
 * wrapped so analytics can never throw into gameplay — a tracking failure
 * should be invisible to the player. In dev, Vercel's track() just logs to the
 * console instead of sending anything.
 */
export function trackEvent<K extends keyof GameEvents>(
  name: K,
  ...props: GameEvents[K] extends Record<string, never> ? [] : [GameEvents[K]]
): void {
  try {
    track(name, props[0]);
  } catch {
    // Analytics must never break the game.
  }
  try {
    posthog.capture(name, props[0]);
  } catch {
    // Analytics must never break the game.
  }
}
