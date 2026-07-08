import { describe, it, expect } from "vitest";
import { GEN_OFFSETS, OVR_WEIGHTS, HEIGHT_RANGES } from "../../src/core/players/templates.js";
import { POSITIONS, SKILL_KEYS } from "../../src/core/players/types.js";

describe("archetype templates", () => {
  it("every position defines an offset tier for every skill", () => {
    for (const pos of POSITIONS)
      for (const s of SKILL_KEYS)
        expect(GEN_OFFSETS[pos][s]).toBeDefined();
  });
  it("every position's OVR weights sum to 100", () => {
    for (const pos of POSITIONS) {
      const sum = Object.values(OVR_WEIGHTS[pos]).reduce((a, b) => a + b, 0);
      expect(sum).toBe(100);
    }
  });
  it("GK is goalkeeper-dominant, ST is finishing-dominant", () => {
    expect(OVR_WEIGHTS.GK.goalkeeping).toBe(78);
    expect(OVR_WEIGHTS.ST.finishing).toBe(26);
    expect(GEN_OFFSETS.GK.goalkeeping).toBe("star");
    expect(GEN_OFFSETS.ST.goalkeeping).toBe("ABS");
  });
  it("every position has a valid height range low <= high", () => {
    for (const pos of POSITIONS) {
      const [lo, hi] = HEIGHT_RANGES[pos];
      expect(lo).toBeLessThanOrEqual(hi);
    }
  });
});
