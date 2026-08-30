import { describe, it, expect } from "vitest";
import {
  promotionPlayoffFields, semiFinalPairings, playoffWinnersByCompId,
  playoffsForSeason, type PromotionPlayoff,
} from "../../src/core/promotionPlayoff.js";
import { computeCountrySwaps } from "../../src/core/promotion.js";
import { englandCompetitions, buildCompetitions } from "../../src/core/competitions.js";
import type { StandingsRow } from "../../src/core/standings.js";
import type { CupTie } from "../../src/core/cup/types.js";

const COMPS = englandCompetitions();

function row(tid: number, points: number): StandingsRow {
  return { tid, played: 38, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points };
}

/** A descending table of `n` clubs starting at tid `base`. */
function table(base: number, n: number): StandingsRow[] {
  return Array.from({ length: n }, (_, i) => row(base + i, 100 - i));
}

const D1 = table(0, 20);
const D2 = table(100, 20);
const TABLES = new Map([[0, D1], [1, D2]]);

describe("promotionPlayoffFields", () => {
  it("seats the four clubs below the automatic places, best finish first", () => {
    const [field] = promotionPlayoffFields(COMPS, TABLES);
    // England gives 3 promotion places, so 2 go up automatically and the
    // playoff is contested by 3rd through 6th.
    expect(field.autoSpots).toBe(2);
    expect(field.positions).toEqual([3, 4, 5, 6]);
    expect(field.teams).toEqual([102, 103, 104, 105]);
    expect(field.d1CompId).toBe(0);
    expect(field.d2CompId).toBe(1);
  });

  it("holds no playoff where only one club goes up", () => {
    // With a single promotion place there are no automatic places left to sit
    // below, so an English-style bracket could only be positions 1-4 — which
    // takes promotion off the champion rather than deciding a spare place.
    const comps = buildCompetitions([{
      country: "Scotland", d1Teams: 12, d2Teams: 12, promotionSpots: 1,
    }]);
    const tables = new Map([[comps[0].id, table(0, 12)], [comps[1].id, table(100, 12)]]);
    expect(promotionPlayoffFields(comps, tables)).toEqual([]);
  });

  it("holds no playoff where the division cannot seat all four entrants", () => {
    // 3 promotion places means 2 automatic, so the bracket needs positions
    // 3-6 to exist. A 5-club table stops at 5.
    const tables = new Map([[0, table(0, 5)], [1, table(100, 5)]]);
    expect(promotionPlayoffFields(COMPS, tables)).toEqual([]);
  });

  it("holds no playoff for a one-division country", () => {
    const comps = buildCompetitions([{ country: "Wales", divisions: 1, d1Teams: 12 }]);
    expect(promotionPlayoffFields(comps, new Map([[comps[0].id, table(0, 12)]]))).toEqual([]);
  });
});

describe("semiFinalPairings", () => {
  it("draws best against worst and second against third", () => {
    // Indices into the field, which is in finishing order. `home` hosts the
    // first leg, so the better-placed club (the lower index) is `away` and
    // gets the second leg — and with it extra time and any shootout.
    expect(semiFinalPairings(4)).toEqual([
      { home: 3, away: 0 },
      { home: 2, away: 1 },
    ]);
  });
});

/** A finished playoff whose winner came from `position`. */
function playoff(season: number, d2CompId: number, winnerTid: number): PromotionPlayoff {
  const tie = (round: number, home: number, away: number, winner: number): CupTie => ({
    round, matchday: 0, home, away, homeGoals: winner === home ? 1 : 0,
    awayGoals: winner === away ? 1 : 0, wentToExtraTime: false, wentToPens: false,
    homePens: 0, awayPens: 0, winner, boxScore: null,
  });
  return {
    season, country: "England", d1CompId: 0, d2CompId,
    teams: [102, 103, 104, 105], positions: [3, 4, 5, 6], autoSpots: 2,
    ties: [tie(0, 105, 102, winnerTid), tie(0, 104, 103, 103), tie(1, winnerTid, 103, winnerTid)],
    winnerTid,
  };
}

describe("computeCountrySwaps with a playoff", () => {
  it("promotes the automatic places plus the playoff winner, never the club that finished there", () => {
    const swaps = computeCountrySwaps(COMPS, TABLES, new Map([[1, 105]]));
    // 3 up either way — the playoff decides who takes the last place, not how
    // many go up. 104 finished 3rd and does not go up; 105 finished 6th and does.
    expect(swaps[0].promoted).toEqual([100, 101, 105]);
    expect(swaps[0].relegated).toHaveLength(3);
    expect(new Set(swaps[0].promoted).size).toBe(3);
  });

  it("falls back to the plain table slice when no playoff was held", () => {
    // The regression that matters: a headless caller, a world with no eligible
    // country, and every save written before playoffs existed all take this path
    // and must behave exactly as they always did.
    expect(computeCountrySwaps(COMPS, TABLES, new Map()))
      .toEqual(computeCountrySwaps(COMPS, TABLES));
    expect(computeCountrySwaps(COMPS, TABLES)[0].promoted).toEqual([100, 101, 102]);
  });
});

describe("playoffWinnersByCompId", () => {
  it("keys winners by the division they are promoted out of", () => {
    expect(playoffWinnersByCompId([playoff(4, 1, 105)])).toEqual(new Map([[1, 105]]));
  });

  it("skips a playoff with no winner yet, so the swap falls back to the table", () => {
    const pending = { ...playoff(4, 1, 105), winnerTid: null };
    expect(playoffWinnersByCompId([pending]).size).toBe(0);
  });
});

describe("playoffsForSeason", () => {
  it("returns only the season asked for, and tolerates a save that has none", () => {
    const held = [playoff(4, 1, 105), playoff(5, 1, 103)];
    expect(playoffsForSeason(held, 5)).toEqual([held[1]]);
    expect(playoffsForSeason(undefined, 5)).toEqual([]);
  });
});
