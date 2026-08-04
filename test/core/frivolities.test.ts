import { describe, expect, it } from "vitest";
import { computeRecordBook } from "../../src/core/frivolities/records.js";
import { computePlayerBios } from "../../src/core/frivolities/bios.js";
import { computeClubTrivia } from "../../src/core/frivolities/clubs.js";
import { allCareers } from "../../src/core/frivolities/careers.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import type { ArchivedPlayer } from "../../src/core/players/archive.js";
import { emptyTotals, emptyBestSeasons } from "../../src/core/frivolities/stats.js";
import { allTimeLeaders } from "../../src/core/frivolities/leaders.js";
import {
  computeHonours, playerGoatRanking, teamGoatRanking,
} from "../../src/core/frivolities/goat.js";
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
      // Real SeasonStats carries avgRating alongside ratingSum (see its type),
      // so the fixture must too, or the single-season rating board sees nothing.
      ratingSum: appearances * 7, avgRating: 7, minutesPlayed: appearances * 90,
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
    totals: { ...emptyTotals(), appearances: 500, goals: 300, assists: 100, minutesPlayed: 45000, avgRating: 7.5 },
    best: { ...emptyBestSeasons(), goals: { value: 35, season: 2018, appearances: 38 } },
    caps: 100, intlGoals: 50, intlTitles: 0,
    seasons: [{ season: 2018, tid: 1, ovr: 80 }],
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

  it("carries each transfer's player nationality, so the row can render a flag", () => {
    // Without this the biggest-fees table was the one player list on the page
    // with no flags, because TransferRecord didn't carry a nationality at all.
    const store = makeStore({
      players: [makePlayer({ pid: 1, nationality: "Brazil", lines: [[2029, 1, 5, 0, 0]] })],
      transfers: [
        { pid: 1, fromTid: 1, toTid: 2, fee: 50, season: 2029, window: "summer" },
        // A player the save no longer knows: still a real transfer, but there
        // is no nationality to show, so it must be empty rather than invented.
        { pid: 404, fromTid: 1, toTid: 2, fee: 90, season: 2029, window: "summer" },
      ],
    } as Partial<LeagueStore>);
    const fees = computeRecordBook(store).biggestTransfers;
    expect(fees.find((f) => f.pid === 1)!.nationality).toBe("Brazil");
    expect(fees.find((f) => f.pid === 404)!.nationality).toBe("");
    expect(fees.find((f) => f.pid === 404)!.name).toBe("Player 404");
  });

  it("puts retirees on the all-time lists alongside active players", () => {
    const store = makeStore({
      players: [makePlayer({ pid: 1, lines: [[2029, 1, 30, 20, 5]], hist: [[2029, 75]] })],
      retiredPlayers: [makeArchived({ pid: 99, peakOvr: 88 })],
    });
    const book = computeRecordBook(store);
    expect(book.careerGoals[0].pid).toBe(99);
    expect(book.peakRatings[0].pid).toBe(99);
    expect(book.seasonGoals[0].pid).toBe(99);
    expect(book.hasArchive).toBe(true);
  });
});

