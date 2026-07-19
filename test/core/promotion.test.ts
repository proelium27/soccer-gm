import { describe, it, expect } from "vitest";
import {
  computeCountrySwaps, applyCompetitionSwaps, stepAcademyBaseConvergence,
} from "../../src/core/promotion.js";
import { englandCompetitions } from "../../src/core/competitions.js";
import type { StandingsRow } from "../../src/core/standings.js";
import type { StoredTeam } from "../../src/core/teams/clubs.js";
import { ACADEMY_BASE_CENTER_BY_TIER, ACADEMY_BASE_CONVERGENCE_SEASONS } from "../../src/core/constants.js";

const COMPS = englandCompetitions();

function row(tid: number, points: number): StandingsRow {
  return { tid, played: 38, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points };
}

function team(tid: number, compId: number, academyBase: number): StoredTeam {
  return {
    tid, name: `T${tid}`, abbrev: "ABC", colors: ["#000", "#fff"],
    roster: [], academyRoster: [], budget: 0, hype: 0, scoutingSpend: 0, nextScoutingSpend: 0,
    academyBase, compId, divisionConvergence: null, formation: "4-3-3", starters: null, transferListed: [], scoutingObserved: {},
  };
}

describe("computeCountrySwaps", () => {
  it("promotes the top 3 of tier 2 and relegates the bottom 3 of tier 1", () => {
    // computeStandings sorts descending by points, so index 0 = 1st place.
    const d1 = [row(0, 90), row(1, 80), row(2, 70), row(3, 60), row(4, 50)];
    const d2 = [row(20, 95), row(21, 85), row(22, 75), row(23, 65), row(24, 55)];
    const tablesByCompId = new Map([[0, d1], [1, d2]]);
    const swaps = computeCountrySwaps(COMPS, tablesByCompId);
    expect(swaps).toHaveLength(1);
    expect(swaps[0].promoted).toEqual([20, 21, 22]);
    expect(swaps[0].relegated).toEqual([2, 3, 4]);
  });
});

describe("applyCompetitionSwaps", () => {
  it("moves swapped teams into their new competition and starts convergence for them only", () => {
    const teams = [team(0, 0, 50), team(20, 1, 30)];
    const swaps = [{ d1CompId: 0, d2CompId: 1, promoted: [20], relegated: [] }];
    const result = applyCompetitionSwaps(teams, swaps);
    const promoted = result.find((t) => t.tid === 20)!;
    const untouched = result.find((t) => t.tid === 0)!;
    expect(promoted.compId).toBe(0);
    expect(promoted.divisionConvergence).toEqual({ seasonsRemaining: ACADEMY_BASE_CONVERGENCE_SEASONS });
    expect(untouched.compId).toBe(0);
    expect(untouched.divisionConvergence).toBeNull();
  });
});

describe("stepAcademyBaseConvergence", () => {
  it("moves academyBase toward the current competition's tier center and counts down", () => {
    const d1Center = ACADEMY_BASE_CENTER_BY_TIER[1];
    const t = { ...team(20, 0, d1Center - 9), divisionConvergence: { seasonsRemaining: 3 } };
    const step1 = stepAcademyBaseConvergence([t], COMPS)[0];
    expect(step1.academyBase).toBeCloseTo(d1Center - 6, 5); // moved 1/3 of the remaining 9-point gap
    expect(step1.divisionConvergence).toEqual({ seasonsRemaining: 2 });
  });

  it("clears divisionConvergence once seasonsRemaining reaches 0", () => {
    const d1Center = ACADEMY_BASE_CENTER_BY_TIER[1];
    const t = { ...team(20, 0, d1Center - 3), divisionConvergence: { seasonsRemaining: 1 } };
    const result = stepAcademyBaseConvergence([t], COMPS)[0];
    expect(result.academyBase).toBeCloseTo(d1Center, 5);
    expect(result.divisionConvergence).toBeNull();
  });

  it("leaves teams with no active convergence untouched", () => {
    const t = team(0, 0, 41);
    const result = stepAcademyBaseConvergence([t], COMPS)[0];
    expect(result).toEqual(t);
  });
});
