import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generatePlayer } from "../../src/core/players/generate.js";
import {
  ageOf, progressPlayer, retirementProbability, rollRetirement,
} from "../../src/core/players/progression.js";
import { RETIREMENT_START_AGE } from "../../src/core/constants.js";

describe("ageOf", () => {
  it("computes age from season - born", () => {
    const p = generatePlayer(mulberry32(1), "ST", 55, 1, -10);
    expect(ageOf(p, 1)).toBe(11);
    expect(ageOf(p, 5)).toBe(15);
  });
});

describe("progressPlayer", () => {
  it("young player with growth room and full minutes moves toward potential", () => {
    const rng = mulberry32(42);
    let p = generatePlayer(rng, "ST", 55, 1, -18); // age 19 at season 1
    p = { ...p, potential: Math.min(99, p.ovr + 15) };
    p.stats.push({ season: 1, appearances: 30, goals: 5, assists: 2, shots: 20, shotsOnTarget: 10, saves: 0, tackles: 0 });

    const before = p.ovr;
    const after = progressPlayer(rng, p, 1);
    expect(after.ovr).toBeGreaterThanOrEqual(before);
  });

  it("appends a hist snapshot for the season", () => {
    const rng = mulberry32(7);
    const p = generatePlayer(rng, "CB", 55, 1, -20);
    const after = progressPlayer(rng, p, 1);
    expect(after.hist).toHaveLength(1);
    expect(after.hist[0].season).toBe(1);
  });

  it("does not mutate the input player", () => {
    const rng = mulberry32(3);
    const p = generatePlayer(rng, "CM", 55, 1, -22);
    const ratingsBefore = { ...p.ratings };
    progressPlayer(rng, p, 1);
    expect(p.ratings).toEqual(ratingsBefore);
  });

  it("aged-past-peak player without GK bonus declines on average", () => {
    let total = 0;
    for (let i = 0; i < 50; i++) {
      const rng = mulberry32(100 + i);
      const p = generatePlayer(rng, "CB", 55, i, -36); // age 37
      const after = progressPlayer(rng, p, 1);
      total += after.ovr - p.ovr;
    }
    expect(total / 50).toBeLessThan(0);
  });
});

describe("retirementProbability", () => {
  it("is zero below the retirement start age", () => {
    expect(retirementProbability(RETIREMENT_START_AGE - 1)).toBe(0);
  });
  it("increases with age past the start age", () => {
    const a = retirementProbability(RETIREMENT_START_AGE);
    const b = retirementProbability(RETIREMENT_START_AGE + 5);
    expect(b).toBeGreaterThan(a);
  });
});

describe("rollRetirement", () => {
  it("never retires a young player", () => {
    const rng = mulberry32(1);
    const p = generatePlayer(rng, "ST", 55, 1, -20); // age 21
    expect(rollRetirement(rng, p, 1)).toBe(false);
  });
});
