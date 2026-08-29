import { describe, it, expect } from "vitest";
import type { Composites } from "../../src/engine/composites.js";
import type { MatchPlayer } from "../../src/engine/attribution.js";
import type { TeamMatchData } from "../../src/core/league/composites.js";
import type { StandingsRow } from "../../src/core/standings.js";
import type { Competition } from "../../src/core/competitions.js";
import type { CupState } from "../../src/core/cup/types.js";
import { worldCompetitions, englandCompetitions } from "../../src/core/competitions.js";
import {
  qualifyCupTeams, buildCupState, cupPlan, cupSlotRange, cupFormat,
  completedRounds, isCupComplete, koFinalRound, koLegMatchdays, koPrizeByRound,
  playoffDue,
} from "../../src/core/cup/cup.js";
import { leaguePhaseComplete } from "../../src/core/cup/leaguePhase.js";
import { playKnockoutLeg, playPlayoff, playLeaguePhaseRound } from "../../src/core/cup/simCup.js";
import {
  CUP_LEAGUE_PHASE_MATCHDAYS, CUP_PLAYOFF_MATCHDAY,
  CUP_LEAGUE_PHASE_GAMES, CUP_KO_SIZE, CUP_LP_DIRECT_QF, CUP_LP_PLAYOFF_TEAMS,
  CUP_STRONG_LEAGUE_SLOTS, CUP_WEAK_LEAGUE_SLOTS,
  SHIELD_FORMAT, CONTINENTAL_CUP_FORMAT, SHIELD_LEAGUE_PHASE_SIZE,
  SHIELD_PRIZE_PARTICIPATION, SHIELD_PRIZE_WIN_PLAYOFF, SHIELD_PRIZE_WIN_QF,
  SHIELD_PRIZE_WIN_SF, SHIELD_PRIZE_WIN_FINAL, SHIELD_PRIZE_RUNNER_UP,
} from "../../src/core/constants.js";

/** A synthetic tier-1 table where tid order == finishing order, deep enough for both competitions. */
function fakeTable(tids: number[]): StandingsRow[] {
  return tids.map((tid, i) => ({
    tid, played: 38, won: 0, drawn: 0, lost: 0, gf: 100 - i, ga: 0, gd: 100 - i, points: 100 - i,
  }));
}

/** Give each tier-1 league a distinct tid block (league index li → tids li*100 + rank). */
function tablesFor(comps: Competition[], clubsPerLeague = 8): Map<number, StandingsRow[]> {
  const tables = new Map<number, StandingsRow[]>();
  comps.filter((c) => c.tier === 1).forEach((c, li) => {
    tables.set(c.id, fakeTable(Array.from({ length: clubsPerLeague }, (_, r) => li * 100 + r)));
  });
  comps.filter((c) => c.tier === 2).forEach((c) => tables.set(c.id, fakeTable([9000 + c.id])));
  return tables;
}

function fakeMatchData(tid: number, strength: number): TeamMatchData {
  const composites: Composites = {
    name: `T${tid}`, attack: strength, finishing: strength, defense: strength, keeping: strength, control: strength,
  };
  const positions: MatchPlayer["pos"][] = ["GK", "CB", "CB", "FB", "FB", "DM", "CM", "CM", "W", "W", "ST"];
  const xi: MatchPlayer[] = positions.map((pos, i) => ({
    pid: tid * 100 + i,
    pos,
    slot: pos,
    secondary: [],
    ovr: 50 + strength * 40,
    shooting: 50 + strength * 40,
    dribbling: 50 + strength * 40,
    tackling: 50 + strength * 40,
    keeping: 50 + strength * 40,
    positioning: 50 + strength * 40,
    heading: 50 + strength * 40,
    stamina: 80,
    interceptions: 50 + strength * 40,
    passing: 50 + strength * 40,
  }));
  return { composites, xi, bench: [], recompute: () => composites };
}

function matchDataFor(cup: CupState): Map<number, TeamMatchData> {
  const md = new Map<number, TeamMatchData>();
  for (const tid of cup.leaguePhase!.teams) {
    md.set(tid, fakeMatchData(tid, 0.35 + (cup.seeds[tid] <= 6 ? 0.25 : 0)));
  }
  return md;
}

