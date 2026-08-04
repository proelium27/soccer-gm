import { describe, expect, it } from "vitest";
import { computeRecordBook } from "../../src/core/frivolities/records.js";
import { computePlayerBios } from "../../src/core/frivolities/bios.js";
import { computeClubTrivia } from "../../src/core/frivolities/clubs.js";
import { allCareers } from "../../src/core/frivolities/careers.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import type { ArchivedPlayer } from "../../src/core/players/archive.js";
import { FREE_AGENT_TID } from "../../src/core/transfers/negotiation.js";
import { emptySeasonStats, type Player } from "../../src/core/players/types.js";
import type { SeasonHistoryEntry, StandingsRow } from "../../src/core/standings.js";

/** A standings row with only the fields these derivations read. */
function row(tid: number, played: number, points: number, gd = 0, gf = 0): StandingsRow {
  return { tid, played, won: 0, drawn: 0, lost: 0, gf, ga: gf - gd, gd, points };
}

interface PlayerOver {
  pid: number;
  ovr?: number;
  age?: number;
  name?: string;
  nationality?: string;
  heightCm?: number;
  /** [season, tid, appearances, goals, assists] */
  lines?: [number, number, number, number, number][];
  hist?: [number, number][];
}

function makePlayer(o: PlayerOver): Player {
  return {
    pid: o.pid,
    name: o.name ?? `Player ${o.pid}`,
    nationality: o.nationality ?? "eng",
    born: 2030 - (o.age ?? 25),
    pos: "ST",
    heightCm: o.heightCm ?? 180,
    ovr: o.ovr ?? 60,
    potential: o.ovr ?? 60,
    stats: (o.lines ?? []).map(([season, tid, appearances, goals, assists]) => ({
      ...emptySeasonStats(season, tid), appearances, goals, assists,
      ratingSum: appearances * 7, minutesPlayed: appearances * 90,
    })),
    hist: (o.hist ?? []).map(([season, ovr]) => ({
      season, ovr, ratings: {}, potential: ovr, academy: false,
    })),
  } as unknown as Player;
}

function makeArchived(o: Partial<ArchivedPlayer> & { pid: number }): ArchivedPlayer {
  return {
    name: `Retiree ${o.pid}`, nationality: "esp", pos: "ST", born: 1990, heightCm: 180,
    retiredSeason: 2028, retiredAge: 36, firstSeason: 2010, seasonsPlayed: 18,
    peakOvr: 80, peakSeason: 2018, finalOvr: 70, clubs: [1],
    appearances: 500, goals: 300, assists: 100, minutesPlayed: 45000,
    saves: 0, tackles: 0, interceptions: 0, avgRating: 7.5, caps: 100, intlGoals: 50,
    bestGoals: 35, bestGoalsSeason: 2018, bestAssists: 12, bestAssistsSeason: 2019,
    ...o,
  } as ArchivedPlayer;
}

/**
 * A season-history entry carrying only the fields these derivations read.
 * The awards/world/teamStats halves belong to other pages, so they stay empty
 * rather than being filled in with fixture noise.
 */
function makeHistory(
  season: number,
  table: StandingsRow[],
  compsByTid: Record<number, number>,
): SeasonHistoryEntry {
  return {
    season, table, compsByTid, teamStats: [], awards: {}, championTidByCompId: {},
  } as unknown as SeasonHistoryEntry;
}

/** A LeagueStore carrying only what the frivolities derivations read. */
function makeStore(over: Partial<LeagueStore> = {}): LeagueStore {
  return {
    season: 2030,
    competitions: [
      { id: 0, country: "eng", tier: 1, name: "England D1" },
      { id: 1, country: "eng", tier: 2, name: "England D2" },
    ],
    teams: [
      { tid: 1, roster: [], academyRoster: [], compId: 0 },
      { tid: 2, roster: [], academyRoster: [], compId: 0 },
      { tid: 3, roster: [], academyRoster: [], compId: 1 },
    ],
    players: [],
    retiredPlayers: [],
    seasonHistory: [],
    transfers: [],
    cupHistory: [],
    ...over,
  } as unknown as LeagueStore;
}

