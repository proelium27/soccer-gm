import { weeklyWage } from "../core/contracts.js";
import type { CompletedTransfer } from "../core/transfers/negotiation.js";
import { isFreeAgentTid } from "../core/transfers/negotiation.js";

export const currency = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
});

/**
 * Fee-cell text for a completed transfer, distinguishing loan moves from
 * permanent ones. A loan-out carries the (small) loan fee; a loan return is
 * always fee-less — showing it as a bare "Free"/"$0" reads like a mystery
 * free transfer (it's the player simply coming home off loan).
 */
export function transferFeeLabel(t: CompletedTransfer): string {
  if (t.loanReturn) return "Loan return";
  if (t.loanSeasons) {
    return t.fee > 0 ? `${currency.format(t.fee)} (loan)` : "Loan";
  }
  return t.fee > 0 ? currency.format(t.fee) : "Free";
}

/** Present a stored per-season salary as the weekly wage the design calls for. */
export function formatWeeklyWage(seasonSalary: number): string {
  return `${currency.format(weeklyWage(seasonSalary))}/wk`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Internally seasons are a 1-based counter; display them as real years starting 2026. */
export const SEASON_START_YEAR = 2026;
export function seasonYear(season: number): number {
  return SEASON_START_YEAR + season - 1;
}

/** Flavor text for a negotiation that collapsed (lowball/non-improving repeat/patience ran out). */
const TALKS_COLLAPSED_MESSAGES = [
  "That's not an offer worth considering.",
  "Talks have broken down for this window.",
  "That offer isn't going to get this deal done.",
  "No longer interested in doing business this window.",
  "That number isn't close enough to restart talks.",
];

/** Deterministic per-player pick so the message doesn't change across re-renders. */
export function talksCollapsedMessage(pid: number): string {
  return TALKS_COLLAPSED_MESSAGES[pid % TALKS_COLLAPSED_MESSAGES.length];
}

/**
 * Display name for one side of a transfer, mapping the free-agent sentinel to
 * "Free agent" (see FREE_AGENT_TID). Every surface that renders a raw
 * fromTid/toTid needs this — a sentinel that slips through shows up as
 * "Unknown" or "Team -1" next to a placeholder crest. `lookup` is whatever the
 * caller already has to hand (a Map, or a find over league.teams).
 */
export function clubDisplayName(
  tid: number,
  lookup: (tid: number) => string | undefined,
): string {
  return isFreeAgentTid(tid) ? "Free agent" : lookup(tid) ?? "Unknown";
}
