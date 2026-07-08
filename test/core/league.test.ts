import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generateLeague } from "../../src/core/league/generate.js";
import { NUM_TEAMS } from "../../src/core/constants.js";

describe("generateLeague", () => {
  it("creates NUM_TEAMS teams each with a 25-player roster of unique pids", () => {
    const { teams, players } = generateLeague(mulberry32(1));
    expect(teams).toHaveLength(NUM_TEAMS);
    expect(players).toHaveLength(NUM_TEAMS * 25);
    expect(new Set(players.map((p) => p.pid)).size).toBe(players.length);
    for (const t of teams) expect(t.roster).toHaveLength(25);
  });
  it("is deterministic for a given seed", () => {
    const a = generateLeague(mulberry32(5));
    const b = generateLeague(mulberry32(5));
    expect(a.teams.map((t) => t.avgOvr)).toEqual(b.teams.map((t) => t.avgOvr));
  });
  it("produces a talent ladder: team strength targets span a range", () => {
    const { teams } = generateLeague(mulberry32(2));
    const ovrs = teams.map((t) => t.avgOvr).sort((x, y) => x - y);
    expect(ovrs[ovrs.length - 1] - ovrs[0]).toBeGreaterThan(8);
  });
});