describe("allCareers", () => {
  it("merges living players and archived retirees into one field", () => {
    // The whole point of the shared row: an all-time list must not quietly
    // cover only the players who happen to still be alive.
    const store = makeStore({
      players: [makePlayer({ pid: 1, lines: [[2029, 1, 30, 20, 5]] })],
      retiredPlayers: [makeArchived({ pid: 99 })],
    });
    const careers = allCareers(store);
    expect(careers.map((c) => c.pid).sort()).toEqual([1, 99]);
    expect(careers.find((c) => c.pid === 1)!.active).toBe(true);
    expect(careers.find((c) => c.pid === 99)!.active).toBe(false);
  });

  it("dates a peak with no ratings history to the current season, not the birth season", () => {
    // A first-season player has no `hist` yet. `born` is a season number too,
    // so falling back to it renders a plausible-looking but wrong year.
    const store = makeStore({
      season: 2030,
      players: [makePlayer({ pid: 1, age: 22, lines: [[2030, 1, 30, 5, 5]] })],
    });
    expect(allCareers(store)[0].peakSeason).toBe(2030);
  });

  it("excludes players who never made a senior appearance", () => {
    // Academy kids and unsigned free agents would otherwise pad every list.
    const store = makeStore({ players: [makePlayer({ pid: 1 })] });
    expect(allCareers(store)).toHaveLength(0);
  });
});

describe("computeRecordBook", () => {
  it("ranks team seasons by points per game, not raw points", () => {
    // The load-bearing case: a 38-game league and a 20-game league in the same
    // save. Raw points would rank the bigger league's weaker season first.
    const store = makeStore({
      seasonHistory: [makeHistory(2029, [row(1, 38, 80), row(3, 20, 55)], { 1: 0, 3: 1 })],
    });
    const book = computeRecordBook(store);
    expect(book.bestTeamSeasons[0].tid).toBe(3); // 2.75 ppg vs 2.11
    expect(book.worstTeamSeasons[0].tid).toBe(1);
  });

  it("files a season under the competition it was played in, not today's", () => {
    // Club 1 sits in compId 0 today but played that season in the second tier.
    const store = makeStore({
      seasonHistory: [makeHistory(2029, [row(1, 20, 50)], { 1: 1 })],
    });
    expect(computeRecordBook(store).bestTeamSeasons[0].tier).toBe(2);
  });

  it("counts only real purchases among the biggest fees", () => {
    const store = makeStore({
      players: [makePlayer({ pid: 1, lines: [[2029, 1, 5, 0, 0]] })],
      transfers: [
        { pid: 1, fromTid: 1, toTid: 2, fee: 50, season: 2029, window: "summer" },
        { pid: 1, fromTid: 2, toTid: 1, fee: 900, season: 2029, window: "summer", loanSeasons: 1 },
        { pid: 1, fromTid: FREE_AGENT_TID, toTid: 2, fee: 800, season: 2029, window: "summer" },
        { pid: 1, fromTid: 1, toTid: 2, fee: 0, season: 2029, window: "summer" },
      ],
    } as Partial<LeagueStore>);
    const fees = computeRecordBook(store).biggestTransfers;
    expect(fees).toHaveLength(1);
    expect(fees[0].fee).toBe(50);
  });

  it("puts retirees on the all-time lists alongside active players", () => {
    const store = makeStore({
      players: [makePlayer({ pid: 1, lines: [[2029, 1, 30, 20, 5]], hist: [[2029, 75]] })],
      retiredPlayers: [makeArchived({ pid: 99, goals: 300, peakOvr: 88, bestGoals: 35 })],
    });
    const book = computeRecordBook(store);
    expect(book.careerGoals[0].pid).toBe(99);
    expect(book.peakRatings[0].pid).toBe(99);
    expect(book.seasonGoals[0].pid).toBe(99);
    expect(book.hasArchive).toBe(true);
  });
});

describe("computePlayerBios", () => {
  const store = makeStore({
    teams: [{ tid: 1, roster: [1, 2], academyRoster: [3], compId: 0 }],
    players: [
      makePlayer({ pid: 1, name: "Alan Smith", nationality: "eng", heightCm: 200, age: 34, ovr: 70 }),
      makePlayer({ pid: 2, name: "Bob Smith", nationality: "eng", heightCm: 165, age: 30, ovr: 80 }),
      makePlayer({ pid: 3, name: "Carlos Ruiz", nationality: "esp", heightCm: 180, age: 17, ovr: 50 }),
    ],
  } as Partial<LeagueStore>);
  const bios = computePlayerBios(store);

  it("finds the height and age extremes", () => {
    expect(bios.tallest[0].pid).toBe(1);
    expect(bios.shortest[0].pid).toBe(2);
    expect(bios.oldest[0].pid).toBe(1);
    // The academy teenager must be eligible or the youngest list is nonsense.
    expect(bios.youngest[0].pid).toBe(3);
  });

  it("aggregates each country's players and names its best", () => {
    const eng = bios.nationalities.find((n) => n.nationality === "eng")!;
    expect(eng.count).toBe(2);
    expect(eng.avgOvr).toBe(75);
    expect(eng.best!.pid).toBe(2);
    // Academy players count toward the country but not the rostered tally.
    const esp = bios.nationalities.find((n) => n.nationality === "esp")!;
    expect(esp.rostered).toBe(0);
  });

  it("counts shared surnames, keeping multi-word surnames whole", () => {
    expect(bios.commonSurnames).toEqual([{ name: "Smith", count: 2 }]);
    // A name nobody shares is not a "common name".
    expect(bios.commonFirstNames).toEqual([]);
  });
});

