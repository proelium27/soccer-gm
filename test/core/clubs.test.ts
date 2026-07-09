import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generateLeague } from "../../src/core/league/generate.js";
import { CLUBS, assignIdentities } from "../../src/core/teams/clubs.js";

describe("CLUBS", () => {
  it("has exactly 20 entries", () => {
    expect(CLUBS).toHaveLength(20);
  });

  it("has all unique abbreviations that are exactly 3 characters", () => {
    const abbrevs = CLUBS.map((c) => c.abbrev);
    expect(new Set(abbrevs).size).toBe(20);
    for (const a of abbrevs) {
      expect(a).toHaveLength(3);
    }
  });

  it("has all unique names", () => {
    const names = CLUBS.map((c) => c.name);
    expect(new Set(names).size).toBe(20);
  });
});

describe("assignIdentities", () => {
  const league = generateLeague(mulberry32(42));
  const stored = assignIdentities(league);

  it("maps tids correctly (tid N gets CLUBS[N])", () => {
    for (const st of stored) {
      const club = CLUBS[st.tid];
      expect(st.name).toBe(club.name);
      expect(st.abbrev).toBe(club.abbrev);
      expect(st.colors).toEqual(club.colors);
    }
  });

  it("preserves the roster from the original LeagueTeam", () => {
    for (const st of stored) {
      const original = league.teams.find((t) => t.tid === st.tid)!;
      expect(st.roster).toEqual(original.roster);
    }
  });
});
