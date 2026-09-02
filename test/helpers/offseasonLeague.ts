import { createLeagueState, type LeagueStore } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";

/**
 * A fresh world with one full season played THROUGH to the offseason phase —
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
/**
 * Play one season THROUGH to the offseason phase.
 *
 * simThrough HALTS before the user's own cup final rather than playing it, so
 * one call does not reliably finish a season — it finishes one only when the
 * user's club happens not to reach a final. Any test that chains seasons has to
 * account for that, or `simOffseason` is handed a league still in the regular
 * phase, silently does nothing, and the test fails somewhere unrelated.
 *
 * Surfaced when the big four gained a third division: with 60 English clubs
 * instead of 40 the domestic cups draw differently, and seeds that had never
 * put the user's club in a final started to. Nothing about the sim was wrong.
 * `internationalEquivalence.test.ts` already carried its own "clear any
 * cup-final halt" second call for exactly this.
 *
 * Byte-identical for a seed that never halts: the loop exits before calling
 * simThrough a second time, so no extra rng is drawn.
 */
export function playSeason(league: LeagueStore, rng: () => number): LeagueStore {
  let out = league;
  for (let i = 0; i < 4 && out.phase !== "offseason"; i++) {
    out = simThrough(out, "season", rng);
  }
  // Loudly, rather than handing back a half-played season for a test to fail on
  // in some unrelated assertion — which is the failure mode this replaced.
  if (out.phase !== "offseason") {
    throw new Error(`playSeason: season did not finish (phase ${out.phase})`);
  }
  return out;
}

export function playFullSeason(rng: () => number) {
  let league = createLeagueState(0, rng);
  // simThrough HALTS before the user's own cup final rather than playing it, so
  // one call does not reliably finish a season — it finishes one only when the
  // user's club happens not to reach a final. That made this helper silently
  // seed- and world-dependent: it returned a league still in the regular phase,
  // simOffseason then did nothing, and the tests failed reading an empty
  // seasonHistory rather than anything to do with their subject.
  //
  // Surfaced when the big four gained a third division: with 60 English clubs
  // instead of 40 the domestic cup draws differently, and seeds 6 and 7 started
  // putting the user's club in the final. Nothing about the sim was wrong.
  // `internationalEquivalence.test.ts` already carried its own "clear any
  // cup-final halt" second call for exactly this.
  //
  // Looping is byte-identical for a seed that never halts, since the loop exits
  // before calling simThrough a second time. See playSeason.
  league = playSeason(league, rng);
  return league;
}
