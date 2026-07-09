import { describe, it, expect } from "vitest";
import { computeStandings, type MatchScore } from "../../src/core/standings.js";

describe("computeStandings", () => {
  it("awards 3/1/0 and ranks by points", () => {
    const matches: MatchScore[] = [
      { home: 0, away: 1, homeGoals: 2, awayGoals: 0 }, // 0 wins
      { home: 1, away: 2, homeGoals: 1, awayGoals: 1 }, // draw
    ];
    const table = computeStandings([0, 1, 2], matches);
    expect(table[0].tid).toBe(0);
    expect(table[0].points).toBe(3);
    expect(table.find((r) => r.tid === 1)!.points).toBe(1);
    expect(table.find((r) => r.tid === 2)!.points).toBe(1);
  });
  it("breaks ties by goal difference then goals for", () => {
    const matches: MatchScore[] = [
      { home: 0, away: 2, homeGoals: 5, awayGoals: 0 }, // team0 +5
      { home: 1, away: 2, homeGoals: 2, awayGoals: 0 }, // team1 +2
    ];
    const table = computeStandings([0, 1, 2], matches);
    // teams 0 and 1 both have 3 pts; team0 has better GD.
    expect(table[0].tid).toBe(0);
    expect(table[1].tid).toBe(1);
  });
});
