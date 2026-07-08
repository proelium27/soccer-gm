import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { simMatch } from "../../src/engine/matchSim.js";
import { generateLeague } from "../../src/core/league/generate.js";
import { leagueComposites } from "../../src/core/league/composites.js";
import { doubleRoundRobin } from "../../src/core/schedule.js";
import { computeStandings, type PlayedMatch } from "../../src/core/standings.js";

/** Sim one full season and return the final table. */
function simSeason(seed: number) {
  const rng = mulberry32(seed);
  const league = generateLeague(rng);
  const comps = leagueComposites(league);
  const teamIds = league.teams.map((t) => t.tid);
  const fixtures = doubleRoundRobin(teamIds);
  const matches: PlayedMatch[] = fixtures.map((f) => {
    const r = simMatch(rng, comps[f.home], comps[f.away]);
    return { home: f.home, away: f.away, homeGoals: r.home, awayGoals: r.away };
  });
  return computeStandings(teamIds, matches);
}

describe("M1 gate (b) — season table spread", () => {
  it("champion 78-94 pts and bottom 15-32 pts (averaged over 5 seeded seasons)", () => {
    let champSum = 0;
    let bottomSum = 0;
    const SEASONS = 5;
    for (let s = 0; s < SEASONS; s++) {
      const table = simSeason(1000 + s);
      champSum += table[0].points;
      bottomSum += table[table.length - 1].points;
    }
    const champ = champSum / SEASONS;
    const bottom = bottomSum / SEASONS;
    expect(champ).toBeGreaterThanOrEqual(78);
    expect(champ).toBeLessThanOrEqual(94);
    expect(bottom).toBeGreaterThanOrEqual(15);
    expect(bottom).toBeLessThanOrEqual(32);
  });
});
