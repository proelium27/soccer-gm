import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generatePlayer } from "../../src/core/players/generate.js";
import {
  ageOf, progressPlayer, retirementProbability, rollRetirement, rollPotential,
} from "../../src/core/players/progression.js";
import { RETIREMENT_START_AGE, RATING_MAX } from "../../src/core/constants.js";

describe("ageOf", () => {
  it("computes age from season - born", () => {
    const p = generatePlayer(mulberry32(1), "ST", 55, 1, 11, 1); // born season -10
    expect(ageOf(p, 1)).toBe(11);
    expect(ageOf(p, 5)).toBe(15);
  });
});

describe("rollPotential", () => {
  it("is always >= ovr", () => {
    for (let i = 0; i < 100; i++) {
      const rng = mulberry32(i);
      const ovr = 40 + Math.floor(rng() * 40);
      const age = 16 + Math.floor(rng() * 25);
      const pot = rollPotential(mulberry32(i + 500), ovr, age, "ST");
      expect(pot).toBeGreaterThanOrEqual(ovr);
      expect(pot).toBeLessThanOrEqual(RATING_MAX);
    }
  });

  it("gives a teenager more headroom on average than a 32-year-old at the same ovr", () => {
    let youngSum = 0, oldSum = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      youngSum += rollPotential(mulberry32(i), 60, 17, "ST") - 60;
      oldSum += rollPotential(mulberry32(i + 1000), 60, 32, "ST") - 60;
    }
    expect(youngSum / N).toBeGreaterThan(oldSum / N);
  });

  it("GKs get extra effective headroom at the same age as outfielders", () => {
    let gkSum = 0, stSum = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      gkSum += rollPotential(mulberry32(i), 60, 28, "GK") - 60;
      stSum += rollPotential(mulberry32(i + 1000), 60, 28, "ST") - 60;
    }
    expect(gkSum / N).toBeGreaterThan(stSum / N);
  });

  it("does not pile elite players onto exactly 99 — the soft ceiling spreads them out", () => {
    // Every high-ovr young star used to clamp to exactly 99. With the soft
    // ceiling their potentials should fan out a little above 90 and 99 itself
    // should be practically unreachable from a realistic ovr. Headroom is
    // deliberately tight now (90+ ovr/pot should be rare league-wide), so the
    // fan-out is narrow rather than wide.
    const pots: number[] = [];
    for (let i = 0; i < 400; i++) {
      // Genuine stars: high ovr, young enough to still carry headroom.
      pots.push(rollPotential(mulberry32(i), 90, 20, "ST"));
    }
    const at99 = pots.filter((p) => p === 99).length;
    const distinct = new Set(pots).size;
    expect(at99).toBe(0);
    expect(distinct).toBeGreaterThan(1);
    expect(Math.max(...pots)).toBeLessThanOrEqual(RATING_MAX);
  });

  it("still lets a ceiling-ovr player read 99 (potential is never below ovr)", () => {
    // A 99-ovr player is the only realistic way to see 99, and the floor keeps
    // potential from dropping below current ability.
    for (let i = 0; i < 50; i++) {
      expect(rollPotential(mulberry32(i), 99, 20, "ST")).toBe(99);
    }
  });
});

describe("progressPlayer", () => {
  it("appends a hist snapshot for the season", () => {
    const rng = mulberry32(7);
    const p = generatePlayer(rng, "CB", 55, 1, 19, 1);
    const after = progressPlayer(rng, p, 1);
    expect(after.hist).toHaveLength(1);
    expect(after.hist[0].season).toBe(1);
  });

  it("does not mutate the input player", () => {
    const rng = mulberry32(3);
    const p = generatePlayer(rng, "CM", 55, 1, 17, 1);
    const ratingsBefore = { ...p.ratings };
    progressPlayer(rng, p, 1);
    expect(p.ratings).toEqual(ratingsBefore);
  });

  it("re-rolls potential from the new ovr rather than keeping the old value fixed", () => {
    const rng = mulberry32(11);
    const p = generatePlayer(rng, "ST", 55, 1, 18, 1);
    const after = progressPlayer(rng, p, 1);
    expect(after.potential).toBeGreaterThanOrEqual(after.ovr);
  });

  it("teenagers improve on average across many rolls", () => {
    let total = 0;
    const N = 100;
    for (let i = 0; i < N; i++) {
      const rng = mulberry32(2000 + i);
      const p = generatePlayer(rng, "CM", 55, i, 18, 1);
      const after = progressPlayer(rng, p, 1);
      total += after.ovr - p.ovr;
    }
    expect(total / N).toBeGreaterThan(0);
  });

  it("players well past peak decline on average", () => {
    let total = 0;
    const N = 100;
    for (let i = 0; i < N; i++) {
      const rng = mulberry32(3000 + i);
      const p = generatePlayer(rng, "CB", 55, i, 37, 1);
      const after = progressPlayer(rng, p, 1);
      total += after.ovr - p.ovr;
    }
    expect(total / N).toBeLessThan(0);
  });

  it("outcomes vary across identical starting players (busts and breakouts both happen)", () => {
    const outcomes: number[] = [];
    for (let i = 0; i < 100; i++) {
      const rng = mulberry32(4000 + i);
      const p = generatePlayer(rng, "ST", 55, i, 18, 1);
      const after = progressPlayer(rng, p, 1);
      outcomes.push(after.ovr - p.ovr);
    }
    // Real spread: not every teenager gets the same delta.
    expect(new Set(outcomes).size).toBeGreaterThan(5);
    expect(Math.min(...outcomes)).toBeLessThan(Math.max(...outcomes) - 5);
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
    const p = generatePlayer(rng, "ST", 55, 1, 21, 1);
    expect(rollRetirement(rng, p, 1)).toBe(false);
  });
});
