import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { runScenario } from "../../src/engine/montecarlo.js";
import { generateLeague } from "../../src/core/league/generate.js";
import { leagueComposites } from "../../src/core/league/composites.js";

const N = 20_000;
const comps = leagueComposites(generateLeague(mulberry32(1)));
// Ends as the strong/weak pair (used by the mismatch gates below).
const strong = comps[0];
const weak = comps[comps.length - 1];

interface AveragedMetrics {
  goalsPerGame: number;
  shotsPerGame: number;
  sotPerGame: number;
  drawPct: number;
  nilNilPct: number;
  homeWinPct: number;
}

// Averaged over several independently-generated leagues (not just one fixed
// seed's "mid" team) so this gate isn't fragile to incidental shifts in how
// many random draws upstream generation code consumes per player — e.g. a
// change to potential estimation or name generation can nudge exactly which
// ratings a fixed seed's median team gets, without the game actually being
// any less balanced. See m1-table-spread.test.ts for the same pattern.
const LEAGUE_SEEDS = [1, 11, 21, 31, 41];
function averageMidVsMid(): AveragedMetrics {
  const sums: AveragedMetrics = {
    goalsPerGame: 0, shotsPerGame: 0, sotPerGame: 0,
    drawPct: 0, nilNilPct: 0, homeWinPct: 0,
  };
  for (const seed of LEAGUE_SEEDS) {
    const seedComps = leagueComposites(generateLeague(mulberry32(seed)));
    const seedMid = seedComps[Math.floor(seedComps.length / 2)];
    const r = runScenario(seedMid, seedMid, N, 12345);
    for (const key of Object.keys(sums) as (keyof AveragedMetrics)[]) {
      sums[key] += r[key];
    }
  }
  for (const key of Object.keys(sums) as (keyof AveragedMetrics)[]) {
    sums[key] /= LEAGUE_SEEDS.length;
  }
  return sums;
}

describe("M1 §8 gates — generated average teams", () => {
  const r = averageMidVsMid();
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

describe("M1 §8 gates — generated mismatch", () => {
  it("strong home beats weak 70-80% of the time", () => {
    const r = runScenario(strong, weak, N, 6789);
    expect(r.homeWinPct).toBeGreaterThanOrEqual(70);
    expect(r.homeWinPct).toBeLessThanOrEqual(80);
  });
  it("weak home avoids defeat vs strong at least 20% of the time", () => {
    const r = runScenario(weak, strong, N, 4242);
    expect(r.homeWinPct + r.drawPct).toBeGreaterThanOrEqual(20);
  });
});
