import { describe, it, expect } from "vitest";
import {
  statureSensitivity, refusesMove, moveAppeal, settledMultiplier, joinedSeasons,
} from "../../../src/core/transfers/playerWill.js";
import {
  PLAYER_WILL_CARE_FLOOR, PLAYER_WILL_CARE_CEILING, PLAYER_SETTLED_SEASONS,
} from "../../../src/core/constants.js";

describe("statureSensitivity", () => {
  it("is zero for a squad player and full for a star", () => {
    expect(statureSensitivity(PLAYER_WILL_CARE_FLOOR - 5)).toBe(0);
    expect(statureSensitivity(PLAYER_WILL_CARE_CEILING + 5)).toBe(1);
  });

  it("ramps monotonically in between", () => {
    const mid = (PLAYER_WILL_CARE_FLOOR + PLAYER_WILL_CARE_CEILING) / 2;
    const low = statureSensitivity(PLAYER_WILL_CARE_FLOOR + 1);
    const high = statureSensitivity(PLAYER_WILL_CARE_CEILING - 1);
    expect(low).toBeLessThan(statureSensitivity(mid));
    expect(statureSensitivity(mid)).toBeLessThan(high);
  });
});

describe("moveAppeal", () => {
  it("leaves a squad player indifferent to club size", () => {
    // The whole point of the care ramp: a fringe player takes the game time.
    const fringe = PLAYER_WILL_CARE_FLOOR - 1;
    expect(moveAppeal(fringe, 0.9, 0.1)).toBe(1);
    expect(refusesMove(fringe, 0.9, 0.1)).toBe(false);
  });

  it("refuses a star a big step down, whatever the money", () => {
    // This is the Mbappe-to-Sociedad case the module exists to stop.
    expect(refusesMove(85, 0.9, 0.2)).toBe(true);
    expect(moveAppeal(85, 0.9, 0.2)).toBe(0);
  });

  it("still allows a star a sideways or upward move", () => {
    expect(refusesMove(85, 0.7, 0.7)).toBe(false);
    expect(moveAppeal(85, 0.7, 0.7)).toBeGreaterThanOrEqual(1);
    // A genuine step up is actively attractive.
    expect(moveAppeal(85, 0.5, 0.9)).toBeGreaterThan(1);
  });

  it("penalises a small step down without forbidding it", () => {
    const appeal = moveAppeal(80, 0.62, 0.55);
    expect(appeal).toBeGreaterThan(0);
    expect(appeal).toBeLessThan(1);
  });

  it("is harsher on a better player for the same step down", () => {
    const good = moveAppeal(70, 0.6, 0.5);
    const great = moveAppeal(80, 0.6, 0.5);
    expect(great).toBeLessThan(good);
  });
});

describe("settledMultiplier", () => {
  it("treats a player who never moved as fully settled", () => {
    expect(settledMultiplier(undefined, 10)).toBe(1);
  });

  it("charges the most for a player who just arrived, decaying to nothing", () => {
    const justArrived = settledMultiplier(10, 10);
    const oneOn = settledMultiplier(10, 11);
    expect(justArrived).toBeGreaterThan(1);
    expect(oneOn).toBeLessThan(justArrived);
    expect(oneOn).toBeGreaterThan(1);
    expect(settledMultiplier(10, 10 + PLAYER_SETTLED_SEASONS)).toBe(1);
  });
});

describe("joinedSeasons", () => {
  it("takes each player's most recent permanent move", () => {
    const joined = joinedSeasons([
      { pid: 1, season: 4 },
      { pid: 1, season: 7 },
      { pid: 2, season: 5 },
    ]);
    expect(joined.get(1)).toBe(7);
    expect(joined.get(2)).toBe(5);
  });

  it("ignores loans and loan returns, which don't change who owns him", () => {
    const joined = joinedSeasons([
      { pid: 1, season: 3 },
      { pid: 1, season: 6, loanSeasons: 2 },
      { pid: 1, season: 8, loanReturn: true },
    ]);
    expect(joined.get(1)).toBe(3);
  });
});
