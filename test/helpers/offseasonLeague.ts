import { createLeagueState } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";

/**
 * A fresh world with one full season played, left in the offseason phase —
 * the starting point for almost every offseason test.
 *
 * Takes the caller's `rng` and threads it through generation *and* the season,
 * so the rng handed back to a later `simOffseason` is advanced exactly as it
 * would be in a real save. That is why this can't use the cached `makeLeague`
 * fixture (see the note on `test/helpers/league.ts`): a cached world skips
 * generation, so the rng arrives in the wrong state and every downstream draw
 * shifts.
 *
 * It is therefore ~55s a call, which is the entire cost of the offseason test
 * files — they are split across several files so CI can run them in parallel
 * rather than serially on one shard. See `test/helpers/shardPartition.ts`.
 */
export function playFullSeason(rng: () => number) {
  let league = createLeagueState(0, rng);
  league = simThrough(league, "season", rng);
  return league;
}
