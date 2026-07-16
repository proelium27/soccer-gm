import { describe, it, expect } from "vitest";
import { migrateLeague } from "../../src/db/migrate.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState, type LeagueStore } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { HYPE_INITIAL, SCOUTING_SPEND_DEFAULT } from "../../src/core/constants.js";

describe("migrateLeague", () => {
  it("backfills finance fields on teams from pre-M6 saves", () => {
    const league = createLeagueState(0, mulberry32(1));
    // Strip the finance fields to simulate a league saved before M6.
    const preM6 = {
      ...league,
      teams: league.teams.map(({ budget: _b, hype: _h, scoutingSpend: _s, ...rest }) => rest),
    } as unknown as LeagueStore;

    const migrated = migrateLeague(preM6);
    for (const [i, team] of migrated.teams.entries()) {
      // Backfill seeds the budget like a season start (base in, wages out),
      // which for an untouched fresh league equals its creation-time budget.
      expect(team.budget).toBe(league.teams[i].budget);
      expect(team.hype).toBe(HYPE_INITIAL);
      expect(team.scoutingSpend).toBe(SCOUTING_SPEND_DEFAULT);
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

  it("backfills newsEvents to an empty array for saves written before this feature", () => {
    const league = createLeagueState(0, mulberry32(7));
    const { newsEvents: _ne, ...withoutNewsEvents } = league;
    const migrated = migrateLeague(withoutNewsEvents as unknown as LeagueStore);
    expect(migrated.newsEvents).toEqual([]);
  });

  it("leaves existing newsEvents untouched", () => {
    const league = createLeagueState(0, mulberry32(8));
    const withEvents: LeagueStore = {
      ...league,
      newsEvents: [{ type: "hattrick", pid: 1, tid: 0, season: 1, matchday: 3, detail: 3 }],
    };
    expect(migrateLeague(withEvents).newsEvents).toEqual(withEvents.newsEvents);
  });

  it("backfills minutesPlayed/rating fields from pre-Match-Rating saves", () => {
    const league = simThrough(createLeagueState(0, mulberry32(5)), "game", mulberry32(6));
    const preRating = {
      ...league,
      players: league.players.map((p) => ({
        ...p,
        stats: p.stats.map(({ minutesPlayed: _m, ratingSum: _r, avgRating: _a, ...rest }) => rest),
      })),
      played: league.played.map((m) => ({
        ...m,
        boxScore: {
          ...m.boxScore,
          home: m.boxScore.home.map(({ minutesPlayed: _m, rating: _r, ...rest }) => rest),
          away: m.boxScore.away.map(({ minutesPlayed: _m, rating: _r, ...rest }) => rest),
        },
      })),
    } as unknown as LeagueStore;

    const migrated = migrateLeague(preRating);
    for (const p of migrated.players) {
      for (const ss of p.stats) {
        expect(ss.minutesPlayed).toBe(0);
        expect(ss.ratingSum).toBe(0);
        expect(ss.avgRating).toBe(0);
      }
    }
    for (const m of migrated.played) {
      for (const line of [...m.boxScore.home, ...m.boxScore.away]) {
        expect(line.minutesPlayed).toBe(0);
        expect(line.rating).toBe(6.0);
      }
    }
  });

  it("backfills interceptions to 0 on pre-existing box-score lines and season stats", () => {
    const league = simThrough(createLeagueState(0, mulberry32(5)), "game", mulberry32(6));
    const preInterceptions = {
      ...league,
      players: league.players.map((p) => ({
        ...p,
        stats: p.stats.map(({ interceptions: _i, ...rest }) => rest),
      })),
      played: league.played.map((m) => ({
        ...m,
        boxScore: {
          ...m.boxScore,
          home: m.boxScore.home.map(({ interceptions: _i, ...rest }) => rest),
          away: m.boxScore.away.map(({ interceptions: _i, ...rest }) => rest),
        },
      })),
    } as unknown as LeagueStore;

    const migrated = migrateLeague(preInterceptions);
    for (const p of migrated.players) {
      for (const ss of p.stats) {
        expect(ss.interceptions).toBe(0);
      }
    }
    for (const m of migrated.played) {
      for (const line of [...m.boxScore.home, ...m.boxScore.away]) {
        expect(line.interceptions).toBe(0);
      }
    }
  });

  it("leaves current match-rating fields untouched", () => {
    const league = simThrough(createLeagueState(0, mulberry32(7)), "game", mulberry32(8));
    const migrated = migrateLeague(league);
    expect(migrated.players).toEqual(league.players);
    expect(migrated.played).toEqual(league.played);
  });

  it("backfills academyRoster to [] on pre-Academy saves", () => {
    const league = createLeagueState(0, mulberry32(9));
    const preAcademy = {
      ...league,
      teams: league.teams.map(({ academyRoster: _a, ...rest }) => rest),
    } as unknown as LeagueStore;

    const migrated = migrateLeague(preAcademy);
    for (const team of migrated.teams) {
      expect(team.academyRoster).toEqual([]);
    }
  });

  it("leaves an existing academyRoster untouched", () => {
    const league = createLeagueState(0, mulberry32(10));
    const withAcademy: LeagueStore = {
      ...league,
      teams: league.teams.map((t) => (t.tid === 0 ? { ...t, academyRoster: [42] } : t)),
    };
    const migrated = migrateLeague(withAcademy);
    expect(migrated.teams.find((t) => t.tid === 0)!.academyRoster).toEqual([42]);
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

  it("backfills division/divisionConvergence on old-save teams, and divisionsByTid/awards on old-save seasonHistory", () => {
    const rng = mulberry32(12);
    const league = simOffseason(simThrough(createLeagueState(0, mulberry32(11)), "season", rng), rng);
    const oldLeague = {
      ...league,
      teams: league.teams.map(({ compId: _d, divisionConvergence: _dc, ...rest }) => rest),
      seasonHistory: league.seasonHistory.map((h) => {
        const { divisionsByTid: _dbt, ...rest } = h;
        return { ...rest, awards: h.awards[0] };
      }),
    } as unknown as LeagueStore;

    const migrated = migrateLeague(oldLeague);

    for (const t of migrated.teams) {
      expect(t.compId).toBe(0);
      expect(t.divisionConvergence).toBeNull();
    }

    for (const h of migrated.seasonHistory) {
      expect(Array.isArray(h.awards)).toBe(true);
      expect(h.awards).toHaveLength(2);
      for (const tid of Object.keys(h.divisionsByTid).map(Number)) {
        expect(h.divisionsByTid[tid]).toBe(0);
      }
    }
  });
});

describe("migrateLeague pre-M3 box scores", () => {
  it("tolerates played matches with no boxScore at all", () => {
    const league = simThrough(createLeagueState(0, mulberry32(7)), "game", mulberry32(8));
    expect(league.played.length).toBeGreaterThan(0);
    const preM3 = {
      ...league,
      played: league.played.map(({ boxScore: _b, ...rest }) => rest),
    } as unknown as LeagueStore;

    const migrated = migrateLeague(preM3);
    expect(migrated.played).toHaveLength(league.played.length);
    for (const m of migrated.played) {
      expect(m.boxScore).toEqual({ home: [], away: [], events: [] });
    }
  });
});
