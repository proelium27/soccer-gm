import { describe, it, expect } from "vitest";
import type { Composites } from "../../src/engine/composites.js";
import type { MatchPlayer } from "../../src/engine/attribution.js";
import type { TeamMatchData } from "../../src/core/league/composites.js";
import type { StandingsRow } from "../../src/core/standings.js";
import { worldCompetitions, englandCompetitions } from "../../src/core/competitions.js";
import {
  seedOrder, qualifyCupTeams, buildCupState, matchupsForRound,
  completedRounds, dueCupRound, cupRoundName, cupFinalists, isCupComplete,
} from "../../src/core/cup/cup.js";
import { playCupRound, resolveCupTie } from "../../src/core/cup/simCup.js";
import { mulberry32 } from "../../src/engine/rng.js";
import {
  CUP_ROUND_MATCHDAYS, CUP_PRIZE_PARTICIPATION, CUP_PRIZE_WIN_R16, CUP_PRIZE_WIN_QF,
  CUP_PRIZE_WIN_SF, CUP_PRIZE_WIN_FINAL, CUP_PRIZE_RUNNER_UP, CUP_TEAMS_PER_LEAGUE,
} from "../../src/core/constants.js";

/** A synthetic tier-1 table where tid order == finishing order, with points/gd spaced by rank. */
function fakeTable(tids: number[]): StandingsRow[] {
  return tids.map((tid, i) => ({
    tid, played: 38, won: 0, drawn: 0, lost: 0, gf: 100 - i, ga: 0, gd: 100 - i, points: 100 - i,
  }));
}

/** Minimal but valid TeamMatchData: 11 players (1 GK + 10 outfield), composites scaled by `strength` (0..1). */
function fakeMatchData(tid: number, strength: number): TeamMatchData {
  const composites: Composites = {
    name: `T${tid}`, attack: strength, finishing: strength, defense: strength, keeping: strength, control: strength,
  };
  const positions: MatchPlayer["pos"][] = ["GK", "CB", "CB", "FB", "FB", "DM", "CM", "CM", "W", "W", "ST"];
  const xi: MatchPlayer[] = positions.map((pos, i) => ({
    pid: tid * 100 + i,
    pos,
    shooting: 50 + strength * 40,
    dribbling: 50 + strength * 40,
    tackling: 50 + strength * 40,
    keeping: 50 + strength * 40,
    positioning: 50 + strength * 40,
    heading: 50 + strength * 40,
    stamina: 80,
    interceptions: 50 + strength * 40,
  }));
  return { composites, xi, bench: [], recompute: () => composites };
}

describe("seedOrder", () => {
  it("produces the standard 16-team bracket order", () => {
    expect(seedOrder(16)).toEqual([1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]);
  });
  it("keeps the top two seeds on opposite halves for any power-of-2 size", () => {
    for (const n of [2, 4, 8, 16]) {
      const order = seedOrder(n);
      expect(order).toHaveLength(n);
      expect(new Set(order).size).toBe(n); // a permutation of 1..n
      // seed 1 and seed 2 must be in different halves of the bracket
      const half1 = order.slice(0, n / 2);
      expect(half1).toContain(1);
      expect(half1).not.toContain(2);
    }
  });
});

describe("qualifyCupTeams", () => {
  it("takes the top N of each tier-1 table and seeds champions above runners-up", () => {
    const comps = worldCompetitions();
    const tier1 = comps.filter((c) => c.tier === 1);
    const tables = new Map<number, StandingsRow[]>();
    // Give each tier-1 league a distinct tid block; league A's clubs have the most points.
    tier1.forEach((c, li) => {
      tables.set(c.id, fakeTable([0, 1, 2, 3, 4].map((r) => li * 100 + r)));
    });
    // Tier-2 tables present but ignored.
    comps.filter((c) => c.tier === 2).forEach((c) => tables.set(c.id, fakeTable([9000 + c.id])));

    const { seededTids, seedByTid } = qualifyCupTeams(comps, tables);
    expect(seededTids).toHaveLength(tier1.length * CUP_TEAMS_PER_LEAGUE);

    // Seed 1 is the champion (rank 1) of the strongest-pointed league (li=0 → tid 0).
    expect(seededTids[0]).toBe(0);
    // The first `tier1.length` seeds are all rank-1 champions (tid % 100 === 0).
    for (let i = 0; i < tier1.length; i++) expect(seededTids[i] % 100).toBe(0);
    // The next block are all runners-up (tid % 100 === 1).
    for (let i = tier1.length; i < tier1.length * 2; i++) expect(seededTids[i] % 100).toBe(1);
    // No tier-2 club qualified.
    expect(seededTids.every((t) => t < 9000)).toBe(true);
    expect(seedByTid[0]).toBe(1);
  });
});

describe("buildCupState", () => {
  const comps = worldCompetitions();
  const tier1 = comps.filter((c) => c.tier === 1);
  const tables = new Map<number, StandingsRow[]>();
  tier1.forEach((c, li) => tables.set(c.id, fakeTable([0, 1, 2, 3].map((r) => li * 100 + r))));

  it("builds a 16-team bracket for a 4-league world", () => {
    const cup = buildCupState(comps, tables, 2)!;
    expect(cup).not.toBeNull();
    expect(cup.teams).toHaveLength(16);
    expect(new Set(cup.teams).size).toBe(16);
    expect(cup.season).toBe(2);
    expect(cup.ties).toHaveLength(0);
    expect(cup.championTid).toBeNull();
  });

  it("returns null for an England-only (single tier-1 league) world", () => {
    const eng = englandCompetitions();
    const engTables = new Map<number, StandingsRow[]>();
    engTables.set(0, fakeTable([0, 1, 2, 3, 4, 5]));
    engTables.set(1, fakeTable([10, 11]));
    expect(buildCupState(eng, engTables, 2)).toBeNull();
  });
});

