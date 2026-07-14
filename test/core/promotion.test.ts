import { describe, it, expect } from "vitest";
import {
  computeDivisionSwap, applyDivisionSwap, stepAcademyBaseConvergence,
} from "../../src/core/promotion.js";
import type { StandingsRow } from "../../src/core/standings.js";
import type { StoredTeam } from "../../src/core/teams/clubs.js";
import { DIVISION_ACADEMY_BASE_CENTER, ACADEMY_BASE_CONVERGENCE_SEASONS } from "../../src/core/constants.js";

function row(tid: number, points: number): StandingsRow {
  return { tid, played: 38, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points };
}

function team(tid: number, division: 0 | 1, academyBase: number): StoredTeam {
  return {
    tid, name: `T${tid}`, abbrev: "ABC", colors: ["#000", "#fff"],
    roster: [], academyRoster: [], budget: 0, hype: 0, scoutingSpend: 0,
    academyBase, division, divisionConvergence: null, starters: null,
  };
}

describe("computeDivisionSwap", () => {
  it("promotes the top 3 of D2 and relegates the bottom 3 of D1", () => {
    // computeStandings sorts descending by points, so index 0 = 1st place.
    const d1 = [row(0, 90), row(1, 80), row(2, 70), row(3, 60), row(4, 50)];
    const d2 = [row(20, 95), row(21, 85), row(22, 75), row(23, 65), row(24, 55)];
    const swap = computeDivisionSwap(d1, d2);
    expect(swap.promoted).toEqual([20, 21, 22]);
    expect(swap.relegated).toEqual([2, 3, 4]);
  });
});

describe("applyDivisionSwap", () => {
  it("flips division and starts convergence for swapped teams only", () => {
    const teams = [team(0, 0, 50), team(20, 1, 30)];
    const swap = { promoted: [20], relegated: [] };
    const result = applyDivisionSwap(teams, swap);
    const promoted = result.find((t) => t.tid === 20)!;
    const untouched = result.find((t) => t.tid === 0)!;
    expect(promoted.division).toBe(0);
    expect(promoted.divisionConvergence).toEqual({ seasonsRemaining: ACADEMY_BASE_CONVERGENCE_SEASONS });
    expect(untouched.division).toBe(0);
    expect(untouched.divisionConvergence).toBeNull();
  });
});

describe("stepAcademyBaseConvergence", () => {
  it("moves academyBase toward the current division's center and counts down", () => {
    const [d1Center] = DIVISION_ACADEMY_BASE_CENTER;
    const t = { ...team(20, 0, d1Center - 9), divisionConvergence: { seasonsRemaining: 3 } };
    const step1 = stepAcademyBaseConvergence([t])[0];
    expect(step1.academyBase).toBeCloseTo(d1Center - 6, 5); // moved 1/3 of the remaining 9-point gap
    expect(step1.divisionConvergence).toEqual({ seasonsRemaining: 2 });
  });

  it("clears divisionConvergence once seasonsRemaining reaches 0", () => {
    const [d1Center] = DIVISION_ACADEMY_BASE_CENTER;
    const t = { ...team(20, 0, d1Center - 3), divisionConvergence: { seasonsRemaining: 1 } };
    const result = stepAcademyBaseConvergence([t])[0];
    expect(result.academyBase).toBeCloseTo(d1Center, 5);
    expect(result.divisionConvergence).toBeNull();
  });

  it("leaves teams with no active convergence untouched", () => {
    const t = team(0, 0, 41);
    const result = stepAcademyBaseConvergence([t])[0];
    expect(result).toEqual(t);
  });
});