describe("allTimeLeaders", () => {
  const store = makeStore({
    players: [
      makePlayer({ pid: 1, lines: [[2028, 1, 30, 20, 4], [2029, 1, 30, 12, 6]] }),
      makePlayer({ pid: 2, lines: [[2029, 2, 30, 25, 1]] }),
    ],
    // Career 300 goals, best season 35 — ahead of both living players on each.
    retiredPlayers: [makeArchived({ pid: 99 })],
  });

  it("ranks career totals across the living and the retired together", () => {
    const rows = allTimeLeaders(store, "goals", "career");
    expect(rows.map((r) => r.career.pid)).toEqual([99, 1, 2]);
    expect(rows[0].value).toBe(300);
    expect(rows[1].value).toBe(32); // 20 + 12
    expect(rows[0].season).toBeNull();
  });

  it("ranks one row per player in single-season scope — his own best", () => {
    // A player with two recorded seasons must not occupy two places: a retiree
    // only keeps his best, so listing every season for the living would make
    // the board mean different things for different players.
    const rows = allTimeLeaders(store, "goals", "single");
    expect(rows.map((r) => r.career.pid)).toEqual([99, 2, 1]);
    expect(rows.find((r) => r.career.pid === 1)!.value).toBe(20);
    expect(rows.find((r) => r.career.pid === 1)!.season).toBe(2028);
    expect(rows.filter((r) => r.career.pid === 1)).toHaveLength(1);
  });

  it("drops players with nothing recorded in the chosen stat", () => {
    // Nobody in this fixture has a save, so the board is empty rather than a
    // list of zeroes.
    expect(allTimeLeaders(store, "saves", "career")).toEqual([]);
  });

  it("applies an appearance floor to match rating but not to counting stats", () => {
    const cameo = makeStore({
      players: [
        // One brilliant game: must not top a rating board, but must still count
        // for goals.
        makePlayer({ pid: 1, lines: [[2029, 1, 1, 2, 0]] }),
        makePlayer({ pid: 2, lines: [[2029, 2, 38, 5, 0]] }),
      ],
    });
    expect(allTimeLeaders(cameo, "avgRating", "career").map((r) => r.career.pid)).toEqual([2]);
    expect(allTimeLeaders(cameo, "avgRating", "single").map((r) => r.career.pid)).toEqual([2]);
    expect(allTimeLeaders(cameo, "goals", "career").map((r) => r.career.pid)).toEqual([2, 1]);
  });

  it("honours the row limit", () => {
    expect(allTimeLeaders(store, "goals", "career", 1)).toHaveLength(1);
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

describe("GOAT rankings", () => {
  /** A season-history entry that also carries awards and a champion. */
  function historyWithAwards(
    season: number,
    table: StandingsRow[],
    compsByTid: Record<number, number>,
    extra: {
      champion?: number;
      ballonDOr?: number;
      worldXI?: (number | null)[];
      poty?: number;
      goldenBoot?: number;
      tots?: (number | null)[];
    } = {},
  ): SeasonHistoryEntry {
    return {
      season, table, compsByTid, teamStats: [],
      awards: {
        0: {
          playerOfSeasonPid: extra.poty ?? null,
          goldenBootPid: extra.goldenBoot ?? null,
          teamOfSeason: extra.tots ?? [],
        },
      },
      world: {
        ballonDOr: extra.ballonDOr == null ? [] : [{ pid: extra.ballonDOr }],
        worldTeamOfYear: extra.worldXI ?? [],
      },
      championTidByCompId: extra.champion == null ? {} : { 0: extra.champion },
    } as unknown as SeasonHistoryEntry;
  }

  describe("computeHonours", () => {
    it("credits awards and titles to retired players, not just the living", () => {
      // The whole reason honours are derived from seasonHistory instead of
      // snapshotted: a retiree must keep every trophy he ever won.
      const store = makeStore({
        players: [],
        retiredPlayers: [makeArchived({
          pid: 99,
          seasons: [{ season: 2028, tid: 1, ovr: 90 }, { season: 2029, tid: 1, ovr: 88 }],
          intlTitles: 1,
        })],
        cupHistory: [{ season: 2029, championTid: 1 }],
        seasonHistory: [
          historyWithAwards(2028, [row(1, 38, 90)], { 1: 0 },
            { champion: 1, ballonDOr: 99, poty: 99, tots: [99] }),
          historyWithAwards(2029, [row(1, 38, 88)], { 1: 0 },
            { champion: 1, worldXI: [99], goldenBoot: 99 }),
        ],
      } as unknown as Partial<LeagueStore>);

      const h = computeHonours(store, allCareers(store)).get(99)!;
      expect(h.ballonDOr).toBe(1);
      expect(h.playerOfSeason).toBe(1);
      expect(h.teamOfSeason).toBe(1);
      expect(h.worldXI).toBe(1);
      expect(h.goldenBoot).toBe(1);
      expect(h.leagueTitles).toBe(2);
      expect(h.cupTitles).toBe(1);
      expect(h.worldCups).toBe(1);
    });

    it("only credits a title to players who were at the club that season", () => {
      // He joined the champions the season *after* they won it.
      const store = makeStore({
        players: [makePlayer({ pid: 1, lines: [[2029, 1, 30, 5, 0]] })],
        seasonHistory: [
          historyWithAwards(2028, [row(1, 38, 90)], { 1: 0 }, { champion: 1 }),
          historyWithAwards(2029, [row(1, 38, 60), row(2, 38, 90)], { 1: 0, 2: 0 }, { champion: 2 }),
        ],
      } as unknown as Partial<LeagueStore>);
      expect(computeHonours(store, allCareers(store)).get(1)!.leagueTitles).toBe(0);
    });
  });

  describe("playerGoatRanking", () => {
    it("ranks a decorated career above an equally rated one with no honours", () => {
      const store = makeStore({
        players: [
          makePlayer({ pid: 1, lines: [[2029, 1, 38, 20, 5]], hist: [[2028, 90]] }),
          makePlayer({ pid: 2, lines: [[2029, 2, 38, 20, 5]], hist: [[2028, 90]] }),
        ],
        seasonHistory: [
          historyWithAwards(2029, [row(1, 38, 90), row(2, 38, 80)], { 1: 0, 2: 0 },
            { champion: 1, ballonDOr: 1, poty: 1 }),
        ],
      } as unknown as Partial<LeagueStore>);

      const rank = playerGoatRanking(store);
      expect(rank[0].career.pid).toBe(1);
      expect(rank[0].awards).toBeGreaterThan(0);
      expect(rank[1].awards).toBe(0);
      // The parts must actually add up to the headline number.
      const r = rank[0];
      expect(r.score).toBeCloseTo(
        r.peak + r.prime + r.longevity + r.awards + r.trophies + r.production, 6,
      );
    });

    it("returns exactly the parts the score is made of, with nothing left over", () => {
      // The UI shows these six as columns and the score beside them, so any
      // component missing from this list is a breakdown a reader can't
      // reconcile with the total. That shipped once already.
      const store = makeStore({
        players: [makePlayer({
          pid: 1, lines: [[2029, 1, 38, 20, 5]], hist: [[2028, 90]],
        })],
        seasonHistory: [
          historyWithAwards(2029, [row(1, 38, 90)], { 1: 0 },
            { champion: 1, ballonDOr: 1, poty: 1, goldenBoot: 1, tots: [1], worldXI: [1] }),
        ],
      } as unknown as Partial<LeagueStore>);

      const r = playerGoatRanking(store)[0];
      const parts = [r.peak, r.prime, r.longevity, r.awards, r.trophies, r.production];
      // Exact, not close: every part is a whole number and the score is their
      // sum, so the table can never show a breakdown that doesn't reconcile.
      expect(parts.reduce((a, b) => a + b, 0)).toBe(r.score);
      for (const part of parts) expect(Number.isInteger(part)).toBe(true);
      // And every part must actually be carrying something here, or the test
      // would pass just as well with a component silently stuck at zero.
      for (const part of parts) expect(part).toBeGreaterThan(0);
    });

    it("rewards a long prime over a single brilliant season", () => {
      // Same peak, very different careers — the distinction the formula exists
      // to make.
      const oneYear = makePlayer({
        pid: 1, lines: [[2029, 1, 38, 20, 5]], hist: [[2028, 90]],
      });
      const longCareer = makePlayer({
        pid: 2,
        lines: Array.from({ length: 10 }, (_, i) => [2020 + i, 2, 38, 20, 5] as [number, number, number, number, number]),
        hist: Array.from({ length: 10 }, (_, i) => [2019 + i, 88] as [number, number]),
      });
      const store = makeStore({ players: [oneYear, longCareer] });
      const rank = playerGoatRanking(store);
      expect(rank[0].career.pid).toBe(2);
      expect(rank[0].prime).toBeGreaterThan(rank[1].prime);
    });

    it("gives no peak or prime credit below the baseline", () => {
      // A journeyman shouldn't accumulate a GOAT case just by existing.
      const store = makeStore({
        players: [makePlayer({ pid: 1, lines: [[2029, 1, 38, 0, 0]], hist: [[2028, 55]] })],
      });
      const r = playerGoatRanking(store)[0];
      expect(r.peak).toBe(0);
      expect(r.prime).toBe(0);
    });
  });

  describe("teamGoatRanking", () => {
    const store = makeStore({
      seasonHistory: [
        historyWithAwards(2028, [row(1, 38, 90, 40), row(2, 38, 70, 10), row(3, 20, 55)],
          { 1: 0, 2: 0, 3: 1 }, { champion: 1 }),
        historyWithAwards(2029, [row(1, 38, 88, 35), row(2, 38, 60, 5), row(3, 20, 50)],
          { 1: 0, 2: 0, 3: 1 }, { champion: 1 }),
      ],
      cupHistory: [{ season: 2029, championTid: 1 }],
    } as unknown as Partial<LeagueStore>);

    it("puts the serial winner top and shows its cabinet", () => {
      const rank = teamGoatRanking(store);
      expect(rank[0].tid).toBe(1);
      expect(rank[0].leagueTitles).toBe(2);
      expect(rank[0].cupTitles).toBe(1);
      expect(rank[0].score).toBeCloseTo(rank[0].trophies + rank[0].consistency, 6);
    });

    it("counts a second-tier title separately from a top-flight one", () => {
      const club3 = teamGoatRanking(store).find((r) => r.tid === 3)!;
      expect(club3.leagueTitles).toBe(0);
      expect(club3.secondTierTitles).toBe(2);
      expect(club3.topFlightSeasons).toBe(0);
      // And it must not outrank the club that won the actual league twice.
      expect(club3.score).toBeLessThan(teamGoatRanking(store)[0].score);
    });

    it("computes career points per game across seasons, not a mean of means", () => {
      // 178 points from 76 matches.
      expect(teamGoatRanking(store).find((r) => r.tid === 1)!.ppg).toBeCloseTo(178 / 76, 6);
    });
  });
});
