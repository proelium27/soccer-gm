import { describe, it, expect } from "vitest";
import { runScenario, PRESETS } from "../../src/engine/montecarlo.js";

const N = 20_000;

describe("§8 validation gates — equal teams (home vs away)", () => {
  const r = runScenario(PRESETS.equal, PRESETS.equal, N, 12345);

  it("goals/game in 2.6-2.9", () => {
    expect(r.goalsPerGame).toBeGreaterThanOrEqual(2.6);
    expect(r.goalsPerGame).toBeLessThanOrEqual(2.9);
  });
  it("shots/game in 23-27", () => {
    expect(r.shotsPerGame).toBeGreaterThanOrEqual(23);
    expect(r.shotsPerGame).toBeLessThanOrEqual(27);
  });
  it("shots on target in 8-9.5", () => {
    expect(r.sotPerGame).toBeGreaterThanOrEqual(8);
    expect(r.sotPerGame).toBeLessThanOrEqual(9.5);
  });
  it("draw rate in 23-28%", () => {
    expect(r.drawPct).toBeGreaterThanOrEqual(23);
    expect(r.drawPct).toBeLessThanOrEqual(28);
  });
  it("0-0 rate in 5-9%", () => {
    expect(r.nilNilPct).toBeGreaterThanOrEqual(5);
    expect(r.nilNilPct).toBeLessThanOrEqual(9);
  });
  it("home win rate in 38-46%", () => {
    expect(r.homeWinPct).toBeGreaterThanOrEqual(38);
    expect(r.homeWinPct).toBeLessThanOrEqual(46);
  });
});

describe("§8 validation gates — mismatch", () => {
  it("strong home beats weak 70-80% of the time", () => {
    const r = runScenario(PRESETS.strong, PRESETS.weak, N, 6789);
    expect(r.homeWinPct).toBeGreaterThanOrEqual(70);
    expect(r.homeWinPct).toBeLessThanOrEqual(80);
  });

  it("weak home avoids defeat vs strong at least 20% of the time", () => {
    const r = runScenario(PRESETS.weak, PRESETS.strong, N, 4242);
    const avoidsDefeat = r.homeWinPct + r.drawPct;
    expect(avoidsDefeat).toBeGreaterThanOrEqual(20);
  });
});
