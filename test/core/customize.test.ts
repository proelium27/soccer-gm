import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { applyTeamIdentities } from "../../src/core/teams/customize.js";

describe("applyTeamIdentities", () => {
  // NewLeague names the league after the chosen club at creation; mirror that.
  const base = createLeagueState(0, mulberry32(42), 42);
  const league = { ...base, meta: { ...base.meta, name: base.teams[0].name } };

  it("applies name/abbrev/colors edits to the targeted team only", () => {
    const updated = applyTeamIdentities(league, [
      { tid: 5, name: "Rename FC", abbrev: "RNF", colors: ["#111111", "#222222"] },
    ]);
    expect(updated.teams[5].name).toBe("Rename FC");
    expect(updated.teams[5].abbrev).toBe("RNF");
    expect(updated.teams[5].colors).toEqual(["#111111", "#222222"]);
    for (const t of updated.teams) {
      if (t.tid === 5) continue;
      expect(t).toEqual(league.teams[t.tid]);
    }
    expect(updated.meta.name).toBe(league.meta.name);
  });

  it("trims names and uppercases abbreviations", () => {
    const updated = applyTeamIdentities(league, [
      { tid: 3, name: "  Padded Town  ", abbrev: "pad", colors: ["#000000", "#ffffff"] },
    ]);
    expect(updated.teams[3].name).toBe("Padded Town");
    expect(updated.teams[3].abbrev).toBe("PAD");
  });

  it("renames the league when the user's club is renamed and names still match", () => {
    expect(league.meta.name).toBe(league.teams[0].name); // named after user's club
    const updated = applyTeamIdentities(league, [
      { tid: 0, name: "My New Club", abbrev: "MNC", colors: ["#000000", "#ffffff"] },
    ]);
    expect(updated.meta.name).toBe("My New Club");
  });

  it("leaves a diverged league name alone when the user's club is renamed", () => {
    const diverged = { ...league, meta: { ...league.meta, name: "Custom League" } };
    const updated = applyTeamIdentities(diverged, [
      { tid: 0, name: "My New Club", abbrev: "MNC", colors: ["#000000", "#ffffff"] },
    ]);
    expect(updated.meta.name).toBe("Custom League");
  });

  it("does not touch rosters, budgets, or starters", () => {
    const updated = applyTeamIdentities(league, [
      { tid: 2, name: "Roster Check", abbrev: "RCK", colors: ["#000000", "#ffffff"] },
    ]);
    expect(updated.teams[2].roster).toEqual(league.teams[2].roster);
    expect(updated.teams[2].budget).toBe(league.teams[2].budget);
    expect(updated.teams[2].starters).toBe(league.teams[2].starters);
  });
});
