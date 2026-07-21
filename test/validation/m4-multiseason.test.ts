import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { computeStandings } from "../../src/core/standings.js";
import { ROSTER_CAP } from "../../src/core/constants.js";

/**
 * §8 gates were validated at M1/M3 for a single generated season. M4 adds
 * progression, retirement, free agency, and youth intake between seasons —
 * this is the real risk for constant drift (ratings creeping up/down over
 * many simulated seasons). Re-check the table-spread gate across a chain of
 * simulated seasons with real offseasons in between, not just fresh leagues.
 */
describe("M4 — multi-season stability", () => {
  const SEASONS = 5;

  it("champion/bottom points spread stays in range across chained seasons", () => {
    const rng = mulberry32(2024);
    let league = createLeagueState(0, rng);

    const champPoints: number[] = [];
    const bottomPoints: number[] = [];
    const rosterSizes: number[] = [];

    for (let s = 0; s < SEASONS; s++) {
      league = simThrough(league, "season", rng);
      const table = computeStandings(league.teams.map((t) => t.tid), league.played);
      champPoints.push(table[0].points);
      bottomPoints.push(table[table.length - 1].points);
      // AI teams get trimmed back to target composition each offseason; the
      // user's team is intentionally left alone (release is a manual action),
      // so only AI rosters are checked for bloat here.
      for (const t of league.teams) {
        if (t.tid !== league.meta.userTid) rosterSizes.push(t.roster.length);
      }

      league = simOffseason(league, rng);
    }

    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

    expect(avg(champPoints)).toBeGreaterThanOrEqual(70);
    expect(avg(champPoints)).toBeLessThanOrEqual(100);
    expect(avg(bottomPoints)).toBeGreaterThanOrEqual(10);
    expect(avg(bottomPoints)).toBeLessThanOrEqual(38);

    // AI rosters stay sane (no team collapses or balloons over 5 offseasons).
    // AI clubs now buy in the transfer market, so a squad can carry up to the
    // roster cap between offseason trims (not just the 25-man composition).
    for (const size of rosterSizes) {
      expect(size).toBeGreaterThanOrEqual(18);
      expect(size).toBeLessThanOrEqual(ROSTER_CAP);
    }
  });

  // NOTE: the second multi-season gate (pid-collision / orphaned-roster
  // integrity) lives in m4-multiseason-integrity.test.ts. Each of these
  // gates sims the full 240-club world over 5 seasons (~2min each), so they
  // are split into separate files: vitest runs files in parallel, and in CI
  // vitest --shard spreads them across separate runners. Keeping both in one
  // file made it the ~4-min long pole that pinned the whole suite.
});
