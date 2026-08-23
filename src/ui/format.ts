import { weeklyWage } from "../core/contracts.js";
import type { CompletedTransfer } from "../core/transfers/negotiation.js";
import { isFreeAgentTid } from "../core/transfers/negotiation.js";
import { per90 } from "../core/stats/per90.js";

/**
 * Cell text for a per-90 rate, shared by every surface that shows one so the
 * columns read alike.
 *
 * Two decimals below 10 and one at or above it: goals and assists per 90 live
 * around 0.2-1.2, where the second decimal *is* the difference between players,
 * while passes per 90 runs to ~50, where it is noise and hurts scanning. A
 * player with no recorded minutes gets an em dash — his rate is unmeasurable,
 * which is a different thing from a player who played and produced nothing.
 */
export function per90Text(value: number, minutesPlayed: number): string {
  const rate = per90(value, minutesPlayed);
  if (rate === null) return "—";
  return rate >= 10 ? rate.toFixed(1) : rate.toFixed(2);
}

export const currency = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
});

/** Short money for tight spots like chart axis labels: "$48M", "$2.5M". */
export const currencyCompact = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1,
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

/**
 * The year season 1 falls in when a save doesn't say otherwise — every save
 * made before the start-year picker existed, and the value the picker itself
 * defaults to.
 */
export const SEASON_START_YEAR = 2026;

/**
 * Internally a season is a 1-based counter; every surface shows it as a real
 * year instead. Which year season 1 lands on is a per-save choice
 * (`meta.startYear`), purely cosmetic — nothing in the sim reads it.
 *
 * The active save's value is held here as module state rather than passed to
 * all ~90 call sites, because it changes exactly once per save load and half
 * those call sites are inside render helpers with no league to hand. Set it
 * through `setSeasonStartYear` from LeagueContext's `commitLeague`, which is
 * the single funnel every league (loaded, created, imported, switched away)
 * passes through — so there is no path that can leave this stale. Anything
 * rendering a season for a save that is NOT the active one must use
 * `seasonYearFrom` with that save's own start year.
 */
let activeStartYear = SEASON_START_YEAR;

/** Point the display at a save's start year; `undefined` restores the default. */
export function setSeasonStartYear(startYear: number | undefined): void {
  activeStartYear = startYear ?? SEASON_START_YEAR;
}

export function seasonYear(season: number): number {
  return seasonYearFrom(activeStartYear, season);
}

/** Season → year against an explicit start year, for saves other than the active one. */
export function seasonYearFrom(startYear: number, season: number): number {
  return startYear + season - 1;
}

/** Bounds on the start-year picker: wide enough to be fun, narrow enough to stay a year. */
export const MIN_START_YEAR = 1900;
export const MAX_START_YEAR = 2400;

/** A start year the picker will accept, or null if it isn't a usable year. */
export function normalizeStartYear(input: string): number | null {
  if (!/^\d{1,4}$/.test(input.trim())) return null;
  const year = Number(input.trim());
  if (year < MIN_START_YEAR || year > MAX_START_YEAR) return null;
  return year;
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
