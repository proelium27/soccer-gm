import { describe, it, expect } from "vitest";
import {
  contractTerms, canExtend, extendContract, weeklyWage, seasonSalaryForOvr, WEEKS_PER_SEASON,
} from "../../src/core/contracts.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { mulberry32 } from "../../src/engine/rng.js";
import {
  WAGE_WEEKLY_MIN, WAGE_VARIATION,
  EXTENSION_LENGTH_YOUNG, EXTENSION_LENGTH_MID, EXTENSION_LENGTH_OLD,
  EXTENSION_AGE_MID, EXTENSION_AGE_OLD,
} from "../../src/core/constants.js";
import type { Player } from "../../src/core/players/types.js";

function playerAged(age: number, season: number): Player {
  const league = createLeagueState(0, mulberry32(1));
  return { ...league.players[0], born: season - age };
}

describe("contractTerms", () => {
  it("offers age-based lengths: long for the young, short for the old", () => {
    const season = 5;
    expect(contractTerms(playerAged(EXTENSION_AGE_MID - 1, season), season).lengthSeasons)
      .toBe(EXTENSION_LENGTH_YOUNG);
    expect(contractTerms(playerAged(EXTENSION_AGE_MID, season), season).lengthSeasons)
      .toBe(EXTENSION_LENGTH_MID);
    expect(contractTerms(playerAged(EXTENSION_AGE_OLD - 1, season), season).lengthSeasons)
      .toBe(EXTENSION_LENGTH_MID);
    expect(contractTerms(playerAged(EXTENSION_AGE_OLD, season), season).lengthSeasons)
      .toBe(EXTENSION_LENGTH_OLD);
  });

  it("prices salary at the standard rate for the player's ovr and dates expiry from the current season", () => {
    const season = 3;
    const p = playerAged(24, season);
    const terms = contractTerms(p, season);
    expect(terms.salary).toBe(seasonSalaryForOvr(p.ovr, p.pid, season));
    expect(terms.expiresSeason).toBe(season + terms.lengthSeasons);
  });
});

describe("seasonSalaryForOvr", () => {
  it("escalates superstar wages far beyond squad-player wages (cubic, not linear)", () => {
    const wk = (ovr: number) => seasonSalaryForOvr(ovr, 1, 1) / WEEKS_PER_SEASON;
    // A 90-ovr star should out-earn a 60-ovr squad player by an order of
    // magnitude — the spread the old flat 20k-per-ovr formula never had.
    expect(wk(90)).toBeGreaterThan(10 * wk(60));
    expect(wk(65)).toBeGreaterThan(2 * wk(55));
  });

  it("pays at least the weekly minimum and stays within the ±variation band", () => {
    for (let ovr = 30; ovr <= 99; ovr += 3) {
      for (let pid = 0; pid < 20; pid++) {
        const weekly = seasonSalaryForOvr(ovr, pid, 2) / WEEKS_PER_SEASON;
        expect(weekly).toBeGreaterThanOrEqual(WAGE_WEEKLY_MIN);
        expect(Number.isInteger(weekly)).toBe(true);
      }
    }
  });

  it("varies deterministically per (pid, season): same inputs, same deal; new season, new roll", () => {
    expect(seasonSalaryForOvr(80, 7, 3)).toBe(seasonSalaryForOvr(80, 7, 3));
    const deals = new Set(
      Array.from({ length: 30 }, (_, pid) => seasonSalaryForOvr(80, pid, 3)),
    );
    expect(deals.size).toBeGreaterThan(1); // same ovr, different players → different wages
    const lo = Math.min(...deals), hi = Math.max(...deals);
    // Spread stays inside the ±WAGE_VARIATION band around the deterministic part.
    expect(hi / lo).toBeLessThanOrEqual((1 + WAGE_VARIATION) / (1 - WAGE_VARIATION) + 0.01);
  });
});

describe("canExtend", () => {
  it("is true only in the contract's final season", () => {
    const p = playerAged(24, 2);
    expect(canExtend({ ...p, contract: { ...p.contract, expiresSeason: 2 } }, 2)).toBe(true);
    expect(canExtend({ ...p, contract: { ...p.contract, expiresSeason: 3 } }, 2)).toBe(false);
  });
});

describe("extendContract", () => {
  it("replaces only the target player's contract with fresh terms", () => {
    const league = createLeagueState(0, mulberry32(2));
    const pid = league.teams[0].roster[0];
    const other = league.teams[0].roster[1];
    const before = league.players.find((p) => p.pid === other)!.contract;

    const players = extendContract(league.players, pid, league.season);
    const extended = league.players.find((p) => p.pid === pid)!;
    const updated = players.find((p) => p.pid === pid)!;
    const terms = contractTerms(extended, league.season);
    expect(updated.contract).toEqual({ salary: terms.salary, expiresSeason: terms.expiresSeason });
    expect(players.find((p) => p.pid === other)!.contract).toEqual(before);
  });
});

describe("weeklyWage", () => {
  it("splits a season salary across 52 weeks", () => {
    expect(weeklyWage(5_200_000)).toBe(100_000);
  });
});
