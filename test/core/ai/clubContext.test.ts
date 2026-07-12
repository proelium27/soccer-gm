import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../../src/engine/rng.js";
import { createLeagueState } from "../../../src/core/leagueState.js";
import { deriveLeagueContexts } from "../../../src/core/ai/clubContext.js";
import { POSITIONS } from "../../../src/core/players/types.js";

describe("deriveLeagueContexts", () => {
  it("produces a context for every team", () => {
    const league = createLeagueState(0, mulberry32(3));
    const contexts = deriveLeagueContexts(league);
    expect(contexts.size).toBe(league.teams.length);
    for (const t of league.teams) expect(contexts.has(t.tid)).toBe(true);
  });

  it("positional depth sums to the roster size", () => {
    const league = createLeagueState(0, mulberry32(3));
    const contexts = deriveLeagueContexts(league);
    for (const t of league.teams) {
      const c = contexts.get(t.tid)!;
      const total = POSITIONS.reduce((sum, pos) => sum + c.posDepth[pos], 0);
      expect(total).toBe(t.roster.length);
    }
  });

  it("a rich, famous club has higher ambition and lower frugality than a poor, obscure one", () => {
    const league = createLeagueState(0, mulberry32(4));
    // Force two clubs to financial extremes; leave the rest as generated.
    const teams = league.teams.map((t, i) =>
      i === 0 ? { ...t, budget: 500_000_000, hype: 100 }
      : i === 1 ? { ...t, budget: 1_000_000, hype: 0 }
      : t,
    );
    const contexts = deriveLeagueContexts({ ...league, teams });
    const rich = contexts.get(teams[0].tid)!;
    const poor = contexts.get(teams[1].tid)!;

    expect(rich.ambition).toBeGreaterThan(poor.ambition);
    expect(rich.frugality).toBeLessThan(poor.frugality);
    // The richest club in the league is minimally cautious; the poorest maximally.
    expect(rich.frugality).toBeCloseTo(0, 5);
    expect(poor.frugality).toBeCloseTo(1, 5);
  });

  it("ambition and frugality stay within [0,1]", () => {
    const league = createLeagueState(0, mulberry32(5));
    const contexts = deriveLeagueContexts(league);
    for (const c of contexts.values()) {
      expect(c.ambition).toBeGreaterThanOrEqual(0);
      expect(c.ambition).toBeLessThanOrEqual(1);
      expect(c.frugality).toBeGreaterThanOrEqual(0);
      expect(c.frugality).toBeLessThanOrEqual(1);
    }
  });
});
