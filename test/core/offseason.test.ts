import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { NUM_TEAMS } from "../../src/core/constants.js";

function playFullSeason(rng: () => number) {
  let league = createLeagueState(0, rng);
  league = simThrough(league, "season", rng);
  return league;
}

describe("simOffseason", () => {
  it("is a no-op unless the league is in the offseason phase", () => {
    const rng = mulberry32(1);
    const league = createLeagueState(0, rng);
    const result = simOffseason(league, rng);
    expect(result).toBe(league);
  });

  it("advances the season, resets schedule/played, and returns to regular phase", () => {
    const rng = mulberry32(2);
    const league = playFullSeason(rng);
    expect(league.phase).toBe("offseason");

    const next = simOffseason(league, rng);
    expect(next.season).toBe(league.season + 1);
    expect(next.phase).toBe("regular");
    expect(next.played).toEqual([]);
    expect(next.schedule).toHaveLength(380);
  });

  it("every team still fields a full 25-man roster after progression/retirement/FA/youth", () => {
    const rng = mulberry32(3);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);

    for (const team of next.teams) {
      expect(team.roster.length).toBeGreaterThanOrEqual(20);
    }
    expect(next.teams).toHaveLength(NUM_TEAMS);
  });

  it("every roster keeps at least one GK after the offseason", () => {
    const rng = mulberry32(4);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);
    const playerMap = new Map(next.players.map((p) => [p.pid, p]));

    for (const team of next.teams) {
      const gkCount = team.roster.filter((pid) => playerMap.get(pid)?.pos === "GK").length;
      expect(gkCount).toBeGreaterThan(0);
    }
  });

  it("youth intake adds new 16-year-olds to every club", () => {
    const rng = mulberry32(5);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);

    const sixteenYearOlds = next.players.filter((p) => next.season - p.born === 16);
    expect(sixteenYearOlds.length).toBeGreaterThanOrEqual(NUM_TEAMS * 3);
  });

  it("no duplicate pids exist across the player pool after offseason", () => {
    const rng = mulberry32(6);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);
    const pids = next.players.map((p) => p.pid);
    expect(new Set(pids).size).toBe(pids.length);
  });
});
