import { describe, it, expect } from "vitest";
import type { CupState, LeaguePhaseMatch } from "../../src/core/cup/types.js";
import { worldCompetitions } from "../../src/core/competitions.js";
import { seasonContinentalNews, continentalNewsScope } from "../../src/core/continentalNews.js";
import { COEFFICIENT_MIN_SEASONS } from "../../src/core/constants.js";

const comps = worldCompetitions();
const tier1 = comps.filter((c) => c.tier === 1);
/** One club per tier-1 league, tid = league index. */
const teams = tier1.map((c, i) => ({ tid: i, compId: c.id }));

function lpMatch(home: number, away: number, hg: number, ag: number): LeaguePhaseMatch {
  return { round: 0, matchday: 3, home, away, played: true, homeGoals: hg, awayGoals: ag, boxScore: null };
}

function cup(season: number, entrants: number[], matches: LeaguePhaseMatch[]): CupState {
  return {
    competition: "continental", season, name: "Continental Cup",
    teams: [], seeds: {}, leaguePhase: { teams: entrants, matches },
    playoff: null, playIn: null, ties: [], championTid: null,
    twoLegged: true, koLegs: null, statLines: null,
  };
}

/**
 * A history in which the world's weakest league (index 7) beats the strongest
 * (index 0) every season, sustained long enough to clear the reallocation
 * floor. `season` is the first season whose *following* allocation differs.
 */
function upsetHistory(seasons: number): CupState[] {
  const entrants = tier1.map((_, i) => i);
  return Array.from({ length: seasons }, (_, i) =>
    cup(1 + i, entrants, [lpMatch(7, 0, 3, 0), lpMatch(7, 1, 3, 0), lpMatch(7, 2, 3, 0)]));
}

describe("continental news", () => {
  it("reports nothing while every country's allocation is unchanged", () => {
    const news = seasonContinentalNews(comps, teams, [[]], 5, true);
    expect(news).toEqual([]);
  });

  it("reports nothing before the reallocation floor has been cleared", () => {
    // One season of results is not enough to move a place, so there is no
    // change to report either.
    const news = seasonContinentalNews(comps, teams, [upsetHistory(1)], 1, true);
    expect(news).toEqual([]);
  });

  it("reports the country that gained and the country that lost", () => {
    const history = upsetHistory(COEFFICIENT_MIN_SEASONS);
    // The season whose result tips the allocation over: before it, the window
    // is one short of the floor.
    const season = COEFFICIENT_MIN_SEASONS;
    const news = seasonContinentalNews(comps, teams, [history], season, true);
    expect(news.length).toBeGreaterThan(0);

    const gained = news.filter((n) => n.to > n.from);
    const lost = news.filter((n) => n.to < n.from);
    expect(gained.length).toBeGreaterThan(0);
    expect(lost.length).toBeGreaterThan(0);
    // Zero-sum: every place someone gained, someone else lost.
    const net = news.reduce((a, n) => a + (n.to - n.from), 0);
    expect(net).toBe(0);
    // The league that won everything is among the gainers.
    expect(gained.some((n) => n.country === tier1[7].country)).toBe(true);
  });

  it("reports nothing when the save fixed its allocation at creation", () => {
    // Same history that produces movers above, so an empty list here is the
    // save's setting rather than a quiet season.
    const news = seasonContinentalNews(
      comps, teams, [upsetHistory(COEFFICIENT_MIN_SEASONS)], COEFFICIENT_MIN_SEASONS, false,
    );
    expect(news).toEqual([]);
  });

  it("names the country's top-flight competition, so the feed can file it", () => {
    const news = seasonContinentalNews(
      comps, teams, [upsetHistory(COEFFICIENT_MIN_SEASONS)], COEFFICIENT_MIN_SEASONS, true,
    );
    for (const n of news) {
      const comp = comps.find((c) => c.id === n.compId)!;
      expect(comp.tier).toBe(1);
      expect(comp.country).toBe(n.country);
    }
  });

  it("is always world news, because it is rare and it reshapes the competition", () => {
    expect(continentalNewsScope({ country: "England", compId: 0, from: 4, to: 3 })).toBe("world");
  });
});
