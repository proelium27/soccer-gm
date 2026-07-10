import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generateLeague } from "../../src/core/league/generate.js";
import { leagueComposites, leagueMatchData } from "../../src/core/league/composites.js";

describe("leagueComposites", () => {
  it("returns one normalized Composites per team, averaging ~0.5 per composite", () => {
    const league = generateLeague(mulberry32(1));
    const comps = leagueComposites(league);
    expect(comps).toHaveLength(league.teams.length);
    for (const k of ["attack", "finishing", "defense", "keeping", "control"] as const) {
      const avg = comps.reduce((s, c) => s + c[k], 0) / comps.length;
      expect(avg).toBeCloseTo(0.5, 1);
    }
  });
  it("stronger teams (lower tid) get higher attack composites on average", () => {
    const league = generateLeague(mulberry32(1));
    const comps = leagueComposites(league);
    const topHalf = comps.slice(0, 10).reduce((s, c) => s + c.attack, 0) / 10;
    const bottomHalf = comps.slice(10).reduce((s, c) => s + c.attack, 0) / 10;
    expect(topHalf).toBeGreaterThan(bottomHalf);
  });
  it("recompute reproduces the starting composites for the original XI and shifts for a changed one", () => {
    const league = generateLeague(mulberry32(1));
    const data = leagueMatchData(league);
    const team = data[0];

    // Same XI in, same normalized composites out — anchored to the same league stats.
    expect(team.recompute(team.xi)).toEqual(team.composites);

    // Swapping an outfielder for a bench player must move at least one composite.
    const gk = team.xi.find((p) => p.pos === "GK")!;
    const outfield = team.xi.filter((p) => p.pos !== "GK");
    const bench = team.bench.find((p) => p.pos !== "GK")!;
    const swapped = [gk, ...outfield.slice(1), bench];
    expect(swapped).toHaveLength(11);
    const rerolled = team.recompute(swapped);
    expect(rerolled).not.toEqual(team.composites);
  });
});
