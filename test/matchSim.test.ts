import { describe, it, expect } from "vitest";
import { mulberry32 } from "../src/engine/rng.js";
import { makeTeam } from "../src/engine/composites.js";
import { resolveShot, simMatch, clamp } from "../src/engine/matchSim.js";

describe("clamp", () => {
  it("clamps below, within, and above the range", () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(2, 0, 1)).toBe(1);
  });
});

describe("resolveShot", () => {
  it("returns one of the four outcomes", () => {
    const rng = mulberry32(7);
    const off = makeTeam("O");
    const def = makeTeam("D");
    const outcomes = new Set(
      Array.from({ length: 200 }, () => resolveShot(rng, off, def)),
    );
    expect(outcomes).toEqual(
      new Set(["blocked", "off_target", "saved", "goal"]),
    );
  });
});

describe("simMatch", () => {
  it("produces a stable result for a fixed seed (golden snapshot)", () => {
    const rng = mulberry32(999);
    const r = simMatch(rng, makeTeam("Home"), makeTeam("Away"));
    expect(r.home).toBe(4);
    expect(r.away).toBe(0);
    expect(r.possessionHome).toBeCloseTo(0.5083612040133779, 5);
    expect(r.stat.home.shots).toBe(13);
  });

  it("possession fractions sum to 1", () => {
    const rng = mulberry32(123);
    const r = simMatch(rng, makeTeam("Home"), makeTeam("Away"));
    const awayPoss = r.stat.away.ticks / (r.stat.home.ticks + r.stat.away.ticks);
    expect(r.possessionHome + awayPoss).toBeCloseTo(1, 10);
  });
});
