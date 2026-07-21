import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";

/**
 * Split out of m4-multiseason.test.ts so this full-world 5-season sim runs on
 * its own vitest file (and its own CI shard) in parallel with the table-spread
 * gate, instead of running serially after it. See the note in that file.
 *
 * Complements the table-spread stability gate: over the same 5-season chain
 * with real offseasons, the league must never produce pid collisions or
 * orphaned roster entries (a player id on a roster that no longer exists in
 * league.players).
 */
describe("M4 — multi-season integrity", () => {
  const SEASONS = 5;

  it("league runs 5 seasons without pid collisions or orphaned rosters", () => {
    const rng = mulberry32(99);
    let league = createLeagueState(0, rng);

    for (let s = 0; s < SEASONS; s++) {
      league = simThrough(league, "season", rng);
      league = simOffseason(league, rng);
    }

    const pids = league.players.map((p) => p.pid);
    expect(new Set(pids).size).toBe(pids.length);

    const playerSet = new Set(pids);
    for (const t of league.teams) {
      for (const pid of t.roster) expect(playerSet.has(pid)).toBe(true);
    }
  });
});