describe("computeClubTrivia", () => {
  const history = [
    makeHistory(2028, [row(1, 38, 90, 40, 80), row(2, 38, 70, 20, 60), row(3, 38, 88, 30, 70)],
      { 1: 0, 2: 0, 3: 1 }),
    makeHistory(2029, [row(1, 38, 60, 10, 50), row(2, 38, 85, 35, 75), row(3, 38, 91, 45, 85)],
      { 1: 0, 2: 0, 3: 1 }),
  ];

  it("counts titles per competition, separating the tiers", () => {
    const trivia = computeClubTrivia(makeStore({ seasonHistory: history }));
    const byTid = new Map(trivia.records.map((r) => [r.tid, r]));
    expect(byTid.get(1)!.leagueTitles).toBe(1); // won the 2028 top flight
    expect(byTid.get(2)!.leagueTitles).toBe(1); // won the 2029 top flight
    // Club 3 topped the second tier twice — trophies, but not league titles.
    expect(byTid.get(3)!.leagueTitles).toBe(0);
    expect(byTid.get(3)!.secondTierTitles).toBe(2);
    expect(byTid.get(3)!.topFlightSeasons).toBe(0);
  });

  it("measures a never-won club's drought as its whole recorded history", () => {
    const trivia = computeClubTrivia(makeStore({ seasonHistory: history }));
    const club3 = trivia.records.find((r) => r.tid === 3)!;
    expect(club3.lastTitleSeason).toBeNull();
    expect(club3.titleDrought).toBe(2);
    // Club 1 last won in 2028 and the latest recorded season is 2029.
    expect(trivia.records.find((r) => r.tid === 1)!.titleDrought).toBe(1);
  });

  it("counts cup titles from the archived cups", () => {
    const trivia = computeClubTrivia(makeStore({
      seasonHistory: history,
      cupHistory: [{ championTid: 2 }, { championTid: 2 }, { championTid: null }],
    } as unknown as Partial<LeagueStore>));
    expect(trivia.records.find((r) => r.tid === 2)!.cupTitles).toBe(2);
  });

  it("excludes loans and free moves from transfer spending", () => {
    const trivia = computeClubTrivia(makeStore({
      transfers: [
        { pid: 1, fromTid: 1, toTid: 2, fee: 100, season: 2029, window: "summer" },
        { pid: 2, fromTid: 1, toTid: 2, fee: 500, season: 2029, window: "summer", loanSeasons: 1 },
        { pid: 3, fromTid: FREE_AGENT_TID, toTid: 2, fee: 700, season: 2029, window: "summer" },
      ],
    } as Partial<LeagueStore>));
    const buyer = trivia.biggestSpenders.find((s) => s.tid === 2)!;
    expect(buyer.spent).toBe(100);
    expect(buyer.signings).toBe(1);
    // The sentinel must never appear as a club in a spending table.
    expect(trivia.biggestSpenders.some((s) => s.tid === FREE_AGENT_TID)).toBe(false);
    expect(trivia.biggestSellers.find((s) => s.tid === 1)!.net).toBe(100);
  });

  it("finds players who only ever appeared for one club", () => {
    const trivia = computeClubTrivia(makeStore({
      players: [
        makePlayer({ pid: 1, lines: [[2028, 1, 30, 0, 0], [2029, 1, 30, 0, 0]] }),
        makePlayer({ pid: 2, lines: [[2028, 1, 30, 0, 0], [2029, 2, 30, 0, 0]] }),
      ],
    } as Partial<LeagueStore>));
    expect(trivia.oneClubMen.map((m) => m.career.pid)).toEqual([1]);
    expect(trivia.oneClubMen[0].tid).toBe(1);
  });
});
