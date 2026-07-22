import { describe, it, expect } from "vitest";
import type { Composites } from "../../src/engine/composites.js";
import type { MatchPlayer } from "../../src/engine/attribution.js";
import type { TeamMatchData } from "../../src/core/league/composites.js";
import type { StandingsRow } from "../../src/core/standings.js";
import type { Competition } from "../../src/core/competitions.js";
import type { CupState } from "../../src/core/cup/types.js";
import { worldCompetitions, englandCompetitions } from "../../src/core/competitions.js";
import {
  seedOrder, qualifyCupTeams, buildCupState, matchupsForRound, cupPlan,
  completedRounds, dueCupRound, cupRoundName, cupFinalists, isCupComplete,
  playoffDue, koFinalRound, koLegMatchdays,
} from "../../src/core/cup/cup.js";
import { leaguePhaseComplete } from "../../src/core/cup/leaguePhase.js";
import { playKnockoutLeg, playPlayoff, playLeaguePhaseRound, resolveCupTie } from "../../src/core/cup/simCup.js";
import { mulberry32 } from "../../src/engine/rng.js";
import {
  CUP_LEAGUE_PHASE_MATCHDAYS, CUP_KO_ROUND_MATCHDAYS, CUP_PLAYOFF_MATCHDAY,
  CUP_LEAGUE_PHASE_SIZE, CUP_LEAGUE_PHASE_GAMES, CUP_KO_SIZE,
  CUP_LP_DIRECT_QF, CUP_LP_PLAYOFF_TEAMS,
  CUP_PRIZE_PARTICIPATION, CUP_PRIZE_WIN_PLAYOFF, CUP_PRIZE_WIN_QF, CUP_PRIZE_WIN_SF,
  CUP_PRIZE_WIN_FINAL, CUP_PRIZE_RUNNER_UP,
} from "../../src/core/constants.js";

/** The four big-four leagues only (16 qualifiers → still a valid Swiss field, no weak leagues). */
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
    ovr: 50 + strength * 40,
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

/** Match data for every club that appears anywhere in a cup (league-phase field covers them all). */
function matchDataFor(cup: CupState): Map<number, TeamMatchData> {
  const md = new Map<number, TeamMatchData>();
  for (const tid of cup.leaguePhase!.teams) {
    md.set(tid, fakeMatchData(tid, 0.35 + (cup.seeds[tid] <= 6 ? 0.25 : 0)));
  }
  return md;
}

