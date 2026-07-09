import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";

describe("M3 §8 gate — top scorer", () => {
  it("top scorer averages 18–32 goals over 5 seeded seasons", () => {
    let topScorerSum = 0;
    const SEASONS = 5;

    for (let s = 0; s < SEASONS; s++) {
      const rng = mulberry32(3000 + s);
      let league = createLeagueState(0, rng);
      league = simThrough(league, "season", rng);

      let maxGoals = 0;
      for (const p of league.players) {
        for (const ss of p.stats) {
          if (ss.goals > maxGoals) maxGoals = ss.goals;
        }
      }
      topScorerSum += maxGoals;
    }

    const avg = topScorerSum / SEASONS;
    expect(avg).toBeGreaterThanOrEqual(18);
    expect(avg).toBeLessThanOrEqual(32);
  });
});
