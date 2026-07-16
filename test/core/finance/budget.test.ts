import { describe, it, expect } from "vitest";
import {
  seasonRevenue, settleSeasonEnd, chargeSeasonStart, successPayout, wageBill,
} from "../../../src/core/finance/budget.js";
import {
  BASE_SEASON_BUDGET, NUM_TEAMS, MAX_BUDGET,
  PRIZE_CHAMPION, PRIZE_TOP_5, PRIZE_TOP_10,
  WAGE_WEEKLY_MIN, WAGE_WEEKLY_COEFF, WAGE_OVR_FLOOR, WAGE_VARIATION,
  WAGE_SAFE_SQUAD, DIVISION_2_BUDGET_SCALE,
} from "../../../src/core/constants.js";
import { WEEKS_PER_SEASON } from "../../../src/core/contracts.js";

describe("seasonRevenue", () => {
  it("gives every club the same base allocation regardless of rank", () => {
    const first = seasonRevenue(1, 50, 1);
    const last = seasonRevenue(20, 50, 1);
    expect(first.base).toBe(BASE_SEASON_BUDGET);
    expect(last.base).toBe(BASE_SEASON_BUDGET);
  });

  it("pays higher-ranked clubs more in success payouts", () => {
    const first = seasonRevenue(1, 50, 1);
    const last = seasonRevenue(20, 50, 1);
    expect(first.successPayout).toBeGreaterThan(last.successPayout);
    expect(first.total).toBeGreaterThan(last.total);
  });

  it("gives hyped-up clubs more hype revenue, but damped well below success-payout spread", () => {
    const lowHype = seasonRevenue(10, 0, 1);
    const highHype = seasonRevenue(10, 100, 1);
    expect(highHype.hypeRevenue).toBeGreaterThan(lowHype.hypeRevenue);
    const hypeSpread = highHype.hypeRevenue - lowHype.hypeRevenue;
    const successSpread = seasonRevenue(1, 50, 1).successPayout - seasonRevenue(20, 50, 1).successPayout;
    expect(hypeSpread).toBeLessThan(successSpread);
  });
});

describe("division-scaled finances", () => {
  it("scales base and prize money down for Division 2", () => {
    const d1 = seasonRevenue(1, 0, 1);
    const d2 = seasonRevenue(1, 0, 2);
    expect(d2.base).toBeCloseTo(BASE_SEASON_BUDGET * DIVISION_2_BUDGET_SCALE, 5);
    expect(d2.successPayout).toBeCloseTo(PRIZE_CHAMPION * DIVISION_2_BUDGET_SCALE, 5);
    expect(d1.base).toBe(BASE_SEASON_BUDGET);
    expect(d1.successPayout).toBe(PRIZE_CHAMPION);
  });

  it("chargeSeasonStart scales the base allocation by division", () => {
    const d1Budget = chargeSeasonStart(0, 0, 1);
    const d2Budget = chargeSeasonStart(0, 0, 2);
    expect(d2Budget).toBeCloseTo(BASE_SEASON_BUDGET * DIVISION_2_BUDGET_SCALE, 5);
    expect(d1Budget).toBe(BASE_SEASON_BUDGET);
  });

  it("caps Division 2 budgets at MAX_BUDGET * DIVISION_2_BUDGET_SCALE, not the shared MAX_BUDGET", () => {
    const hugeD1 = chargeSeasonStart(MAX_BUDGET, 0, 1);
    const hugeD2 = chargeSeasonStart(MAX_BUDGET, 0, 2);
    expect(hugeD1).toBe(MAX_BUDGET);
    expect(hugeD2).toBe(MAX_BUDGET * DIVISION_2_BUDGET_SCALE);
  });

  it("settleSeasonEnd also caps Division 2 at the scaled ceiling", () => {
    const result = settleSeasonEnd(MAX_BUDGET, 1, 100, 0, 2);
    expect(result).toBe(MAX_BUDGET * DIVISION_2_BUDGET_SCALE);
  });
});

