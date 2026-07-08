import { describe, it, expect } from "vitest";
import { runScenario, PRESETS } from "../src/engine/montecarlo.js";

describe("runScenario", () => {
  it("is deterministic for a fixed seed", () => {
    const a = runScenario(PRESETS.equal, PRESETS.equal, 500, 12345);
    const b = runScenario(PRESETS.equal, PRESETS.equal, 500, 12345);
    expect(a).toEqual(b);
  });

  it("reports result percentages that sum to ~100", () => {
    const r = runScenario(PRESETS.equal, PRESETS.equal, 1000, 1);
    expect(r.homeWinPct + r.drawPct + r.awayWinPct).toBeCloseTo(100, 6);
  });

  it("exposes the requested n and seed", () => {
    const r = runScenario(PRESETS.equal, PRESETS.equal, 250, 77);
    expect(r.n).toBe(250);
    expect(r.seed).toBe(77);
  });

  it("has all three presets", () => {
    expect(PRESETS.equal.attack).toBe(0.5);
    expect(PRESETS.strong.attack).toBe(0.63);
    expect(PRESETS.weak.attack).toBe(0.38);
  });
});
