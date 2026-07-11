import { describe, it, expect } from "vitest";
import { seasonRevenue, settleSeasonBudget, successPayout, wageBill } from "../../../src/core/finance/budget.js";
import {
  BASE_SEASON_BUDGET, NUM_TEAMS,
  PRIZE_CHAMPION, PRIZE_TOP_5, PRIZE_TOP_10,
  WAGE_WEEKLY_MIN, WAGE_WEEKLY_COEFF, WAGE_OVR_FLOOR, WAGE_VARIATION,
  WAGE_SAFE_SQUAD,
} from "../../../src/core/constants.js";
import { WEEKS_PER_SEASON } from "../../../src/core/contracts.js";

describe("seasonRevenue", () => {
  it("gives every club the same base allocation regardless of rank", () => {
    const first = seasonRevenue(1, 50);
    const last = seasonRevenue(20, 50);
    expect(first.base).toBe(BASE_SEASON_BUDGET);
    expect(last.base).toBe(BASE_SEASON_BUDGET);
  });

  it("pays higher-ranked clubs more in success payouts", () => {
    const first = seasonRevenue(1, 50);
    const last = seasonRevenue(20, 50);
    expect(first.successPayout).toBeGreaterThan(last.successPayout);
    expect(first.total).toBeGreaterThan(last.total);
  });

  it("gives hyped-up clubs more hype revenue, but damped well below success-payout spread", () => {
    const lowHype = seasonRevenue(10, 0);
    const highHype = seasonRevenue(10, 100);
    expect(highHype.hypeRevenue).toBeGreaterThan(lowHype.hypeRevenue);
    const hypeSpread = highHype.hypeRevenue - lowHype.hypeRevenue;
    const successSpread = seasonRevenue(1, 50).successPayout - seasonRevenue(20, 50).successPayout;
    expect(hypeSpread).toBeLessThan(successSpread);
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
    expect(successPayout(1)).toBe(PRIZE_CHAMPION);
    expect(successPayout(2)).not.toBe(PRIZE_CHAMPION);
  });

  it("pays a flat second tier for 2nd-5th and a flat third tier for 6th-10th", () => {
    for (let rank = 2; rank <= 5; rank++) expect(successPayout(rank)).toBe(PRIZE_TOP_5);
    for (let rank = 6; rank <= 10; rank++) expect(successPayout(rank)).toBe(PRIZE_TOP_10);
  });

  it("pays nothing beyond the base to the bottom half of the table", () => {
    for (let rank = 11; rank <= NUM_TEAMS; rank++) expect(successPayout(rank)).toBe(0);
  });

  it("keeps the tiers strictly ordered", () => {
    expect(PRIZE_CHAMPION).toBeGreaterThan(PRIZE_TOP_5);
    expect(PRIZE_TOP_5).toBeGreaterThan(PRIZE_TOP_10);
    expect(PRIZE_TOP_10).toBeGreaterThan(0);
  });
});

describe("settleSeasonBudget", () => {
  it("adds revenue and subtracts wages and scouting spend", () => {
    const revenue = seasonRevenue(5, 50).total;
    const result = settleSeasonBudget(1_000_000, 5, 50, 200_000, 100_000);
    expect(result).toBe(1_000_000 + revenue - 200_000 - 100_000);
  });

  it("never loses money on any AI-reachable squad (design: AI deficits do not exist)", () => {
    // Last place, zero hype, zero scouting (AI clubs never spend on
    // scouting), and the WAGE_SAFE_SQUAD benchmark roster — shaped like the
    // strongest AI club seen in 25-season dynasty audits — on worst-case
    // (+WAGE_VARIATION) wage deals. The base allocation alone must still
    // cover it, pinning the scale invariant so constant tweaks can't
    // reintroduce AI debt. Only a user hoarding a ROSTER_CAP squad of elite
    // players can outspend the base (documented, user-controlled gap; the
    // Finance page projects the shortfall).
    const worstWeekly = (ovr: number) =>
      WAGE_WEEKLY_MIN
      + WAGE_WEEKLY_COEFF * Math.max(0, ovr - WAGE_OVR_FLOOR) ** 3 * (1 + WAGE_VARIATION);
    const maxWages = WAGE_SAFE_SQUAD.reduce(
      (sum, [count, ovr]) => sum + count * worstWeekly(ovr) * WEEKS_PER_SEASON,
      0,
    );
    const settled = settleSeasonBudget(0, NUM_TEAMS, 0, maxWages, 0);
    expect(settled).toBeGreaterThan(0);
    expect(BASE_SEASON_BUDGET).toBeGreaterThan(maxWages);
  });
});
