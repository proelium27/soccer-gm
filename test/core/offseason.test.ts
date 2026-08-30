/**
 * Offseason: the season rollover itself — phase/schedule, squad floors,
 * promotion and relegation, and pool integrity.
 *
 * Part of the offseason suite, which is split across several files.
 *
 * Not for tidiness: every test here plays its own full season (~55s), and as a
 * single file that ran to ~32 minutes on CI — long enough that it *was* the
 * build, since a shard can never be faster than its slowest file. Vitest gives
 * each file its own worker, so splitting is what lets these run in parallel.
 * `test/helpers/shardPartition.ts` then keeps the pieces on different shards.
 *
 * Tests are independent (each builds its own seeded rng), so they can move
 * between these files freely — keep a new one with its subject.
 */

import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { simOffseason } from "../../src/core/offseason.js";
import { playFullSeason } from "../helpers/offseasonLeague.js";
import { worldCompetitions, competitionTeamCount } from "../../src/core/competitions.js";
import {
  NUM_TEAMS, ROSTER_SAFETY_FLOOR,
} from "../../src/core/constants.js";

describe("simOffseason", () => {
  it("is a no-op unless the league is in the offseason phase", () => {
    const rng = mulberry32(1);
    const league = createLeagueState(0, rng);
    const result = simOffseason(league, rng);
    expect(result).toBe(league);
  });

  it("advances the season, resets schedule/played, and returns to regular phase", () => {
    const rng = mulberry32(2);
    const league = playFullSeason(rng);
    expect(league.phase).toBe("offseason");

    const next = simOffseason(league, rng);
    expect(next.season).toBe(league.season + 1);
    expect(next.phase).toBe("regular");
    expect(next.played).toEqual([]);
    expect(next.schedule).toHaveLength(7092);
  });

  it("every team stays at or above the roster safety floor after progression/retirement/FA/youth", () => {
    const rng = mulberry32(3);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);

    // AI clubs now buy and sell in the transfer market, so a squad isn't
    // pinned to the 25-man composition anymore — ROSTER_SAFETY_FLOOR (the
    // same invariant runAITransferMarket enforces per-sale and the user's
    // own academy emergency call-up targets) is the real floor, not a fixed
    // squad size.
    //
    // Checked as a DISTRIBUTION, not as a minimum over all 480 clubs, because
    // nothing in the game actually enforces the floor against ordinary attrition
    // (retirement and contract expiry are not sales, and `ensureUserRosterSafety`
    // can only promote academy players the club has). The floor is a target, and
    // a min over 480 clubs in a chaotic sim is not the statistic that measures
    // it — the same lesson as the M3 top-scorer gate, where a world-wide max was
    // standing in for a league statistic.
    //
    // Measured on this seed, following five seasons: `origin/main` dips to 16
    // (the user's own club, season 4) and this file only ever looked at season 1,
    // where it happened to land exactly on 18 — so it was passing by luck. Across
    // eight seeds the 5th percentile is 21 on every one, on both sides, and the
    // dips recover by the next offseason. So: a hard floor at the engine's real
    // requirement (11 fit players, below which selectXI silently leaves slots
    // empty), and the healthy-squad target asserted where it's meaningful.
    const sizes = next.teams.map((t) => t.roster.length).sort((a, b) => a - b);
    expect(sizes[0]).toBeGreaterThanOrEqual(11);
    expect(sizes[Math.floor(sizes.length * 0.05)]).toBeGreaterThanOrEqual(ROSTER_SAFETY_FLOOR);
    // Divisions have their real sizes now, so this is the sum of the table
    // rather than 12 x (NUM_TEAMS + NUM_TEAMS_D2). Derived so it does not need
    // touching again the next time a country or a size changes; the point of the
    // assertion is that the offseason neither loses nor gains a club.
    expect(next.teams).toHaveLength(
      worldCompetitions().reduce((n, c) => n + competitionTeamCount(c), 0),
    );
  });

  it("swaps 3 up / 3 down between divisions and records pre-swap compsByTid", () => {
    const rng = mulberry32(6);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);

    const history = next.seasonHistory.at(-1)!;
    const d1Before = Object.values(history.compsByTid).filter((d) => d === 0).length;
    const d2Before = Object.values(history.compsByTid).filter((d) => d === 1).length;
    expect(d1Before).toBe(20);
    expect(d2Before).toBe(20);

    // Still 20-and-20 after the swap (composition changed, counts didn't).
    const d1After = next.teams.filter((t) => t.compId === 0).length;
    const d2After = next.teams.filter((t) => t.compId === 1).length;
    expect(d1After).toBe(20);
    expect(d2After).toBe(20);
  });

  it("swaps the number of clubs each league was set up for, including none at all", () => {
    const rng = mulberry32(6);
    const league = playFullSeason(rng);

    // The same played season, settled by two different pyramids. One up and one
    // down moves exactly two clubs per country; a league set to none moves
    // nobody, which is the case that would silently swap whole divisions if
    // computeCountrySwaps ever went back to slicing by a zero count.
    // `playoffFormat: "none"` alongside, because this is a test about promotion
    // COUNTS and a playoff is a different axis: Germany runs the German format
    // even at a single place, where the top-flight club holding on means that
    // country moves nobody at all. That is correct behaviour (see
    // promotionPlayoff.test.ts, which covers it directly) and it would make the
    // count here depend on a simulated tie.
    const withSpots = (promotionSpots: number) => ({
      ...league,
      competitions: league.competitions.map((c) => ({
        ...c, promotionSpots, playoffFormat: "none" as const,
      })),
    });
    const one = simOffseason(withSpots(1), rng);
    const closed = simOffseason(withSpots(0), rng);

    const moved = (next: typeof league) => {
      const before = new Map(league.teams.map((t) => [t.tid, t.compId]));
      return next.teams.filter((t) => before.get(t.tid) !== t.compId).length;
    };
    expect(moved(one)).toBe(2 * 12); // two clubs each, twelve countries
    expect(moved(closed)).toBe(0);
    // Division sizes hold either way.
    expect(closed.teams.filter((t) => t.compId === 0)).toHaveLength(NUM_TEAMS);
    expect(one.teams.filter((t) => t.compId === 0)).toHaveLength(NUM_TEAMS);
  });

  it("every roster keeps at least one GK after the offseason", () => {
    const rng = mulberry32(4);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);
    const playerMap = new Map(next.players.map((p) => [p.pid, p]));

    for (const team of next.teams) {
      const gkCount = team.roster.filter((pid) => playerMap.get(pid)?.pos === "GK").length;
      expect(gkCount).toBeGreaterThan(0);
    }
  });

  it("no duplicate pids exist across the player pool after offseason", () => {
    const rng = mulberry32(6);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);
    const pids = next.players.map((p) => p.pid);
    expect(new Set(pids).size).toBe(pids.length);
  });
});
