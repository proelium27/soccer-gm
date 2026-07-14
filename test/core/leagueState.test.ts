import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";

describe("createLeagueState", () => {
  const state = createLeagueState(3, mulberry32(42));

  it("returns correct shape", () => {
    expect(state).toHaveProperty("lid");
    expect(state).toHaveProperty("meta");
    expect(state).toHaveProperty("teams");
    expect(state).toHaveProperty("players");
    expect(state).toHaveProperty("season");
    expect(state).toHaveProperty("phase");
    expect(state).toHaveProperty("schedule");
    expect(state).toHaveProperty("played");
  });

  it("has 40 teams (20 per division), each with name/abbrev/colors/roster/division", () => {
    expect(state.teams).toHaveLength(40);
    for (const t of state.teams) {
      expect(typeof t.name).toBe("string");
      expect(t.name.length).toBeGreaterThan(0);
      expect(typeof t.abbrev).toBe("string");
      expect(t.abbrev.length).toBeGreaterThan(0);
      expect(t.colors).toHaveLength(2);
      expect(typeof t.colors[0]).toBe("string");
      expect(typeof t.colors[1]).toBe("string");
      expect(t.roster.length).toBeGreaterThan(0);
      expect(t.division === 0 || t.division === 1).toBe(true);
    }
    expect(state.teams.filter((t) => t.division === 0)).toHaveLength(20);
    expect(state.teams.filter((t) => t.division === 1)).toHaveLength(20);
  });

  it("has ~1000 players (40 teams x 25 players)", () => {
    expect(state.players).toHaveLength(1000);
  });

  it("has 760 scheduled games (380 per division)", () => {
    expect(state.schedule).toHaveLength(760);
    for (const g of state.schedule) {
      expect(g).toHaveProperty("matchday");
      expect(g).toHaveProperty("home");
      expect(g).toHaveProperty("away");
      expect(typeof g.matchday).toBe("number");
    }
    const teamsByTid = new Map(state.teams.map((t) => [t.tid, t]));
    for (const g of state.schedule) {
      expect(teamsByTid.get(g.home)!.division).toBe(teamsByTid.get(g.away)!.division);
    }
  });

  it("phase is 'regular', season is 1, played is empty", () => {
    expect(state.phase).toBe("regular");
    expect(state.season).toBe(1);
    expect(state.played).toEqual([]);
  });

  it("meta.userTid matches the input", () => {
    expect(state.meta.userTid).toBe(3);
  });
});
