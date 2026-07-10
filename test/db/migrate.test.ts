import { describe, it, expect } from "vitest";
import { migrateLeague } from "../../src/db/migrate.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState, type LeagueStore } from "../../src/core/leagueState.js";
import { BASE_SEASON_BUDGET, HYPE_INITIAL, SCOUTING_SPEND_MIN } from "../../src/core/constants.js";

describe("migrateLeague", () => {
  it("backfills finance fields on teams from pre-M6 saves", () => {
    const league = createLeagueState(0, mulberry32(1));
    // Strip the finance fields to simulate a league saved before M6.
    const preM6 = {
      ...league,
      teams: league.teams.map(({ budget: _b, hype: _h, scoutingSpend: _s, ...rest }) => rest),
    } as unknown as LeagueStore;

    const migrated = migrateLeague(preM6);
    for (const team of migrated.teams) {
      expect(team.budget).toBe(BASE_SEASON_BUDGET);
      expect(team.hype).toBe(HYPE_INITIAL);
      expect(team.scoutingSpend).toBe(SCOUTING_SPEND_MIN);
    }
  });

  it("backfills the transfer-market lists from pre-phase-3 saves", () => {
    const league = createLeagueState(0, mulberry32(3));
    const { negotiations: _n, transfers: _t, ...rest } = league;
    const preTransfers = rest as unknown as LeagueStore;

    const migrated = migrateLeague(preTransfers);
    expect(migrated.negotiations).toEqual([]);
    expect(migrated.transfers).toEqual([]);
  });

  it("leaves existing transfer-market lists untouched", () => {
    const league = createLeagueState(0, mulberry32(4));
    const withDeals: LeagueStore = {
      ...league,
      transfers: [{ pid: 1, fromTid: 2, toTid: 0, fee: 5_000_000, season: 1, window: "winter" }],
    };
    expect(migrateLeague(withDeals).transfers).toEqual(withDeals.transfers);
  });

  it("leaves current saves' finance values untouched", () => {
    const league = createLeagueState(0, mulberry32(2));
    const custom = {
      ...league,
      teams: league.teams.map((t) => ({ ...t, budget: 123_456, hype: 77, scoutingSpend: 5_000 })),
    };

    const migrated = migrateLeague(custom);
    for (const team of migrated.teams) {
      expect(team.budget).toBe(123_456);
      expect(team.hype).toBe(77);
      expect(team.scoutingSpend).toBe(5_000);
    }
  });
});
