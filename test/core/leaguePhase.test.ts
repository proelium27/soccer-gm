import { describe, it, expect } from "vitest";
import {
  drawLeaguePhase, leaguePhaseTable, splitLeaguePhase, leaguePhaseComplete,
} from "../../src/core/cup/leaguePhase.js";
import type { CupLeaguePhase, LeaguePhaseMatch } from "../../src/core/cup/types.js";
import {
  CUP_LEAGUE_PHASE_SIZE, CUP_LEAGUE_PHASE_GAMES, CUP_LEAGUE_PHASE_POTS,
  CUP_LEAGUE_PHASE_MATCHDAYS, CUP_LP_DIRECT_QF, CUP_LP_PLAYOFF_TEAMS,
} from "../../src/core/constants.js";

/** 20 fake qualifiers, tids 0..19, four per "league" (compId 0..4) — like the real 4×4 + 2×2 field. */
function fakeField(): { teams: number[]; compOf: Map<number, number> } {
  const teams = Array.from({ length: CUP_LEAGUE_PHASE_SIZE }, (_, i) => i);
  const compOf = new Map<number, number>();
  teams.forEach((t) => compOf.set(t, Math.floor(t / 4))); // 5 comps of 4
  return { teams, compOf };
}

const perPot = CUP_LEAGUE_PHASE_GAMES / CUP_LEAGUE_PHASE_POTS;
const potSize = CUP_LEAGUE_PHASE_SIZE / CUP_LEAGUE_PHASE_POTS;
const potOf = (tid: number): number => Math.floor(tid / potSize); // teams are seed-ordered 0..19

describe("drawLeaguePhase", () => {
  const { teams, compOf } = fakeField();
  const matches = drawLeaguePhase(teams, compOf, 42);

  it("schedules the right number of matches", () => {
    expect(matches.length).toBe((CUP_LEAGUE_PHASE_SIZE * CUP_LEAGUE_PHASE_GAMES) / 2);
  });

  it("gives every club exactly CUP_LEAGUE_PHASE_GAMES distinct opponents", () => {
    for (const tid of teams) {
      const opps = matches
        .filter((m) => m.home === tid || m.away === tid)
        .map((m) => (m.home === tid ? m.away : m.home));
      expect(opps.length).toBe(CUP_LEAGUE_PHASE_GAMES);
      expect(new Set(opps).size).toBe(CUP_LEAGUE_PHASE_GAMES); // no repeat opponent
      expect(opps).not.toContain(tid); // no self
    }
  });

  it("gives every club perPot opponents from each pot", () => {
    for (const tid of teams) {
      const opps = matches
        .filter((m) => m.home === tid || m.away === tid)
        .map((m) => (m.home === tid ? m.away : m.home));
      const byPot = new Array(CUP_LEAGUE_PHASE_POTS).fill(0);
      opps.forEach((o) => byPot[potOf(o)]++);
      for (const c of byPot) expect(c).toBe(perPot);
    }
  });

  it("balances home and away games", () => {
    for (const tid of teams) {
      const home = matches.filter((m) => m.home === tid).length;
      const away = matches.filter((m) => m.away === tid).length;
      expect(home).toBe(CUP_LEAGUE_PHASE_GAMES / 2);
      expect(away).toBe(CUP_LEAGUE_PHASE_GAMES / 2);
    }
  });

  it("never pairs two clubs from the same league", () => {
    for (const m of matches) expect(compOf.get(m.home)).not.toBe(compOf.get(m.away));
  });

  it("plays each club once per round, across all CUP_LEAGUE_PHASE_MATCHDAYS", () => {
    for (let r = 0; r < CUP_LEAGUE_PHASE_GAMES; r++) {
      const inRound = matches.filter((m) => m.round === r);
      const clubs = inRound.flatMap((m) => [m.home, m.away]);
      expect(new Set(clubs).size).toBe(clubs.length); // no club twice in a round
      inRound.forEach((m) => expect(m.matchday).toBe(CUP_LEAGUE_PHASE_MATCHDAYS[r]));
    }
  });

  it("is deterministic for a given seed and varies with the seed", () => {
    const again = drawLeaguePhase(teams, compOf, 42);
    expect(again).toEqual(matches);
    const other = drawLeaguePhase(teams, compOf, 43);
    expect(other).not.toEqual(matches);
  });
});

describe("leaguePhaseTable + splitLeaguePhase", () => {
  const { teams } = fakeField();
  const seeds: Record<number, number> = {};
  teams.forEach((t, i) => (seeds[t] = i + 1));

  it("ranks by points then GD/GF, tie-broken by seed", () => {
    // Two played matches: 0 beats 19 (3-0), 1 draws 18 (1-1).
    const matches: LeaguePhaseMatch[] = [
      { round: 0, matchday: 3, home: 0, away: 19, played: true, homeGoals: 3, awayGoals: 0, boxScore: null },
      { round: 0, matchday: 3, home: 1, away: 18, played: true, homeGoals: 1, awayGoals: 1, boxScore: null },
    ];
    const lp: CupLeaguePhase = { teams, matches };
    const table = leaguePhaseTable(lp, seeds);
    expect(table[0].tid).toBe(0); // 3 pts, +3 GD
    expect(table[0].points).toBe(3);
    expect(table[1].tid).toBe(1); // 1 pt
    // The rest are 0 pts, so they fall in seed order: tid 2 before tid 3, etc.
    const zeros = table.filter((r) => r.points === 0).map((r) => r.tid);
    expect(zeros[0]).toBe(2);
  });

  it("leaguePhaseComplete is true only once every match is played", () => {
    const matches: LeaguePhaseMatch[] = [
      { round: 0, matchday: 3, home: 0, away: 19, played: true, homeGoals: 3, awayGoals: 0, boxScore: null },
      { round: 1, matchday: 7, home: 0, away: 18, played: false, homeGoals: -1, awayGoals: -1, boxScore: null },
    ];
    expect(leaguePhaseComplete({ teams, matches })).toBe(false);
    matches[1].played = true;
    expect(leaguePhaseComplete({ teams, matches })).toBe(true);
  });

  it("splits top-4 / next-8 / rest", () => {
    const matches: LeaguePhaseMatch[] = [];
    const lp: CupLeaguePhase = { teams, matches };
    const table = leaguePhaseTable(lp, seeds); // all 0 pts → pure seed order
    const { directQF, playoff, out } = splitLeaguePhase(table);
    expect(directQF.length).toBe(CUP_LP_DIRECT_QF);
    expect(playoff.length).toBe(CUP_LP_PLAYOFF_TEAMS);
    expect(out.length).toBe(CUP_LEAGUE_PHASE_SIZE - CUP_LP_DIRECT_QF - CUP_LP_PLAYOFF_TEAMS);
    expect(directQF).toEqual([0, 1, 2, 3]);
    expect(playoff).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
  });
});
