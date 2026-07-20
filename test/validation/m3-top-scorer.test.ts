import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";

describe("M3 §8 gate — top scorer", () => {
  // Ceiling raised 32 -> 36 when the individual-finisher effect
  // (SHOOTER_FINISH_WEIGHT) landed: goals now concentrate on a team's best
  // finishers by design, so the league's scoring leader legitimately reaches
  // the mid-30s — in line with real top-flight Golden Boot totals (~30-36).
  it("top scorer averages 18–36 goals over 5 seeded seasons", () => {
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
    expect(avg).toBeLessThanOrEqual(36);
  });
});
