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

  it("has 20 teams, each with name/abbrev/colors/roster", () => {
    expect(state.teams).toHaveLength(20);
    for (const t of state.teams) {
      expect(typeof t.name).toBe("string");
      expect(t.name.length).toBeGreaterThan(0);
      expect(typeof t.abbrev).toBe("string");
      expect(t.abbrev.length).toBeGreaterThan(0);
      expect(t.colors).toHaveLength(2);
      expect(typeof t.colors[0]).toBe("string");
      expect(typeof t.colors[1]).toBe("string");
      expect(t.roster.length).toBeGreaterThan(0);
    }
  });

  it("has ~500 players (20 teams x 25 players)", () => {
    expect(state.players).toHaveLength(500);
  });

  it("has 380 scheduled games", () => {
    expect(state.schedule).toHaveLength(380);
    for (const g of state.schedule) {
      expect(g).toHaveProperty("matchday");
      expect(g).toHaveProperty("home");
      expect(g).toHaveProperty("away");
      expect(typeof g.matchday).toBe("number");
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
