import { PER90_QUALIFY_FRACTION } from "../constants.js";
import type { SeasonStats } from "../players/types.js";

/**
 * Per-90 rates: a counting stat divided by the number of 90-minute matches the
 * player's minutes add up to. The rate is what makes a squad player comparable
 * to an ever-present — a striker with 9 goals in 800 minutes outscores one with
 * 14 in 3400 — which raw totals can never show.
 *
 * Pure derivation over `SeasonStats.minutesPlayed`, which the box score already
 * records: no persisted field, no migration, and nothing here is read by the
 * sim. `CupStatLine` carries minutes in the same shape, so `per90` serves the
 * Cup tab unchanged.
 */

/**
 * `value` expressed per 90 minutes played, or `null` when no minutes are
 * recorded.
 *
 * Null rather than 0 or Infinity: with no minutes the rate is *unrepresentable*
 * rather than zero, and the distinction is visible — a season with no minutes
 * renders a dash, not a 0.00 that reads as "played and did nothing".
 */
export function per90(value: number, minutesPlayed: number): number | null {
  if (minutesPlayed <= 0) return null;
  return (value * 90) / minutesPlayed;
}

/**
 * The `SeasonStats` keys a per-90 rate is meaningful for.
 *
 * Counting stats only. `minutesPlayed` is the denominator, `appearances` is
 * context for reading the rate, and `avgRating`/`ratingSum` are already an
 * average — a "per 90" of any of them means nothing, so callers keep rendering
 * them as-is even in per-90 mode.
 */
export const PER90_STAT_KEYS = [
  "goals",
  "assists",
  "shots",
  "shotsOnTarget",
  "xg",
  "goalsAgainst",
  "xga",
  "saves",
  "tackles",
  "interceptions",
  "passes",
  "passesCompleted",
  "crosses",
  "foulsCommitted",
  "yellowCards",
  "redCards",
] as const satisfies readonly (keyof SeasonStats)[];

export type Per90StatKey = (typeof PER90_STAT_KEYS)[number];

/**
 * Minutes a player must have played to appear on a per-90 leaderboard, given
 * how many matches his competition has played so far this season.
 *
 * Scales with the season's progress for the same reason the Match Rating gate
 * does: a flat end-of-season floor is unclearable in September and the board
 * would sit empty for a third of the year.
 */
export function per90QualifyingMinutes(matchesPlayed: number): number {
  return Math.ceil(PER90_QUALIFY_FRACTION * 90 * Math.max(0, matchesPlayed));
}