describe("bracket navigation", () => {
  const comps = worldCompetitions();
  const tier1 = comps.filter((c) => c.tier === 1);
  const tables = new Map<number, StandingsRow[]>();
  tier1.forEach((c, li) => tables.set(c.id, fakeTable([0, 1, 2, 3].map((r) => li * 100 + r))));
  const cup = buildCupState(comps, tables, 2)!;

  it("pairs the round of 16 as adjacent bracket slots", () => {
    const pairs = matchupsForRound(cup, 0);
    expect(pairs).toHaveLength(8);
    expect(pairs[0]).toEqual([cup.teams[0], cup.teams[1]]);
    expect(pairs[7]).toEqual([cup.teams[14], cup.teams[15]]);
  });

  it("names rounds", () => {
    expect(cupRoundName(0)).toBe("Round of 16");
    expect(cupRoundName(1)).toBe("Quarter-finals");
    expect(cupRoundName(2)).toBe("Semi-finals");
    expect(cupRoundName(3)).toBe("Final");
  });

  it("reports the due round only once its matchday arrives", () => {
    expect(dueCupRound(cup, CUP_ROUND_MATCHDAYS[0] - 1)).toBeNull();
    expect(dueCupRound(cup, CUP_ROUND_MATCHDAYS[0])).toBe(0);
  });
});

describe("resolveCupTie", () => {
  it("always produces a winner (no draws in a knockout tie)", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 50; i++) {
      const a = fakeMatchData(1, 0.5);
      const b = fakeMatchData(2, 0.5);
      const tie = resolveCupTie(rng, 1, 2, a, b, 0, 8);
      expect([1, 2]).toContain(tie.winner);
      if (tie.homeGoals === tie.awayGoals) {
        // A level tie must have gone to a shootout with a decisive pen score.
        expect(tie.wentToPens).toBe(true);
        expect(tie.homePens).not.toBe(tie.awayPens);
      }
    }
  });
});

describe("playCupRound (full bracket)", () => {
  const comps = worldCompetitions();
  const tier1 = comps.filter((c) => c.tier === 1);
  const tables = new Map<number, StandingsRow[]>();
  tier1.forEach((c, li) => tables.set(c.id, fakeTable([0, 1, 2, 3].map((r) => li * 100 + r))));

  it("plays four rounds down to a single champion, crediting prize money correctly", () => {
    let cup = buildCupState(comps, tables, 2)!;
    // Strength decreasing with seed so results are deterministic-ish but every team is playable.
    const matchData = new Map<number, TeamMatchData>();
    cup.teams.forEach((tid) => matchData.set(tid, fakeMatchData(tid, 0.4 + (cup.seeds[tid] <= 4 ? 0.2 : 0))));

    const totalPrizes = new Map<number, number>();
    const addAll = (prizes: Map<number, number>) => {
      for (const [tid, amt] of prizes) totalPrizes.set(tid, (totalPrizes.get(tid) ?? 0) + amt);
    };

    for (let r = 0; r < 4; r++) {
      expect(completedRounds(cup)).toBe(r);
      const { cup: next, prizes } = playCupRound(cup, matchData, 0);
      cup = next;
      addAll(prizes);
    }

    expect(isCupComplete(cup)).toBe(true);
    expect(cup.championTid).not.toBeNull();
    expect(cup.ties).toHaveLength(15); // 8 + 4 + 2 + 1
    expect(completedRounds(cup)).toBe(4);

    const champion = cup.championTid!;
    const finalists = cupFinalists(cup);
    expect(finalists).toContain(champion);
    const runnerUp = finalists.find((t) => t !== champion)!;

    // Every one of the 16 got the participation fee.
    for (const tid of cup.teams) {
      expect(totalPrizes.get(tid)! >= CUP_PRIZE_PARTICIPATION).toBe(true);
    }
    // Champion: participation + all four round wins.
    expect(totalPrizes.get(champion)).toBe(
      CUP_PRIZE_PARTICIPATION + CUP_PRIZE_WIN_R16 + CUP_PRIZE_WIN_QF + CUP_PRIZE_WIN_SF + CUP_PRIZE_WIN_FINAL,
    );
    // Runner-up: participation + three wins + the runner-up bonus.
    expect(totalPrizes.get(runnerUp)).toBe(
      CUP_PRIZE_PARTICIPATION + CUP_PRIZE_WIN_R16 + CUP_PRIZE_WIN_QF + CUP_PRIZE_WIN_SF + CUP_PRIZE_RUNNER_UP,
    );
    // Total pot is conserved: sum of every club's credited prizes.
    const pot =
      16 * CUP_PRIZE_PARTICIPATION +
      8 * CUP_PRIZE_WIN_R16 +
      4 * CUP_PRIZE_WIN_QF +
      2 * CUP_PRIZE_WIN_SF +
      1 * CUP_PRIZE_WIN_FINAL +
      1 * CUP_PRIZE_RUNNER_UP;
    const credited = [...totalPrizes.values()].reduce((s, v) => s + v, 0);
    expect(credited).toBe(pot);
  });
});
