import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { HYPE_MAX, HYPE_MIN, NUM_TEAMS, SCOUTING_SPEND_MIN } from "../../src/core/constants.js";

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

  it("settles every team's budget and hype, and resets scouting spend for the new season", () => {
    const rng = mulberry32(7);
    const league = playFullSeason(rng);
    const budgetsBefore = new Map(league.teams.map((t) => [t.tid, t.budget]));
    const next = simOffseason(league, rng);

    expect(next.teams).toHaveLength(NUM_TEAMS);
    for (const team of next.teams) {
      // Budget moved (performance money in at season end, base in and wages
      // out at the new season's start).
      expect(team.budget).not.toBe(budgetsBefore.get(team.tid));
      expect(team.hype).toBeGreaterThanOrEqual(HYPE_MIN);
      expect(team.hype).toBeLessThanOrEqual(HYPE_MAX);
      expect(team.scoutingSpend).toBe(SCOUTING_SPEND_MIN);
    }
  });

  it("produces a spread of budgets across clubs (success payouts aren't flat)", () => {
    const rng = mulberry32(8);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);

    const budgets = next.teams.map((t) => t.budget);
    expect(Math.max(...budgets)).toBeGreaterThan(Math.min(...budgets));
  });

  it("grows every club's budget every season (design: no club ever loses money)", () => {
    const rng = mulberry32(11);
    let league = playFullSeason(rng);

    for (let s = 0; s < 2; s++) {
      const budgetsBefore = new Map(league.teams.map((t) => [t.tid, t.budget]));
      league = simOffseason(league, rng);
      for (const team of league.teams) {
        expect(team.budget).toBeGreaterThan(budgetsBefore.get(team.tid)!);
      }
      league = simThrough(league, "season", rng);
    }
  });
});

describe("simOffseason injuries", () => {
  it("clears any lingering injury at the season rollover", () => {
    const rng = mulberry32(21);
    const league = playFullSeason(rng);
    // Wound a handful of players as if hurt on the final matchday, with the
    // longest possible recovery still outstanding.
    const wounded = new Set(league.players.slice(0, 5).map((p) => p.pid));
    const withInjuries = {
      ...league,
      players: league.players.map((p) =>
        wounded.has(p.pid) ? { ...p, injury: { gamesRemaining: 6, type: "knock" } } : p,
      ),
    };

    const next = simOffseason(withInjuries, rng);
    for (const p of next.players) {
      expect(p.injury).toBeNull();
    }
  });
});
