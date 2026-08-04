import type { SeasonStats } from "../players/types.js";

/**
 * The stats the all-time leaderboards rank by.
 *
 * Deliberately the same set the per-season Stat Leaders page offers, so moving
 * between the two doesn't change which questions you can ask — only the span
 * they cover.
 */
export const ALL_TIME_STAT_KEYS = [
  "goals", "assists", "shots", "shotsOnTarget", "xg", "saves", "tackles",
  "interceptions", "passes", "crosses", "foulsCommitted", "minutesPlayed",
  "appearances", "avgRating",
] as const;

export type AllTimeStatKey = (typeof ALL_TIME_STAT_KEYS)[number];

/** Career totals, one number per ranked stat. `avgRating` is a per-appearance mean, not a sum. */
export type StatTotals = Record<AllTimeStatKey, number>;

/**
 * A player's best single season in one stat.
 *
 * `appearances` rides along because the rate stats (`avgRating`) need a
 * qualification floor, and a retiree's per-season lines are deleted with him —
 * without this the UI could not apply the same floor to the living and the
 * retired, and a one-game cameo from 40 seasons ago would top the board forever.
 */
export interface BestSeasonLine {
  value: number;
  season: number;
  appearances: number;
}

export type BestSeasons = Record<AllTimeStatKey, BestSeasonLine>;

/** One season's value for a ranked stat. */
function valueOf(s: SeasonStats, key: AllTimeStatKey): number {
  return s[key];
}

export function emptyTotals(): StatTotals {
  return Object.fromEntries(ALL_TIME_STAT_KEYS.map((k) => [k, 0])) as StatTotals;
}

export function emptyBestSeasons(): BestSeasons {
  return Object.fromEntries(
    ALL_TIME_STAT_KEYS.map((k) => [k, { value: 0, season: 0, appearances: 0 }]),
  ) as BestSeasons;
}

/**
 * Sum a player's season lines into career totals.
 *
 * Only seasons with an appearance count: a stat line of all zeros is a season
 * he didn't play, and including it would drag `avgRating` toward nothing.
 */
export function totalsOf(stats: readonly SeasonStats[]): StatTotals {
  const totals = emptyTotals();
  let ratingSum = 0;
  for (const s of stats) {
    if (s.appearances <= 0) continue;
    for (const k of ALL_TIME_STAT_KEYS) {
      if (k === "avgRating") continue;
      totals[k] += valueOf(s, k);
    }
    ratingSum += s.ratingSum;
  }
  // Per appearance, not per season, so a 3-game cameo doesn't weigh the same as
  // a 38-game campaign.
  totals.avgRating = totals.appearances > 0 ? ratingSum / totals.appearances : 0;
  return totals;
}

/** A player's best individual season in each ranked stat, and when it was. */
export function bestSeasonsOf(stats: readonly SeasonStats[]): BestSeasons {
  const best = emptyBestSeasons();
  for (const s of stats) {
    if (s.appearances <= 0) continue;
    for (const k of ALL_TIME_STAT_KEYS) {
      const v = valueOf(s, k);
      if (v > best[k].value) {
        best[k] = { value: v, season: s.season, appearances: s.appearances };
      }
    }
  }
  return best;
}
