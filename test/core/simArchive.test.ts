import { describe, it, expect, beforeAll } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { detachArchive, reattachArchive } from "../../src/core/simArchive.js";
import { pruneRetireeArchive } from "../../src/core/players/archive.js";
import type { ArchivedPlayer } from "../../src/core/players/archive.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { englandCompetitions } from "../../src/core/competitions.js";
import type { LeagueStore } from "../../src/core/leagueState.js";

/**
 * The gate for core/simArchive.ts.
 *
 * Holding history back from the worker is only safe while the sim never reads
 * it. A read would see an empty array — no type error, no crash, just quietly
 * wrong output — so the test that matters is the end-to-end equivalence: a
 * detached round trip must land on exactly the league an undetached one does.
 */
describe("simArchive", () => {
  /**
   * One aged England-only league, shared by every case.
   *
   * Two deliberate economies, because what this file asserts is structural and
   * a slow test file here is not free: the whole suite runs its files in
   * parallel, and `test/db/leagueDb.test.ts` sits on 5s timeouts that a heavy
   * neighbour pushes it past. Two divisions instead of sixteen competitions
   * costs a fraction of the sim and proves exactly the same property, and one
   * league shared across cases beats building it four times over (nothing here
   * mutates it). Three seasons is the floor that gives real snapshots *and* a
   * real retiree archive to merge against.
   *
   * `createLeagueState` rather than `makeLeague`: the rng is reused after
   * generation, so it has to be the one generation advanced (see the note on
   * the helper).
   */
  let league: LeagueStore;
  beforeAll(() => {
    const rng = mulberry32(41);
    league = createLeagueState(0, rng, 0, "normal", englandCompetitions());
    for (let i = 0; i < 3; i++) {
      league = simThrough(league, "season", rng);
      league = simOffseason(league, rng);
    }
  }, 600_000);

  it("detach empties exactly the held-back fields and keeps everything else", () => {
    const { payload, archive } = detachArchive(league);

    expect(archive.powerRankingHistory.length).toBeGreaterThan(0);
    expect(archive.retiredPlayers.length).toBeGreaterThan(0);
    expect(payload.powerRankingHistory).toEqual([]);
    expect(payload.retiredPlayers).toEqual([]);

    // Nothing else may be disturbed — the sim reads the rest.
    const rest = (l: LeagueStore) => ({ ...l, powerRankingHistory: [], retiredPlayers: [] });
    expect(rest(payload)).toEqual(rest(league));
  });

  it("an offseason on a detached league lands where an undetached one does", () => {
    const whole = simOffseason(league, mulberry32(7));

    const { payload, archive } = detachArchive(league);
    const detached = reattachArchive(simOffseason(payload, mulberry32(7)), archive);

    expect(detached).toEqual(whole);
  });

  it("a season plus its offseason lands where an undetached run does", () => {
    const rngA = mulberry32(9);
    const whole = simOffseason(simThrough(league, "season", rngA), rngA);

    const { payload, archive } = detachArchive(league);
    const rngB = mulberry32(9);
    const detached = reattachArchive(
      simOffseason(simThrough(payload, "season", rngB), rngB),
      archive,
    );

    expect(detached).toEqual(whole);
    // The point of the exercise: the worker never carried the old history.
    expect(detached.powerRankingHistory.length).toBeGreaterThan(
      archive.powerRankingHistory.length,
    );
  });

  it("what comes back in the held-back fields is only the new entries", () => {
    const { payload, archive } = detachArchive(league);
    const rng = mulberry32(11);
    const result = simOffseason(simThrough(payload, "season", rng), rng);

    // Not the accumulated history — that is the whole saving.
    expect(result.powerRankingHistory.length).toBeLessThan(archive.powerRankingHistory.length);
    for (const snap of result.powerRankingHistory) {
      expect(snap.season).toBe(league.season);
    }
  });

  it("pruning the merged archive once matches pruning it every season", () => {
    // careerScore is a pure function of a row, so iterated eviction and a
    // single final top-N must select the same set. Rows are stand-ins; only
    // the ordering key matters.
    const row = (pid: number, apps: number): ArchivedPlayer =>
      ({ pid, totals: { appearances: apps }, best: {}, seasons: [] }) as unknown as ArchivedPlayer;

    const seasons = [
      [row(1, 500), row(2, 10)],
      [row(3, 400), row(4, 20)],
      [row(5, 300), row(6, 30)],
    ];

    let iterated: ArchivedPlayer[] = [];
    for (const batch of seasons) iterated = pruneRetireeArchive([...iterated, ...batch], 3);

    const atOnce = pruneRetireeArchive(seasons.flat(), 3);

    expect(iterated.map((r) => r.pid)).toEqual(atOnce.map((r) => r.pid));
  });
});
