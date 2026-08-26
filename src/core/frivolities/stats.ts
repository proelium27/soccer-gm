import type { SeasonStats } from "../players/types.js";
import {
  ALL_TIME_STAT_KEYS, emptyTotals, emptyBestSeasons, summaryOf,
  type AllTimeStatKey, type StatTotals, type BestSeasonLine, type BestSeasons,
} from "../players/careerSummary.js";

/**
 * The all-time board vocabulary now lives in `players/careerSummary.ts`, and is
 * re-exported here so the boards keep importing it from where they always have.
 *
 * It moved because a `Player` has to carry his own summary (a career is 45.2 MB
 * across a save and is moving to disk — see docs/lazy-career-plan.md), and a
 * type on `Player` cannot come from `frivolities/`. One definition, so the
 * stored summary and the boards ranking it can never disagree about what a
 * "career total" is.
 *
 * Deliberately the same set the per-season Stat Leaders page offers, so moving
 * between the two doesn't change which questions you can ask — only the span
 * they cover.
 */
export {
  ALL_TIME_STAT_KEYS, emptyTotals, emptyBestSeasons,
  type AllTimeStatKey, type StatTotals, type BestSeasonLine, type BestSeasons,
};

/**
 * Sum a player's season lines into career totals.
 *
 * Thin wrappers over `summaryOf` so there is exactly one fold: these are what
 * the stored summary must equal, and `test/core/careerSummary.test.ts` pins that.
 */
export function totalsOf(stats: readonly SeasonStats[]): StatTotals {
  return summaryOf(stats, NO_OVR).totals;
}

/** A player's best individual season in each ranked stat, and when it was. */
export function bestSeasonsOf(stats: readonly SeasonStats[]): BestSeasons {
  return summaryOf(stats, NO_OVR).best;
}

/**
 * Neither totals nor bests depend on the rating a season was played at — only
 * `CareerSummary.seasons` does, and neither of these two returns it. So the
 * lookup is stubbed rather than threading a ratings history through callers
 * that have no use for one.
 */
const NO_OVR = () => 0;
