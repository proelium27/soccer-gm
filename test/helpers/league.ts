import { createLeagueState, type LeagueStore } from "../../src/core/leagueState.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { loadFixture } from "./worldCache.js";

/**
 * Cached world builder for tests.
 *
 * `createLeagueState` generates the full world, and vitest runs every test file
 * in its own worker process, so a plain in-process memo dies at each file
 * boundary and the same world is regenerated in every file that wants one.
 * Worlds are therefore cached **on disk** (see `worldCache.ts`): each distinct
 * `(userTid, seed, genSeed)` is generated once ever and thereafter parsed back.
 *
 * Measured 2026-09-03 on the shipped 626-club / 15,650-player world, on an idle
 * machine:
 *
 *   generation (`createLeagueState`)   6.8s
 *   first `makeLeague` in a worker     110ms   (disk read + parse)
 *   later calls in the same file        66ms   (memo hit, still re-parsed)
 *   serialized fixture                25.7 MB
 *
 * So a cached world is ~60x cheaper than generating one, not free. **A call
 * still costs ~70-110ms and allocates 15,650 fresh player objects**, which is
 * why a file that calls this once per `it` is worth hoisting to one shared
 * fixture when the tests only read it — and why a test whose subject needs a
 * handful of players, or none at all, is better off hand-building them.
 *
 * (Those numbers replace a much older set describing a 240-club / 6,000-player
 * world at 4.1s to generate and 12ms to load. They were three world-expansions
 * stale, and they were the figures people were budgeting against when deciding
 * a per-test load was harmless.)
 *
 * This is only sound because generation is deterministic: two same-seed worlds
 * are byte-identical apart from `meta.created`, a wall-clock stamp (asserted in
 * `fixtureFidelity.test.ts`). A cached world therefore carries the `created` of
 * the run that first built it — no test reads it, and freezing it is if
 * anything more deterministic than before.
 *
 * Each caller still gets an independent, freely-mutable world.
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
 *
 * **Every distinct `(userTid, seed, genSeed)` is a separate 25.7 MB fixture
 * that has to be regenerated after any `src/core` change.** Prefer an existing
 * seed over a new one unless the test genuinely depends on a different world;
 * `npm run test:clean-worlds` prunes the directories left behind by old hashes.
 */
export function fixtureNameFor(userTid: number, seed: number, genSeed = 0): string {
  return `world-${userTid}-${seed}-${genSeed}`;
}

export function makeLeague(userTid: number, seed: number, genSeed = 0): LeagueStore {
  return loadFixture(fixtureNameFor(userTid, seed, genSeed), () =>
    createLeagueState(userTid, mulberry32(seed), genSeed),
  );
}