describe("seedOrder", () => {
  it("produces the standard 8-team bracket order", () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
  it("keeps the top two seeds on opposite halves for any power-of-2 size", () => {
    for (const n of [2, 4, 8, 16]) {
      const order = seedOrder(n);
      expect(order).toHaveLength(n);
      expect(new Set(order).size).toBe(n);
      const half1 = order.slice(0, n / 2);
      expect(half1).toContain(1);
      expect(half1).not.toContain(2);
    }
  });
});

describe("cupPlan", () => {
  it("splits the real world into 4 strong + 2 weak tier-1 leagues, 20 qualifiers", () => {
    const plan = cupPlan(worldCompetitions())!;
    expect(plan.strong.map((c) => c.country)).toEqual(["England", "Spain", "Italy", "Germany"]);
    expect(plan.weak.map((c) => c.country)).toEqual(["France", "Portugal"]);
    expect(plan.total).toBe(CUP_LEAGUE_PHASE_SIZE); // 4*4 + 2*2 = 20
  });
  it("still fields a cup for a 4-strong-league world (16), but not for England-only", () => {
    expect(cupPlan(strongComps)!.total).toBe(16);
    expect(cupPlan(englandCompetitions())).toBeNull();
  });
});

describe("qualifyCupTeams", () => {
  it("takes the top 4 of each strong league and the top 2 of each weak league, seeded by table", () => {
    const comps = worldCompetitions();
    const { field, compOf } = qualifyCupTeams(comps, tablesFor(comps));
    expect(field).toHaveLength(CUP_LEAGUE_PHASE_SIZE);
    expect(new Set(field).size).toBe(CUP_LEAGUE_PHASE_SIZE);
    // The first six seeds are champions (rank 1, tid % 100 === 0), ordered by tid.
    for (let i = 0; i < 6; i++) expect(field[i] % 100).toBe(0);
    // Every qualifier has a competition mapping for the draw's same-league rule.
    for (const tid of field) expect(compOf.has(tid)).toBe(true);
    // No tier-2 club qualified.
    expect(field.every((t) => t < 9000)).toBe(true);
  });
});

describe("buildCupState (Swiss)", () => {
  it("draws a league phase and leaves the knockout bracket empty until it resolves", () => {
    const comps = worldCompetitions();
    const cup = buildCupState(comps, tablesFor(comps), 2)!;
    expect(cup.leaguePhase).not.toBeNull();
    expect(cup.leaguePhase!.teams).toHaveLength(CUP_LEAGUE_PHASE_SIZE);
    expect(cup.leaguePhase!.matches).toHaveLength((CUP_LEAGUE_PHASE_SIZE * CUP_LEAGUE_PHASE_GAMES) / 2);
    expect(cup.leaguePhase!.matches.every((m) => !m.played)).toBe(true);
    expect(cup.teams).toHaveLength(CUP_KO_SIZE);
    expect(cup.teams.every((t) => t === -1)).toBe(true); // bracket not seeded yet
    expect(cup.playoff).toBeNull();
    expect(cup.playIn).toBeNull();
    expect(cup.championTid).toBeNull();
    // No knockout round is due while the league phase is unplayed.
    expect(dueCupRound(cup, CUP_KO_ROUND_MATCHDAYS[0])).toBeNull();
  });

  it("returns null for an England-only (single tier-1 league) world", () => {
    const eng = englandCompetitions();
    const engTables = new Map<number, StandingsRow[]>();
    engTables.set(0, fakeTable([0, 1, 2, 3, 4, 5]));
    engTables.set(1, fakeTable([10, 11]));
    expect(buildCupState(eng, engTables, 2)).toBeNull();
  });
});

describe("cupRoundName (Swiss knockout)", () => {
  it("names the three knockout rounds and the earlier stages", () => {
    expect(cupRoundName(-2)).toBe("League Phase");
    expect(cupRoundName(-1)).toBe("Playoff Round");
    expect(cupRoundName(0)).toBe("Quarter-finals");
    expect(cupRoundName(1)).toBe("Semi-finals");
    expect(cupRoundName(2)).toBe("Final");
  });
});

describe("resolveCupTie", () => {
  it("always produces a winner (no draws in a knockout tie)", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 50; i++) {
      const tie = resolveCupTie(rng, 1, 2, fakeMatchData(1, 0.5), fakeMatchData(2, 0.5), 0, 8);
      expect([1, 2]).toContain(tie.winner);
      if (tie.homeGoals === tie.awayGoals) {
        expect(tie.wentToPens).toBe(true);
        expect(tie.homePens).not.toBe(tie.awayPens);
      }
    }
  });
});

describe("full Swiss cup: league phase → playoff → knockout", () => {
  it("plays out to a single champion and credits every prize tier correctly", () => {
    const comps = worldCompetitions();
    let cup = buildCupState(comps, tablesFor(comps), 2)!;
    const matchData = matchDataFor(cup);

    const totalPrizes = new Map<number, number>();
    const addAll = (prizes: Map<number, number>) => {
      for (const [tid, amt] of prizes) totalPrizes.set(tid, (totalPrizes.get(tid) ?? 0) + amt);
    };

    // Six league-phase matchdays.
    for (const md of CUP_LEAGUE_PHASE_MATCHDAYS) {
      const { cup: next, prizes } = playLeaguePhaseRound(cup, matchData, 0, md);
      cup = next;
      addAll(prizes);
    }
    expect(leaguePhaseComplete(cup.leaguePhase!)).toBe(true);
    // The knockout bracket is now seeded: four direct entrants + four -1 playoff slots.
    expect(cup.teams.filter((t) => t >= 0)).toHaveLength(CUP_LP_DIRECT_QF);
    expect(cup.teams.filter((t) => t === -1)).toHaveLength(CUP_KO_SIZE - CUP_LP_DIRECT_QF);
    expect(cup.playoff!.teams).toHaveLength(CUP_LP_PLAYOFF_TEAMS);
    expect(playoffDue(cup, CUP_PLAYOFF_MATCHDAY)).toBe(true);
    // Knockout still can't start — playoff pending.
    expect(dueCupRound(cup, CUP_KO_ROUND_MATCHDAYS[0])).toBeNull();

    // Playoff round fills the bracket.
    const po = playPlayoff(cup, matchData, 0);
    cup = po.cup;
    addAll(po.prizes);
    expect(cup.playoff!.ties).toHaveLength(CUP_LP_PLAYOFF_TEAMS / 2);
    expect(cup.teams.every((t) => t >= 0)).toBe(true);
    expect(dueCupRound(cup, CUP_KO_ROUND_MATCHDAYS[0])).toBe(0);

    // Three knockout rounds: QF → SF → Final. QF and SF are two-legged (leg 1
    // then leg 2 on separate matchdays); the final is a single leg.
    koLegMatchdays(cup).forEach((legMds, round) => {
      expect(completedRounds(cup)).toBe(round);
      for (const md of legMds) {
        const { cup: next, prizes } = playKnockoutLeg(cup, matchData, 0, md);
        cup = next;
        addAll(prizes);
      }
    });

    expect(isCupComplete(cup)).toBe(true);
    expect(koFinalRound(cup)).toBe(2);
    expect(cup.ties).toHaveLength(4 + 2 + 1); // QF + SF + Final
    expect(cup.koLegs).toBeNull(); // first-leg buffer cleared once the round finalized
    // QF (round 0) and SF (round 1) are two-legged; each tie carries its two 90'
    // legs and its aggregate is those legs summed plus any extra-time goals.
    for (const t of cup.ties.filter((tie) => tie.round <= 1)) {
      expect(t.legs).toHaveLength(2);
      const legSum = t.legs![0].homeGoals + t.legs![1].homeGoals;
      expect(t.homeGoals).toBeGreaterThanOrEqual(legSum); // extra time only adds
      if (!t.wentToExtraTime) {
        expect(t.homeGoals).toBe(legSum);
        expect(t.awayGoals).toBe(t.legs![0].awayGoals + t.legs![1].awayGoals);
      }
    }
    // The final (round 2) is a single leg — no per-leg breakdown.
    expect(cup.ties.find((t) => t.round === 2)!.legs).toBeUndefined();
    const champion = cup.championTid!;
    expect(cupFinalists(cup)).toContain(champion);

    // Prize pot: participation for all 20, four playoff wins, and the knockout tiers.
    const pot =
      CUP_LEAGUE_PHASE_SIZE * CUP_PRIZE_PARTICIPATION +
      (CUP_LP_PLAYOFF_TEAMS / 2) * CUP_PRIZE_WIN_PLAYOFF +
      4 * CUP_PRIZE_WIN_QF +
      2 * CUP_PRIZE_WIN_SF +
      1 * CUP_PRIZE_WIN_FINAL +
      1 * CUP_PRIZE_RUNNER_UP;
    const credited = [...totalPrizes.values()].reduce((s, v) => s + v, 0);
    expect(credited).toBe(pot);
    // Every qualifier earned at least the participation fee.
    for (const tid of cup.leaguePhase!.teams) {
      expect(totalPrizes.get(tid)! >= CUP_PRIZE_PARTICIPATION).toBe(true);
    }
  });
});

