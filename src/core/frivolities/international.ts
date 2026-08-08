import type { LeagueStore } from "../leagueState.js";
import { allCareers, topBy, type CareerRow } from "./careers.js";

/** How many rows the all-time international boards show. */
export const INTL_ALL_TIME_LIMIT = 30;

/**
 * What an all-time international board ranks by.
 *
 * Deliberately *not* folded into `ALL_TIME_STAT_KEYS`. Those are league stats
 * off `SeasonStats` — a career total plus a best-single-season figure, ranked
 * with an appearance floor. International football keeps none of that: a
 * player's record is three running counters on `Player.intl` with no per-season
 * lines behind them once he's archived, and there is no "best season" to rank.
 * Sharing the key set would mean faking half of `StatTotals`/`BestSeasons` for
 * every career in the world.
 */
export const INTL_ALL_TIME_KEYS = ["intlGoals", "caps", "intlTitles"] as const;

export type IntlAllTimeKey = (typeof INTL_ALL_TIME_KEYS)[number];

/** The figure a row is ranked by. */
export function intlStatOf(row: CareerRow, key: IntlAllTimeKey): number {
  if (key === "caps") return row.caps;
  if (key === "intlTitles") return row.intlTitles;
  return row.intlGoals;
}

/**
 * The all-time international leaderboard for one counter, best first.
 *
 * Reads `allCareers`, so it covers **active players and archived retirees
 * alike** — which is the entire point of the board. International records are
 * the ones most likely to be lost otherwise: a nation's all-time top scorer is
 * by definition a long career, so he is usually retired, and retirement deletes
 * him from `league.players` outright (`simOffseason` step 3). A board built off
 * the live pool would quietly mean "top scorers among whoever is still playing"
 * and would hand the record to a different man every few seasons.
 *
 * `nationality` filters to one country's record book — "who is Brazil's all-time
 * leading scorer" is the question this page is actually for, and worldwide the
 * board is dominated by whoever plays the most qualifiers.
 *
 * Pure, read-only and rng-free.
 *
 * One inherited limitation, shared with every other Frivolities board:
 * `allCareers` keeps only careers with at least one senior *league* appearance,
 * and archived retirees have to clear the archive's quality gate. A capped
 * player who somehow never played a club game, or a retiree the archive dropped,
 * is not here. Both are rare enough at the top of a leaderboard to be worth the
 * consistency of one shared flattener.
 */
export function allTimeInternational(
  league: LeagueStore,
  key: IntlAllTimeKey,
  nationality: string | null = null,
  limit = INTL_ALL_TIME_LIMIT,
): CareerRow[] {
  const rows = nationality
    ? allCareers(league).filter((r) => r.nationality === nationality)
    : allCareers(league);
  return topBy(rows, (r) => intlStatOf(r, key), limit);
}

/**
 * Every country with at least one capped career on record, alphabetical.
 *
 * Drawn from the same rows the board ranks, so the dropdown can never offer a
 * country that filters to an empty table.
 */
export function cappedNationalities(league: LeagueStore): string[] {
  const seen = new Set<string>();
  for (const r of allCareers(league)) {
    if (r.caps > 0) seen.add(r.nationality);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}
