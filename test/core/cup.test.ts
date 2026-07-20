import { describe, it, expect } from "vitest";
import type { Composites } from "../../src/engine/composites.js";
import type { MatchPlayer } from "../../src/engine/attribution.js";
import type { TeamMatchData } from "../../src/core/league/composites.js";
import type { StandingsRow } from "../../src/core/standings.js";
import type { Competition } from "../../src/core/competitions.js";
import { worldCompetitions, englandCompetitions } from "../../src/core/competitions.js";
import {
  seedOrder, qualifyCupTeams, buildCupState, matchupsForRound, cupPlan, playInDue,
  completedRounds, dueCupRound, cupRoundName, cupFinalists, isCupComplete,
} from "../../src/core/cup/cup.js";
import { playCupRound, playPlayIn, resolveCupTie } from "../../src/core/cup/simCup.js";
import { mulberry32 } from "../../src/engine/rng.js";
import {
  CUP_ROUND_MATCHDAYS, CUP_PLAYIN_MATCHDAY, CUP_PRIZE_PARTICIPATION, CUP_PRIZE_WIN_PLAYIN,
  CUP_PRIZE_WIN_R16, CUP_PRIZE_WIN_QF, CUP_PRIZE_WIN_SF, CUP_PRIZE_WIN_FINAL, CUP_PRIZE_RUNNER_UP,
} from "../../src/core/constants.js";

/** The four big-four leagues only (no weak leagues → no play-in, a clean 16-team bracket). */
const strongComps: Competition[] = worldCompetitions().filter((c) =>
  ["England", "Spain", "Italy", "Germany"].includes(c.country));

/** A synthetic tier-1 table where tid order == finishing order, with points/gd spaced by rank. */
function fakeTable(tids: number[]): StandingsRow[] {
  return tids.map((tid, i) => ({
    tid, played: 38, won: 0, drawn: 0, lost: 0, gf: 100 - i, ga: 0, gd: 100 - i, points: 100 - i,
  }));
}

/** Give each tier-1 league in `comps` a distinct tid block (league index li → tids li*100 + rank). */
function tablesFor(comps: Competition[], clubsPerLeague = 4): Map<number, StandingsRow[]> {
  const tables = new Map<number, StandingsRow[]>();
  comps.filter((c) => c.tier === 1).forEach((c, li) => {
    tables.set(c.id, fakeTable(Array.from({ length: clubsPerLeague }, (_, r) => li * 100 + r)));
  });
  comps.filter((c) => c.tier === 2).forEach((c) => tables.set(c.id, fakeTable([9000 + c.id])));
  return tables;
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
      const half1 = order.slice(0, n / 2);
      expect(half1).toContain(1);
      expect(half1).not.toContain(2);
    }
  });
});

describe("cupPlan", () => {
  it("splits the real world into 4 strong + 2 weak tier-1 leagues, 18 qualifiers, a 2-tie play-in", () => {
    const plan = cupPlan(worldCompetitions())!;
    expect(plan.strong.map((c) => c.country)).toEqual(["England", "Spain", "Italy", "Germany"]);
    expect(plan.weak.map((c) => c.country)).toEqual(["France", "Portugal"]);
    expect(plan.total).toBe(18);
    expect(plan.playInTies).toBe(2);
  });
  it("has no play-in for a 4-strong-league world, and no cup at all for England-only", () => {
    expect(cupPlan(strongComps)!.playInTies).toBe(0);
    expect(cupPlan(englandCompetitions())).toBeNull();
  });
});

describe("qualifyCupTeams", () => {
  it("takes the top 4 of each strong league and each weak league's champion", () => {
    const comps = worldCompetitions();
    const { strongSeeded, weakChampions } = qualifyCupTeams(comps, tablesFor(comps));
    expect(strongSeeded).toHaveLength(16); // 4 strong leagues x 4
    expect(weakChampions).toHaveLength(2); // France + Portugal champions
    // Seed 1 is the champion of the strongest-pointed strong league (li=0 → tid 0).
    expect(strongSeeded[0]).toBe(0);
    // The first four strong seeds are all rank-1 champions (tid % 100 === 0).
    for (let i = 0; i < 4; i++) expect(strongSeeded[i] % 100).toBe(0);
    // No tier-2 club qualified.
    expect(strongSeeded.every((t) => t < 9000)).toBe(true);
  });
});

