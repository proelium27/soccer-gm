import { describe, it, expect } from "vitest";
import { computeOvr, heightScore } from "../../src/core/players/ovr.js";
import type { PlayerRatings } from "../../src/core/players/types.js";

const flat = (v: number): PlayerRatings => ({
  speed: v, strength: v, stamina: v, jumping: v, shortPass: v, longPass: v,
  crosses: v, dribbling: v, longShot: v, finishing: v, tackling: v,
  interceptions: v, positioning: v, goalkeeping: v,
});

describe("computeOvr", () => {
  it("a flat-50 player scores ~50 regardless of position (height ~ mid)", () => {
    const ovr = computeOvr("CM", flat(50), 180);
    expect(ovr).toBeGreaterThanOrEqual(45);
    expect(ovr).toBeLessThanOrEqual(55);
  });
  it("weights the position's signature stat: raising GK goalkeeping moves GK ovr a lot", () => {
    const base = computeOvr("GK", flat(50), 193);
    const better = computeOvr("GK", { ...flat(50), goalkeeping: 90 }, 193);
    expect(better - base).toBeGreaterThan(15); // 44% weight * 40 points
  });
  it("ignores zero-weight stats: raising a GK's finishing barely moves ovr", () => {
    const base = computeOvr("GK", flat(50), 193);
    const same = computeOvr("GK", { ...flat(50), finishing: 99 }, 193);
    expect(Math.abs(same - base)).toBeLessThan(1);
  });
  it("heightScore maps 160cm->0 and 200cm->100, clamped", () => {
    expect(heightScore(160)).toBe(0);
    expect(heightScore(200)).toBe(100);
    expect(heightScore(150)).toBe(0);
    expect(heightScore(210)).toBe(100);
  });
});
