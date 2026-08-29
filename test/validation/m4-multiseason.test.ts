import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { computeStandings } from "../../src/core/standings.js";
import { ROSTER_CAP } from "../../src/core/constants.js";
import { competitionTeamCount } from "../../src/core/competitions.js";

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
      // Measured PER COMPETITION and scaled to a 38-game season, then averaged —
      // not as the best and worst club in one world-wide table.
      //
      // The pooled version was a world-wide max and min, which stopped being a
      // league statistic the moment divisions stopped all being 20 clubs (see
      // Competition.teamCount). Points are a function of games played, so the
      // worst club in the world is now whoever sits bottom of the SHORTEST
      // season — Scotland's 10-club second division, 18 games — and the gate
      // read 8.8 against a floor of 10 while every league in the world was
      // healthy. Same fault the M3 top-scorer gate had ("a world-wide max is not
      // a league statistic") and the M1 benchmark gate had ("average team must
      // mean the average team"): the estimator was wrong, not the band.
      //
      // The bands below are unchanged and still describe a full 38-game season,
      // which is exactly what this now measures: 78.9 / 27.3 against 70-100 and
      // 10-38.
      const perComp = league.competitions.map((comp) => {
        const tids = league.teams.filter((t) => t.compId === comp.id).map((t) => t.tid);
        const own = new Set(tids);
        const table = computeStandings(
          tids,
          league.played.filter((m) => own.has(m.home) && own.has(m.away)),
        );
        const games = (competitionTeamCount(comp) - 1) * 2;
        return {
          champ: (table[0].points / games) * 38,
          bottom: (table[table.length - 1].points / games) * 38,
        };
      });
      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      champPoints.push(mean(perComp.map((c) => c.champ)));
      bottomPoints.push(mean(perComp.map((c) => c.bottom)));
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
