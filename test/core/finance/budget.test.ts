import { describe, it, expect } from "vitest";
import { seasonRevenue, settleSeasonBudget, wageBill } from "../../../src/core/finance/budget.js";
import { BASE_SEASON_BUDGET } from "../../../src/core/constants.js";

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

describe("settleSeasonBudget", () => {
  it("adds revenue and subtracts wages and scouting spend", () => {
    const revenue = seasonRevenue(5, 50).total;
    const result = settleSeasonBudget(1_000_000, 5, 50, 200_000, 100_000);
    expect(result).toBe(1_000_000 + revenue - 200_000 - 100_000);
  });

  it("can go negative under heavy overspend", () => {
    const result = settleSeasonBudget(0, 20, 0, 999_999_999, 0);
    expect(result).toBeLessThan(0);
  });
});