describe("wageBill", () => {
  it("sums salaries for the given roster only", () => {
    const salaries = new Map([[1, 1000], [2, 2000], [3, 3000]]);
    expect(wageBill([1, 2], salaries)).toBe(3000);
  });

  it("ignores pids with no salary entry", () => {
    const salaries = new Map([[1, 1000]]);
    expect(wageBill([1, 99], salaries)).toBe(1000);
  });
});

describe("successPayout", () => {
  it("pays the champion prize only to 1st place", () => {
    expect(successPayout(1, 1)).toBe(PRIZE_CHAMPION);
    expect(successPayout(2, 1)).not.toBe(PRIZE_CHAMPION);
  });

  it("pays a flat second tier for 2nd-5th and a flat third tier for 6th-10th", () => {
    for (let rank = 2; rank <= 5; rank++) expect(successPayout(rank, 1)).toBe(PRIZE_TOP_5);
    for (let rank = 6; rank <= 10; rank++) expect(successPayout(rank, 1)).toBe(PRIZE_TOP_10);
  });

  it("pays nothing beyond the base to the bottom half of the table", () => {
    for (let rank = 11; rank <= NUM_TEAMS; rank++) expect(successPayout(rank, 1)).toBe(0);
  });

  it("keeps the tiers strictly ordered", () => {
    expect(PRIZE_CHAMPION).toBeGreaterThan(PRIZE_TOP_5);
    expect(PRIZE_TOP_5).toBeGreaterThan(PRIZE_TOP_10);
    expect(PRIZE_TOP_10).toBeGreaterThan(0);
  });
});

describe("settleSeasonEnd", () => {
  it("adds performance money (prize + hype revenue) and subtracts scouting spend, never wages", () => {
    const { successPayout: payout, hypeRevenue } = seasonRevenue(5, 50, 1);
    const result = settleSeasonEnd(1_000_000, 5, 50, 100_000, 1);
    expect(result).toBe(1_000_000 + payout + hypeRevenue - 100_000);
  });

  it("never shrinks a budget for a club that spent nothing on scouting", () => {
    for (let rank = 1; rank <= NUM_TEAMS; rank++) {
      expect(settleSeasonEnd(1_000_000, rank, 0, 0, 1)).toBeGreaterThanOrEqual(1_000_000);
    }
  });
});

describe("chargeSeasonStart", () => {
  it("pays the base allocation in and the season's wages out", () => {
    expect(chargeSeasonStart(1_000_000, 200_000, 1))
      .toBe(1_000_000 + BASE_SEASON_BUDGET - 200_000);
  });

  it("never sinks an AI-reachable squad (design: AI deficits do not exist)", () => {
    // Zero carryover and the WAGE_SAFE_SQUAD benchmark roster — shaped like
    // the strongest AI club seen in 25-season dynasty audits — on worst-case
    // (+WAGE_VARIATION) wage deals. The base allocation alone must cover the
    // season-start wage charge, pinning the scale invariant so constant
    // tweaks can't reintroduce AI debt. Only a user hoarding a ROSTER_CAP
    // squad of elite players can outspend the base (documented,
    // user-controlled gap; the Finance page projects the shortfall).
    const worstWeekly = (ovr: number) =>
      WAGE_WEEKLY_MIN
      + WAGE_WEEKLY_COEFF * Math.max(0, ovr - WAGE_OVR_FLOOR) ** 3 * (1 + WAGE_VARIATION);
    const maxWages = WAGE_SAFE_SQUAD.reduce(
      (sum, [count, ovr]) => sum + count * worstWeekly(ovr) * WEEKS_PER_SEASON,
      0,
    );
    expect(chargeSeasonStart(0, maxWages, 1)).toBeGreaterThan(0);
    expect(BASE_SEASON_BUDGET).toBeGreaterThan(maxWages);
  });
});
