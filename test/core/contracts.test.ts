import { describe, it, expect } from "vitest";
import { contractTerms, canExtend, extendContract, weeklyWage } from "../../src/core/contracts.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { mulberry32 } from "../../src/engine/rng.js";
import {
  SALARY_PER_OVR,
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

  it("prices salary at the standard per-ovr rate and dates expiry from the current season", () => {
    const season = 3;
    const p = playerAged(24, season);
    const terms = contractTerms(p, season);
    expect(terms.salary).toBe(SALARY_PER_OVR * p.ovr);
    expect(terms.expiresSeason).toBe(season + terms.lengthSeasons);
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
