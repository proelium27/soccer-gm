import { describe, it, expect } from "vitest";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import type { DomesticCupState } from "../../src/core/domesticCup/types.js";
import { computeStandings } from "../../src/core/standings.js";
import { seasonQualification } from "../../src/core/cup/seasonQualification.js";
import { CUP_LEAGUE_PHASE_SIZE, SHIELD_LEAGUE_PHASE_SIZE } from "../../src/core/constants.js";

/**
 * The projection the Standings page shades with. It has two input paths — the
 * season in progress, read off `league.played`, and a completed season, rebuilt
 * from its history entry — and they have to agree, or a table changes its mind
 * about who qualified the moment the season rolls into history.
 */

/** A league with one played match, enough for a table to exist. */
function withOneMatch(league: LeagueStore): LeagueStore {
  const comp = league.competitions.find((c) => c.tier === 1)!;
  const [home, away] = league.teams.filter((t) => t.compId === comp.id).map((t) => t.tid);
  return {
    ...league,
    played: [{
      home, away, homeGoals: 1, awayGoals: 0, possessionHome: 0.5, matchday: 1,
      boxScore: { home: [], away: [], events: [] },
    }],
  };
}

function domesticCup(country: string, season: number, championTid: number | null): DomesticCupState {
  return {
    season, country, name: `${country} Cup`, teams: [], rounds: [],
    totalRounds: 1, championTid, statLines: null,
  };
}

describe("seasonQualification", () => {
  it("awards exactly the two fields' worth of places, and no club twice", () => {
    const q = seasonQualification(withOneMatch(makeLeague(0, 1)), "current");
    expect(q.byTid.size).toBe(CUP_LEAGUE_PHASE_SIZE + SHIELD_LEAGUE_PHASE_SIZE);
  });

  it("is unsettled until every country's cup is decided, then settled", () => {
    const league = withOneMatch(makeLeague(0, 1));
    expect(seasonQualification(league, "current").settled).toBe(false);

    const countries = [...new Set(league.competitions.map((c) => c.country))];
    const decided = {
      ...league,
      domesticCups: countries.map((c, i) => domesticCup(c, league.season, i)),
    };
    expect(seasonQualification(decided, "current").settled).toBe(true);
  });

  it("moves a place when a cup final lands mid-season", () => {
    const league = withOneMatch(makeLeague(0, 1));
    const comp = league.competitions.find((c) => c.tier === 1)!;
    const compTids = new Set(league.teams.filter((t) => t.compId === comp.id).map((t) => t.tid));
    const table = computeStandings([...compTids], league.played.filter((m) => compTids.has(m.home)));
    const winner = table[table.length - 1].tid; // bottom of the table

    const before = seasonQualification(league, "current");
    expect(before.byTid.has(winner)).toBe(false);

    const after = seasonQualification(
      { ...league, domesticCups: [domesticCup(comp.country, league.season, winner)] },
      "current",
    );
    expect(after.byTid.get(winner)).toEqual({ competition: "shield", route: "domestic-cup" });
    // Still the same number of places: he displaced someone rather than joining.
    expect(after.byTid.size).toBe(before.byTid.size);
  });

  it("reads a completed season back out of history the same way", () => {
    const league = withOneMatch(makeLeague(0, 1));
    const live = seasonQualification(league, "current");

    // The same tables, filed as history the way simOffseason files them.
    const tables = league.competitions.flatMap((c) => {
      const tids = league.teams.filter((t) => t.compId === c.id).map((t) => t.tid);
      const set = new Set(tids);
      return computeStandings(tids, league.played.filter((m) => set.has(m.home)));
    });
    const archived: LeagueStore = {
      ...league,
      season: league.season + 1,
      played: [],
      seasonHistory: [{
        season: league.season,
        table: tables,
        teamStats: [],
        awards: {},
        world: { ballonDOr: [], worldTeamOfYear: [] },
        compsByTid: Object.fromEntries(league.teams.map((t) => [t.tid, t.compId])),
        championTidByCompId: {},
      }],
    };
    const past = seasonQualification(archived, league.season);
    expect([...past.byTid.keys()].sort()).toEqual([...live.byTid.keys()].sort());
  });

  it("returns nothing for a season the save has no record of", () => {
    const q = seasonQualification(makeLeague(0, 1), 9999);
    expect(q.byTid.size).toBe(0);
    expect(q.settled).toBe(false);
  });
});