describe("bracket navigation", () => {
  it("pairs the quarter-finals as adjacent bracket slots once seeded", () => {
    const comps = worldCompetitions();
    let cup = buildCupState(comps, tablesFor(comps), 2)!;
    const matchData = matchDataFor(cup);
    for (const md of CUP_LEAGUE_PHASE_MATCHDAYS) cup = playLeaguePhaseRound(cup, matchData, 0, md).cup;
    cup = playPlayoff(cup, matchData, 0).cup;
    const pairs = matchupsForRound(cup, 0);
    expect(pairs).toHaveLength(CUP_KO_SIZE / 2);
    expect(pairs[0]).toEqual([cup.teams[0], cup.teams[1]]);
  });
});

describe("two-legged knockout across separate matchdays", () => {
  it("holds the first legs between matchdays, then finalizes on the second leg", () => {
    const comps = worldCompetitions();
    let cup = buildCupState(comps, tablesFor(comps), 2)!;
    const matchData = matchDataFor(cup);
    for (const md of CUP_LEAGUE_PHASE_MATCHDAYS) cup = playLeaguePhaseRound(cup, matchData, 0, md).cup;
    cup = playPlayoff(cup, matchData, 0).cup;

    const [qfLeg1Md, qfLeg2Md] = koLegMatchdays(cup)[0]; // quarter-final leg matchdays

    // First-leg matchday: all four QF first legs are held, none finalized yet.
    cup = playKnockoutLeg(cup, matchData, 0, qfLeg1Md).cup;
    expect(cup.koLegs).toHaveLength(CUP_KO_SIZE / 2);
    expect(cup.koLegs!.every((l) => l.round === 0)).toBe(true);
    expect(cup.ties).toHaveLength(0);
    expect(completedRounds(cup)).toBe(0); // round not complete until the second leg
    // With the first leg played, nothing is due again until the second-leg
    // matchday — the second leg comes due there, not before.
    expect(dueCupRound(cup, qfLeg1Md)).toBeNull();
    expect(dueCupRound(cup, qfLeg2Md)).toBe(0);

    // Second-leg matchday: the four aggregate ties finalize and the buffer clears.
    cup = playKnockoutLeg(cup, matchData, 0, qfLeg2Md).cup;
    expect(cup.koLegs).toBeNull();
    expect(cup.ties.filter((t) => t.round === 0)).toHaveLength(CUP_KO_SIZE / 2);
    expect(completedRounds(cup)).toBe(1);
  });
});
