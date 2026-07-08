import { describe, it, expect } from "vitest";
import { SKILL_KEYS, POSITIONS } from "../../src/core/players/types.js";
import { ROSTER_COMPOSITION, TIER_OFFSET } from "../../src/core/constants.js";

describe("player types + constants", () => {
  it("has 14 skill keys and 8 positions", () => {
    expect(SKILL_KEYS).toHaveLength(14);
    expect(POSITIONS).toHaveLength(8);
  });
  it("roster composition sums to 25 and covers every position", () => {
    const total = POSITIONS.reduce((s, p) => s + ROSTER_COMPOSITION[p], 0);
    expect(total).toBe(25);
    for (const p of POSITIONS) expect(ROSTER_COMPOSITION[p]).toBeGreaterThan(0);
  });
  it("tier offsets are ordered star > H > M > L > VL", () => {
    expect(TIER_OFFSET.star).toBeGreaterThan(TIER_OFFSET.H);
    expect(TIER_OFFSET.H).toBeGreaterThan(TIER_OFFSET.M);
    expect(TIER_OFFSET.M).toBeGreaterThan(TIER_OFFSET.L);
    expect(TIER_OFFSET.L).toBeGreaterThan(TIER_OFFSET.VL);
  });
});
