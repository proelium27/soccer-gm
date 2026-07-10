import { describe, it, expect } from "vitest";
import { seasonRevenue, settleSeasonBudget, successPayout, wageBill } from "../../../src/core/finance/budget.js";
import {
  BASE_SEASON_BUDGET, NUM_TEAMS, ROSTER_COMPOSITION,
  PRIZE_CHAMPION, PRIZE_TOP_5, PRIZE_TOP_10,
  SALARY_PER_OVR, RATING_MAX, SCOUTING_SPEND_MAX,
} from "../../../src/core/constants.js";

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

  it("never loses money, even in the worst case (design: deficits do not exist)", () => {
    // Last place, zero hype, a full roster of ceiling-ovr salaries, max
    // scouting spend: the base allocation alone must still cover it. This
    // pins the scale invariant so constant tweaks can't reintroduce debt.
    const rosterSize = Object.values(ROSTER_COMPOSITION).reduce((s, n) => s + n, 0);
    const maxWages = rosterSize * SALARY_PER_OVR * RATING_MAX;
    const settled = settleSeasonBudget(0, NUM_TEAMS, 0, maxWages, SCOUTING_SPEND_MAX);
    expect(settled).toBeGreaterThan(0);
    expect(BASE_SEASON_BUDGET).toBeGreaterThan(maxWages + SCOUTING_SPEND_MAX);
  });
});