describe("Shield qualification", () => {
  it("fields 24 clubs: two from every tier-1 league, strong or weak", () => {
    const plan = cupPlan(worldCompetitions(), SHIELD_FORMAT)!;
    expect(plan.strong).toHaveLength(4);
    expect(plan.weak).toHaveLength(8);
    expect(plan.total).toBe(SHIELD_LEAGUE_PHASE_SIZE); // 12 leagues x 2 = 24
  });

  it("takes the places directly below the Continental Cup's in each league", () => {
    const comps = worldCompetitions();
    const tables = tablesFor(comps);
    const shield = qualifyCupTeams(comps, tables, SHIELD_FORMAT);
    expect(shield.field).toHaveLength(SHIELD_LEAGUE_PHASE_SIZE);

    // Ranks are encoded in the tid: tid % 100 is the club's 0-based finishing
    // position. A strong league sends 5th and 6th (4, 5), a weak league 3rd and
    // 4th (2, 3) — the Cup having taken the four and two places above.
    const plan = cupPlan(comps, SHIELD_FORMAT)!;
    const strongIds = new Set(plan.strong.map((c) => c.id));
    for (const tid of shield.field) {
      const isStrong = strongIds.has(shield.compOf.get(tid)!);
      expect(isStrong ? [4, 5] : [2, 3]).toContain(tid % 100);
    }
  });

  it("shares no club with the Continental Cup, which is what lets them share matchdays", () => {
    const comps = worldCompetitions();
    const tables = tablesFor(comps);
    const cup = qualifyCupTeams(comps, tables, CONTINENTAL_CUP_FORMAT).field;
    const shield = qualifyCupTeams(comps, tables, SHIELD_FORMAT).field;
    expect(cup).toHaveLength(32);
    expect(shield).toHaveLength(24);
    const overlap = shield.filter((t) => cup.includes(t));
    expect(overlap).toEqual([]);
  });

  it("reports the qualification range each league's table shades", () => {
    const comps = worldCompetitions();
    const strong = comps.find((c) => c.country === "England" && c.tier === 1)!;
    const weak = comps.find((c) => c.country === "Belgium" && c.tier === 1)!;
    expect(cupSlotRange(strong, CONTINENTAL_CUP_FORMAT)).toEqual([1, CUP_STRONG_LEAGUE_SLOTS]);
    expect(cupSlotRange(weak, CONTINENTAL_CUP_FORMAT)).toEqual([1, CUP_WEAK_LEAGUE_SLOTS]);
    expect(cupSlotRange(strong, SHIELD_FORMAT)).toEqual([5, 6]);
    expect(cupSlotRange(weak, SHIELD_FORMAT)).toEqual([3, 4]);
  });

  it("fields no Shield for a world with too few top-flight leagues", () => {
    expect(cupPlan(englandCompetitions(), SHIELD_FORMAT)).toBeNull();
    const eng = englandCompetitions();
    const engTables = new Map<number, StandingsRow[]>();
    engTables.set(0, fakeTable([0, 1, 2, 3, 4, 5]));
    expect(buildCupState(eng, engTables, 2, SHIELD_FORMAT)).toBeNull();
  });
});

