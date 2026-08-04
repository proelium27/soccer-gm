import { createLeagueState, type LeagueStore } from "../../src/core/leagueState.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { loadFixture } from "./worldCache.js";

/**
 * Cached world builder for tests.
 *
 * `createLeagueState` generates the full 240-club / 6000-player world at ~4.1s
 * a call, and the suite asks for the same handful of seeds over and over — 36
 * test files build a world, and `makeLeague(0, 1)` alone appears 64 times.
 * Because vitest runs each file in its own worker process, an in-process memo
 * dies at every file boundary, so each of those files used to pay full
 * generation again.
 *
 * So worlds are cached **on disk** (see `worldCache.ts`): each distinct
 * `(userTid, seed, genSeed)` is generated once ever and thereafter parsed back
 * in ~12ms — ~340x faster, and it survives across both files and runs. The
 * cache key is a content hash of everything that can affect generation, so a
 * source change rebuilds rather than serving a stale world.
 *
 * This is only sound because generation is deterministic: two same-seed worlds
 * are byte-identical apart from `meta.created`, a wall-clock stamp (asserted in
 * `fixtureFidelity.test.ts`). A cached world therefore carries the `created` of
 * the run that first built it — no test reads it, and freezing it is if
 * anything more deterministic than before.
 *
 * Each caller still gets an independent, freely-mutable world, exactly as
 * before; JSON re-parsing replaces `structuredClone` and is both equivalent
 * and faster (12ms vs 25ms).
 *
 * Use this anywhere a test would otherwise call
 * `createLeagueState(tid, mulberry32(seed))`. Do NOT use it when the same rng
 * instance is reused after building the league (e.g. threaded into a later
 * `simOffseason`/`simThrough` call): those need the rng advanced by
 * generation, which a cached world can't reproduce — keep the real
 * `createLeagueState(tid, rng)` there. Known exceptions live in
 * `international.test.ts`, `offseason.test.ts`, `simThrough.test.ts`,
 * `transfersRender.test.tsx`, the m3/m4 validation gates, and one case in
 * `loans.test.ts`.
 */
export function fixtureNameFor(userTid: number, seed: number, genSeed = 0): string {
  return `world-${userTid}-${seed}-${genSeed}`;
}

export function makeLeague(userTid: number, seed: number, genSeed = 0): LeagueStore {
  return loadFixture(fixtureNameFor(userTid, seed, genSeed), () =>
    createLeagueState(userTid, mulberry32(seed), genSeed),
  );
}
