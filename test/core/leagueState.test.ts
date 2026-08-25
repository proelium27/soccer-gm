import { describe, it, expect } from "vitest";
import { makeLeague } from "../helpers/league.js";
import { PROMOTION_RELEGATION_COUNT } from "../../src/core/constants.js";

describe("createLeagueState", () => {
  const state = makeLeague(3, 42);

  it("starts at the shipped promotion/relegation count unless told otherwise", () => {
    // The New League screen is the only thing that passes another value, and
    // migrate.ts backfills the same constant, so every save has one either way.
    expect(state.promotionRelegationCount).toBe(PROMOTION_RELEGATION_COUNT);
  });

  it("returns correct shape", () => {
    expect(state).toHaveProperty("lid");
    expect(state).toHaveProperty("meta");
    expect(state).toHaveProperty("teams");
    expect(state).toHaveProperty("players");
    expect(state).toHaveProperty("season");
    expect(state).toHaveProperty("phase");
    expect(state).toHaveProperty("schedule");
    expect(state).toHaveProperty("played");
    expect(state).toHaveProperty("competitions");
  });

  it("has 16 competitions (8 countries x 2 tiers) and 320 teams (20 per competition)", () => {
    expect(state.competitions).toHaveLength(16);
    expect(state.teams).toHaveLength(320);
    const validCompIds = new Set(state.competitions.map((c) => c.id));
    for (const t of state.teams) {
      expect(typeof t.name).toBe("string");
      expect(t.name.length).toBeGreaterThan(0);
      expect(typeof t.abbrev).toBe("string");
      expect(t.abbrev.length).toBeGreaterThan(0);
      expect(t.colors).toHaveLength(2);
      expect(typeof t.colors[0]).toBe("string");
      expect(typeof t.colors[1]).toBe("string");
      expect(t.roster.length).toBeGreaterThan(0);
      expect(validCompIds.has(t.compId)).toBe(true);
    }
    for (const comp of state.competitions) {
      expect(state.teams.filter((t) => t.compId === comp.id)).toHaveLength(20);
    }
  });

  it("has 8000 players (320 teams x 25 players)", () => {
    expect(state.players).toHaveLength(8000);
  });

  it("has 6080 scheduled games (380 per competition x 16), each within one competition", () => {
    expect(state.schedule).toHaveLength(6080);
    const compByTid = new Map(state.teams.map((t) => [t.tid, t.compId]));
    for (const g of state.schedule) {
      expect(g).toHaveProperty("matchday");
      expect(g).toHaveProperty("home");
      expect(g).toHaveProperty("away");
      expect(typeof g.matchday).toBe("number");
      expect(compByTid.get(g.home)).toBe(compByTid.get(g.away));
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