describe("buildCupState (Shield)", () => {
  it("draws a 16-club league phase and names itself the Shield", () => {
    const comps = worldCompetitions();
    const shield = buildCupState(comps, tablesFor(comps), 2, SHIELD_FORMAT)!;
    expect(shield.competition).toBe("shield");
    expect(shield.name).toBe("Continental Shield");
    expect(shield.leaguePhase!.teams).toHaveLength(SHIELD_LEAGUE_PHASE_SIZE);
    expect(shield.leaguePhase!.matches).toHaveLength((SHIELD_LEAGUE_PHASE_SIZE * CUP_LEAGUE_PHASE_GAMES) / 2);
    expect(shield.teams).toHaveLength(CUP_KO_SIZE);
    expect(shield.twoLegged).toBe(true);
    expect(cupFormat(shield).id).toBe("shield");
  });

  it("draws a different league phase than the Cup does in the same season", () => {
    // Both competitions are drawn for the same season, so a shared draw seed
    // would have them mirror each other's pairings round for round.
    const comps = worldCompetitions();
    const tables = tablesFor(comps);
    const cup = buildCupState(comps, tables, 2, CONTINENTAL_CUP_FORMAT)!;
    const shield = buildCupState(comps, tables, 2, SHIELD_FORMAT)!;
    // Compare the shape of round 0 by seed index rather than by tid (the fields
    // are disjoint, so tids can never match).
    const pairSeeds = (c: CupState) =>
      c.leaguePhase!.matches
        .filter((m) => m.round === 0)
        .map((m) => `${c.seeds[m.home]}v${c.seeds[m.away]}`)
        .sort()
        .join(",");
    expect(pairSeeds(shield)).not.toBe(pairSeeds(cup));
  });
});

describe("full Shield: league phase → playoff → knockout", () => {
  it("plays out to a champion and credits the Shield's own, smaller prize tiers", () => {
    const comps = worldCompetitions();
    let shield = buildCupState(comps, tablesFor(comps), 2, SHIELD_FORMAT)!;
    const matchData = matchDataFor(shield);

    const totalPrizes = new Map<number, number>();
    const addAll = (prizes: Map<number, number>) => {
      for (const [tid, amt] of prizes) totalPrizes.set(tid, (totalPrizes.get(tid) ?? 0) + amt);
    };

    for (const md of CUP_LEAGUE_PHASE_MATCHDAYS) {
      const { cup: next, prizes } = playLeaguePhaseRound(shield, matchData, 0, md);
      shield = next;
      addAll(prizes);
    }
    expect(leaguePhaseComplete(shield.leaguePhase!)).toBe(true);
    expect(shield.teams.filter((t) => t >= 0)).toHaveLength(CUP_LP_DIRECT_QF);
    expect(shield.playoff!.teams).toHaveLength(CUP_LP_PLAYOFF_TEAMS);
    expect(playoffDue(shield, CUP_PLAYOFF_MATCHDAY)).toBe(true);

    const po = playPlayoff(shield, matchData, 0);
    shield = po.cup;
    addAll(po.prizes);
    expect(shield.teams.every((t) => t >= 0)).toBe(true);

    koLegMatchdays(shield).forEach((legMds, round) => {
      expect(completedRounds(shield)).toBe(round);
      for (const md of legMds) {
        const { cup: next, prizes } = playKnockoutLeg(shield, matchData, 0, md);
        shield = next;
        addAll(prizes);
      }
    });

    expect(isCupComplete(shield)).toBe(true);
    expect(koFinalRound(shield)).toBe(2);
    expect(shield.ties).toHaveLength(4 + 2 + 1);
    expect(shield.championTid).not.toBeNull();

    // The whole pot is the Shield's own tiers, not the Cup's.
    expect(koPrizeByRound(shield)).toEqual([
      SHIELD_PRIZE_WIN_QF, SHIELD_PRIZE_WIN_SF, SHIELD_PRIZE_WIN_FINAL,
    ]);
    const pot =
      SHIELD_LEAGUE_PHASE_SIZE * SHIELD_PRIZE_PARTICIPATION +
      (CUP_LP_PLAYOFF_TEAMS / 2) * SHIELD_PRIZE_WIN_PLAYOFF +
      4 * SHIELD_PRIZE_WIN_QF +
      2 * SHIELD_PRIZE_WIN_SF +
      1 * SHIELD_PRIZE_WIN_FINAL +
      1 * SHIELD_PRIZE_RUNNER_UP;
    const credited = [...totalPrizes.values()].reduce((s, v) => s + v, 0);
    expect(credited).toBe(pot);

    // A Shield champion must earn less than a Cup champion — the whole point of
    // the second competition being second.
    const championTotal = totalPrizes.get(shield.championTid!)!;
    expect(championTotal).toBeLessThan(30_000_000);
  });
});