describe("buildCupState", () => {
  it("builds a straight 16-team bracket (no play-in) for a 4-strong-league world", () => {
    const cup = buildCupState(strongComps, tablesFor(strongComps), 2)!;
    expect(cup.playIn).toBeNull();
    expect(cup.teams).toHaveLength(16);
    expect(new Set(cup.teams).size).toBe(16);
    expect(cup.teams).not.toContain(-1);
    expect(cup.ties).toHaveLength(0);
    expect(cup.championTid).toBeNull();
  });

  it("builds 14 byes + a 2-tie play-in for the real (weak-league) world", () => {
    const comps = worldCompetitions();
    const cup = buildCupState(comps, tablesFor(comps), 2)!;
    expect(cup.playIn).not.toBeNull();
    expect(cup.teams).toHaveLength(16);
    // Two bracket slots are pending (-1) until the play-in resolves; 14 real byes.
    expect(cup.teams.filter((t) => t === -1)).toHaveLength(2);
    expect(cup.teams.filter((t) => t >= 0)).toHaveLength(14);
    // The play-in has 4 participants (2 weakest strong + 2 weak champions) and 2 slots.
    expect(cup.playIn!.teams).toHaveLength(4);
    expect(cup.playIn!.slots).toHaveLength(2);
    expect(cup.playIn!.matchday).toBe(CUP_PLAYIN_MATCHDAY);
    // The two weak-league champions are among the play-in teams.
    const weakChampions = cup.playIn!.teams.filter((t) => t >= 400); // France(li 4)=400, Portugal(li 5)=500
    expect(weakChampions).toHaveLength(2);
  });

  it("returns null for an England-only (single tier-1 league) world", () => {
    const eng = englandCompetitions();
    const engTables = new Map<number, StandingsRow[]>();
    engTables.set(0, fakeTable([0, 1, 2, 3, 4, 5]));
    engTables.set(1, fakeTable([10, 11]));
    expect(buildCupState(eng, engTables, 2)).toBeNull();
  });
});

describe("play-in round", () => {
  const comps = worldCompetitions();

  it("is due on its matchday, and R16 waits until it fills the bracket", () => {
    const cup = buildCupState(comps, tablesFor(comps), 2)!;
    expect(playInDue(cup, CUP_PLAYIN_MATCHDAY - 1)).toBe(false);
    expect(playInDue(cup, CUP_PLAYIN_MATCHDAY)).toBe(true);
    // While the play-in is pending, no knockout round is due even at R16's matchday.
    expect(dueCupRound(cup, CUP_ROUND_MATCHDAYS[0])).toBeNull();
  });

  it("resolves two ties, fills the bracket, credits participation to all 18 and a win bonus to the 2 winners", () => {
    const cup = buildCupState(comps, tablesFor(comps), 2)!;
    const matchData = new Map<number, TeamMatchData>();
    for (const tid of [...cup.teams.filter((t) => t >= 0), ...cup.playIn!.teams]) {
      matchData.set(tid, fakeMatchData(tid, 0.5));
    }
    const { cup: after, prizes } = playPlayIn(cup, matchData, 0);
    expect(after.playIn!.ties).toHaveLength(2);
    // Both pending slots are now filled with real tids (the two play-in winners).
    expect(after.teams.filter((t) => t === -1)).toHaveLength(0);
    expect(new Set(after.teams).size).toBe(16);
    // Now the round of 16 is due at its matchday.
    expect(dueCupRound(after, CUP_ROUND_MATCHDAYS[0])).toBe(0);
    // Every play-in participant got the participation fee; each winner also got the play-in win bonus.
    for (const tid of cup.playIn!.teams) {
      expect(prizes.get(tid)! >= CUP_PRIZE_PARTICIPATION).toBe(true);
    }
    const winners = after.playIn!.ties.map((t) => t.winner);
    for (const w of winners) {
      expect(prizes.get(w)).toBe(CUP_PRIZE_PARTICIPATION + CUP_PRIZE_WIN_PLAYIN);
    }
  });
});

describe("bracket navigation", () => {
  const cup = buildCupState(strongComps, tablesFor(strongComps), 2)!;

  it("pairs the round of 16 as adjacent bracket slots", () => {
    const pairs = matchupsForRound(cup, 0);
    expect(pairs).toHaveLength(8);
    expect(pairs[0]).toEqual([cup.teams[0], cup.teams[1]]);
    expect(pairs[7]).toEqual([cup.teams[14], cup.teams[15]]);
  });

  it("names rounds", () => {
    expect(cupRoundName(-1)).toBe("Play-in Round");
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
        expect(tie.wentToPens).toBe(true);
        expect(tie.homePens).not.toBe(tie.awayPens);
      }
    }
  });
});

describe("playCupRound (full 16-team bracket, no play-in)", () => {
  it("plays four rounds down to a single champion, crediting prize money correctly", () => {
    let cup = buildCupState(strongComps, tablesFor(strongComps), 2)!;
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

    for (const tid of cup.teams) {
      expect(totalPrizes.get(tid)! >= CUP_PRIZE_PARTICIPATION).toBe(true);
    }
    expect(totalPrizes.get(champion)).toBe(
      CUP_PRIZE_PARTICIPATION + CUP_PRIZE_WIN_R16 + CUP_PRIZE_WIN_QF + CUP_PRIZE_WIN_SF + CUP_PRIZE_WIN_FINAL,
    );
    expect(totalPrizes.get(runnerUp)).toBe(
      CUP_PRIZE_PARTICIPATION + CUP_PRIZE_WIN_R16 + CUP_PRIZE_WIN_QF + CUP_PRIZE_WIN_SF + CUP_PRIZE_RUNNER_UP,
    );
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
