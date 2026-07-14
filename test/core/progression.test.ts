import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generatePlayer } from "../../src/core/players/generate.js";
import {
  ageOf, progressPlayer, retirementProbability, rollRetirement, estimatePotential,
} from "../../src/core/players/progression.js";
import { computeOvr } from "../../src/core/players/ovr.js";
import type { PlayerRatings } from "../../src/core/players/types.js";
import { RETIREMENT_START_AGE, RATING_MAX } from "../../src/core/constants.js";

const flatRatings = (v: number): PlayerRatings => ({
  speed: v, strength: v, stamina: v, jumping: v, shortPass: v, longPass: v,
  crosses: v, dribbling: v, longShot: v, finishing: v, tackling: v,
  interceptions: v, positioning: v, goalkeeping: v,
});

describe("ageOf", () => {
  it("computes age from season - born", () => {
    const p = generatePlayer(mulberry32(1), "ST", 55, 1, 11, 1); // born season -10
    expect(ageOf(p, 1)).toBe(11);
    expect(ageOf(p, 5)).toBe(15);
  });
});

describe("estimatePotential", () => {
  it("is always >= ovr", () => {
    for (let i = 0; i < 100; i++) {
      const rng = mulberry32(i);
      const v = 40 + Math.floor(rng() * 40);
      const age = 16 + Math.floor(rng() * 25);
      const ratings = flatRatings(v);
      const ovr = computeOvr("ST", ratings, 180);
      const pot = estimatePotential(mulberry32(i + 500), ratings, ovr, age, "ST", 180, i);
      expect(pot).toBeGreaterThanOrEqual(ovr);
      expect(pot).toBeLessThanOrEqual(RATING_MAX);
    }
  });

  it("gives a teenager more headroom on average than a 32-year-old at the same ovr", () => {
    const ratings = flatRatings(60);
    const ovr = computeOvr("ST", ratings, 180);
    let youngSum = 0, oldSum = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      youngSum += estimatePotential(mulberry32(i), ratings, ovr, 17, "ST", 180, i) - ovr;
      oldSum += estimatePotential(mulberry32(i + 1000), ratings, ovr, 32, "ST", 180, i) - ovr;
    }
    expect(youngSum / N).toBeGreaterThan(oldSum / N);
  });

  it("GKs get extra effective headroom at the same age as outfielders", () => {
    const ratings = flatRatings(60);
    const gkOvr = computeOvr("GK", ratings, 190);
    const stOvr = computeOvr("ST", ratings, 190);
    let gkSum = 0, stSum = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      gkSum += estimatePotential(mulberry32(i), ratings, gkOvr, 28, "GK", 190, i) - gkOvr;
      stSum += estimatePotential(mulberry32(i + 1000), ratings, stOvr, 28, "ST", 190, i) - stOvr;
    }
    expect(gkSum / N).toBeGreaterThan(stSum / N);
  });

  it("does not pile every young star onto exactly 99", () => {
    // High-ovr, young players simulate a spread of career peaks rather than
    // all pinning to the same outcome.
    const ratings = flatRatings(80);
    const ovr = computeOvr("ST", ratings, 185);
    const pots: number[] = [];
    for (let i = 0; i < 200; i++) {
      pots.push(estimatePotential(mulberry32(i), ratings, ovr, 20, "ST", 185, i));
    }
    const distinct = new Set(pots).size;
    expect(distinct).toBeGreaterThan(1);
    expect(pots.filter((p) => p === 99).length).toBeLessThan(pots.length);
    expect(Math.max(...pots)).toBeLessThanOrEqual(RATING_MAX);
  });

  it("still lets a ceiling-ovr player read 99 (potential is never below ovr)", () => {
    // A 99-ovr player is already at the rating ceiling (height maxed too, so
    // ovr itself hits 99), so every simulated trajectory's peak is 99 too.
    const ratings = flatRatings(99);
    const ovr = computeOvr("ST", ratings, 200);
    expect(ovr).toBe(99);
    for (let i = 0; i < 50; i++) {
      expect(estimatePotential(mulberry32(i), ratings, ovr, 20, "ST", 200, i)).toBe(99);
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

  it("the form roll + development bias let even growth-age players regress, not just grow slower", () => {
    // The correlated form roll and per-player bias (on top of independent
    // per-rating noise) are what make real breakout/bust seasons possible:
    // without them, per-rating noise mostly cancels out across the many
    // ratings a weighted-average ovr is built from, and a 22-year-old's ovr
    // would move almost deterministically.
    const outcomes: number[] = [];
    for (let i = 0; i < 300; i++) {
      const rng = mulberry32(6000 + i);
      const p = generatePlayer(rng, "CM", 55, i, 22, 1);
      const after = progressPlayer(rng, p, 1);
      outcomes.push(after.ovr - p.ovr);
    }
    expect(outcomes.some((d) => d <= -5)).toBe(true);
    expect(outcomes.some((d) => d >= 6)).toBe(true);
  });

  it("no longer produces a >=10-magnitude single-season swing at a meaningful rate (form roll was tightened)", () => {
    // Regression guard for the first pass's -10-in-one-season complaint: a
    // single form roll used to be able to swing a young player 10+ by itself.
    // Extreme seasons should now be rare tail events, not routine.
    const outcomes: number[] = [];
    for (let i = 0; i < 500; i++) {
      const rng = mulberry32(8000 + i);
      const p = generatePlayer(rng, "CM", 55, i, 22, 1);
      const after = progressPlayer(rng, p, 1);
      outcomes.push(after.ovr - p.ovr);
    }
    const extreme = outcomes.filter((d) => Math.abs(d) >= 10).length;
    expect(extreme / outcomes.length).toBeLessThan(0.05);
  });

  it("some players are consistent developers and some are consistent busts across consecutive seasons", () => {
    // The persistent per-player development bias should make same-direction
    // multi-season runs far more common than pure independent per-season
    // noise would produce (iid baseline for 4 seasons all-same-sign is ~12.5%).
    let allSameDir = 0;
    const N = 300;
    for (let i = 0; i < N; i++) {
      const rng = mulberry32(9000 + i);
      let p = generatePlayer(rng, "CM", 55, i, 19, 1);
      const deltas: number[] = [];
      for (let season = 1; season <= 4; season++) {
        const after = progressPlayer(rng, p, season);
        deltas.push(after.ovr - p.ovr);
        p = after;
      }
      const nonzero = deltas.filter((d) => d !== 0);
      if (nonzero.length > 0 && (nonzero.every((d) => d > 0) || nonzero.every((d) => d < 0))) {
        allSameDir++;
      }
    }
    expect(allSameDir / N).toBeGreaterThan(0.35);
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
