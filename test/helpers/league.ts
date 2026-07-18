import { createLeagueState, type LeagueStore } from "../../src/core/leagueState.js";
import { mulberry32 } from "../../src/engine/rng.js";

/**
 * Cached world builder for tests.
 *
 * `createLeagueState` generates the full 160-club world, which costs ~4s per
 * call — dominated by `estimatePotential`, which runs a 16-trial career
 * Monte-Carlo per player (4000 players). Tests build the same handful of
 * seeds over and over, so we generate each `(userTid, seed, genSeed)` world
 * exactly once and hand out a `structuredClone` on every call (~35ms).
 *
 * The clone is byte-identical to a fresh `createLeagueState` (verified: same
 * seed → same world, and the LeagueStore is plain cloneable data), so no test
 * observes any behavioral difference — it just skips the regeneration. Each
 * caller still gets an independent, freely-mutable copy exactly as before.
 *
 * Use this anywhere a test would otherwise call
 * `createLeagueState(tid, mulberry32(seed))`. Do NOT use it when the same rng
 * instance is reused after building the league (e.g. threaded into a later
 * `simOffseason`/`simThrough` call): those need the rng advanced by
 * generation, which a cached clone can't reproduce — keep the real
 * `createLeagueState(tid, rng)` there.
 */
const cache = new Map<string, LeagueStore>();

export function makeLeague(userTid: number, seed: number, genSeed = 0): LeagueStore {
  const key = `${userTid}:${seed}:${genSeed}`;
  let base = cache.get(key);
  if (!base) {
    base = createLeagueState(userTid, mulberry32(seed), genSeed);
    cache.set(key, base);
  }
  return structuredClone(base);
}
