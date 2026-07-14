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
      Array.from({ length: 200 }, () => resolveShot(rng, off, def).outcome),
    );
    expect(outcomes).toEqual(
      new Set(["blocked", "off_target", "saved", "goal"]),
    );
  });

  it("returns an xg between 0 and 1, independent of the RNG roll", () => {
    const rng = mulberry32(7);
    const off = makeTeam("O");
    const def = makeTeam("D");
    for (const { xg } of Array.from({ length: 50 }, () => resolveShot(rng, off, def))) {
      expect(xg).toBeGreaterThan(0);
      expect(xg).toBeLessThan(1);
    }
  });

  it("xg does not depend on the shooter's finishing (only on the chance/opponent)", () => {
    // The whole point of xG is to let goals-vs-xg reveal finishing skill. If a
    // sharper finisher's shots scored higher xg purely because he's sharper,
    // his actual conversion would just track his own inflated baseline and he
    // could never show up as "beating expectation" — see resolveShot's doc
    // comment. Same def each time; only off.finishing varies.
    const def = makeTeam("D");
    const poorFinisher = makeTeam("O", { finishing: 0.1 });
    const greatFinisher = makeTeam("O", { finishing: 0.9 });

    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    const { xg: xgPoor } = resolveShot(rng1, poorFinisher, def);
    const { xg: xgGreat } = resolveShot(rng2, greatFinisher, def);

    expect(xgGreat).toBe(xgPoor);
  });

  it("xg still reflects the defender/keeper actually faced", () => {
    const off = makeTeam("O");
    const weakDef = makeTeam("D", { defense: 0.1, keeping: 0.1 });
    const strongDef = makeTeam("D", { defense: 0.9, keeping: 0.9 });

    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    const { xg: xgVsWeak } = resolveShot(rng1, off, weakDef);
    const { xg: xgVsStrong } = resolveShot(rng2, off, strongDef);

    expect(xgVsWeak).toBeGreaterThan(xgVsStrong);
  });
});

describe("simMatch", () => {
  it("produces a stable result for a fixed seed (golden snapshot)", () => {
    const rng = mulberry32(999);
    const r = simMatch(rng, makeTeam("Home"), makeTeam("Away"));
    expect(r.home).toBe(4);
    expect(r.away).toBe(0);
    expect(r.possessionHome).toBeCloseTo(0.49892008639308855, 5);
    expect(r.stat.home.shots).toBe(13);
  });

  it("possession fractions sum to 1", () => {
    const rng = mulberry32(123);
    const r = simMatch(rng, makeTeam("Home"), makeTeam("Away"));
    const awayPoss = r.stat.away.ticks / (r.stat.home.ticks + r.stat.away.ticks);
    expect(r.possessionHome + awayPoss).toBeCloseTo(1, 10);
  });
});
