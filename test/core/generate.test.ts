import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generatePlayer } from "../../src/core/players/generate.js";
import { RATING_MIN, RATING_MAX, ABS_LOW_MAX } from "../../src/core/constants.js";

describe("generatePlayer", () => {
  it("returns a complete player with all ratings in range", () => {
    const p = generatePlayer(mulberry32(7), "ST", 55, 1, -10);
    expect(p.pid).toBe(1);
    expect(p.pos).toBe("ST");
    expect(p.ovr).toBeGreaterThan(0);
    for (const v of Object.values(p.ratings)) {
      expect(v).toBeGreaterThanOrEqual(RATING_MIN);
      expect(v).toBeLessThanOrEqual(RATING_MAX);
    }
    expect(p.potential).toBeGreaterThanOrEqual(p.ovr);
  });
  it("is deterministic for a given seed", () => {
    const a = generatePlayer(mulberry32(9), "CB", 60, 3, -10);
    const b = generatePlayer(mulberry32(9), "CB", 60, 3, -10);
    expect(a).toEqual(b);
  });
  it("archetype holds: a generated ST out-finishes a generated CB on average", () => {
    let stFin = 0, cbFin = 0;
    for (let i = 0; i < 200; i++) {
      stFin += generatePlayer(mulberry32(1000 + i), "ST", 55, i, -10).ratings.finishing;
      cbFin += generatePlayer(mulberry32(1000 + i), "CB", 55, i, -10).ratings.finishing;
    }
    expect(stFin / 200).toBeGreaterThan(cbFin / 200 + 15);
  });
  it("position-exclusive stats stay low regardless of team quality", () => {
    // An elite-base striker still cannot keep goal.
    const elite = generatePlayer(mulberry32(3), "ST", 80, 1, -10);
    expect(elite.ratings.goalkeeping).toBeLessThanOrEqual(ABS_LOW_MAX);
  });
});
