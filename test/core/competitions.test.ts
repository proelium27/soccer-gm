import { describe, expect, it } from "vitest";
import {
  englandCompetitions, competitionOf, tierOf, divisionAbove, divisionBelow, countriesOf,
  worldCompetitions, countryDivisions, promotionLinks,
  countryClubRanges, competitionPromotionSpots, buildCompetitions, worldTuningWarnings,
  worldLeagueSpecs, type Competition,
} from "../../src/core/competitions.js";
import { PROMOTION_RELEGATION_COUNT } from "../../src/core/constants.js";

describe("competitions", () => {
  const comps = englandCompetitions();

  it("england table has ids 0/1 matching the legacy division values", () => {
    expect(comps).toEqual([
      { id: 0, country: "England", tier: 1, name: "English Division 1" },
      { id: 1, country: "England", tier: 2, name: "English Division 2" },
    ]);
  });

  it("helpers look up by compId", () => {
    expect(competitionOf(comps, 1).name).toBe("English Division 2");
    expect(tierOf(comps, 0)).toBe(1);
    expect(tierOf(comps, 1)).toBe(2);
    expect(divisionBelow(comps, 0)?.id).toBe(1);
    expect(divisionAbove(comps, 1)?.id).toBe(0);
    // The ends of the chain have no neighbour that way.
    expect(divisionAbove(comps, 0)).toBeNull();
    expect(divisionBelow(comps, 1)).toBeNull();
    expect(countriesOf(comps)).toEqual(["England"]);
  });

  it("competitionOf throws on an unknown compId", () => {
    expect(() => competitionOf(comps, 99)).toThrow();
  });
});

describe("worldCompetitions", () => {
  const comps = worldCompetitions();

  it("has 28 entries: 12 countries, the big four three deep and the rest two", () => {
    expect(comps).toHaveLength(28);
  });

  it("starts with England, matching englandCompetitions() exactly", () => {
    expect(comps.slice(0, 2)).toEqual(englandCompetitions());
  });

  it("runs the big four three divisions deep and everyone else two", () => {
    const deep = ["England", "Spain", "Italy", "Germany"];
    for (const country of [
      "England", "Spain", "Italy", "Germany", "France", "Portugal", "Belgium",
      "Turkey", "Netherlands", "Scotland", "Greece", "Serbia",
    ]) {
      const group = comps.filter((c) => c.country === country);
      const tiers = deep.includes(country) ? [1, 2, 3] : [1, 2];
      expect(group.map((c) => c.tier).sort()).toEqual(tiers);
    }
  });

  it("keeps each country's divisions contiguous and in tier order in the table", () => {
    // CompetitionSelect groups by country and filters the table in array order,
    // so a division listed out of place would show out of order in every
    // competition dropdown in the game.
    for (const country of countriesOf(comps)) {
      const group = comps.filter((c) => c.country === country);
      expect(group.map((c) => c.tier)).toEqual([...group.map((c) => c.tier)].sort());
      const ids = group.map((c) => c.id);
      expect(ids).toEqual(Array.from({ length: ids.length }, (_, i) => ids[0] + i));
    }
  });

  it("every id is unique", () => {
    const ids = comps.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("neighbours stay inside the country and are adjacent by tier", () => {
    for (const comp of comps) {
      for (const neighbour of [divisionAbove(comps, comp.id), divisionBelow(comps, comp.id)]) {
        if (!neighbour) continue;
        expect(neighbour.country).toBe(comp.country);
        expect(Math.abs(neighbour.tier - comp.tier)).toBe(1);
      }
    }
  });

  it("countryDivisions returns each country's chain, top flight first, in table order", () => {
    const chains = countryDivisions(comps);
    expect(chains.map((c) => c.country)).toEqual([
      "England", "Spain", "Italy", "Germany", "France", "Portugal", "Belgium", "Turkey",
      "Netherlands", "Scotland", "Greece", "Serbia",
    ]);
    const deep = ["England", "Spain", "Italy", "Germany"];
    for (const { country, divisions } of chains) {
      expect(divisions.map((d) => d.tier)).toEqual(deep.includes(country) ? [1, 2, 3] : [1, 2]);
      expect(divisions.every((d) => d.country === country)).toBe(true);
    }
  });

  it("promotionLinks pairs each division with the one below it", () => {
    const links = promotionLinks(comps);
    // One link per adjacent pair, so a three-division country contributes two:
    // 12 countries, four of them three deep.
    expect(links).toHaveLength(12 + 4);
    for (const { upper, lower } of links) {
      expect(upper.country).toBe(lower.country);
      expect(lower.tier).toBe(upper.tier + 1);
    }
  });

  it("a one-division country has no promotion link and no neighbours", () => {
    const solo = buildCompetitions([{ country: "Solitaria", divisions: 1 }]);
    expect(promotionLinks(solo)).toEqual([]);
    expect(divisionAbove(solo, solo[0].id)).toBeNull();
    expect(divisionBelow(solo, solo[0].id)).toBeNull();
  });

  it("a three-division country chains top-down and links each adjacent pair", () => {
    const deep = buildCompetitions([{ country: "Deepland", divisions: 3 }]);
    expect(deep.map((c) => c.tier)).toEqual([1, 2, 3]);
    expect(divisionsOfTiers(deep, "Deepland")).toEqual([1, 2, 3]);

    // The old partnerOrNull answered "the other competition in this country",
    // which has no answer here — it returned whichever came first in the table.
    // Adjacency is what the middle division needs, in both directions.
    expect(divisionAbove(deep, deep[1].id)?.tier).toBe(1);
    expect(divisionBelow(deep, deep[1].id)?.tier).toBe(3);
    expect(divisionAbove(deep, deep[0].id)).toBeNull();
    expect(divisionBelow(deep, deep[2].id)).toBeNull();

    expect(promotionLinks(deep).map((l) => [l.upper.tier, l.lower.tier])).toEqual([[1, 2], [2, 3]]);
  });
});

function divisionsOfTiers(comps: Competition[], country: string): number[] {
  return countryDivisions(comps).find((c) => c.country === country)!.divisions.map((d) => d.tier);
}

describe("countryClubRanges", () => {
  it("splits the world into 12 contiguous ranges, in table order", () => {
    const ranges = countryClubRanges(worldCompetitions());
    expect(ranges).toEqual([
      // Blocks are sized by each country's real division sizes and by how deep
      // its pyramid runs, so they are neither uniform nor a multiple of 40 —
      // see Competition.teamCount and LeagueSpec.divisions. The big four carry
      // a 20-club third division on top of their two.
      { country: "England", start: 0, end: 60 },
      { country: "Spain", start: 60, end: 120 },
      { country: "Italy", start: 120, end: 180 },
      { country: "Germany", start: 180, end: 236 },
      { country: "France", start: 236, end: 272 },
      { country: "Portugal", start: 272, end: 308 },
      { country: "Belgium", start: 308, end: 340 },
      { country: "Turkey", start: 340, end: 378 },
      { country: "Netherlands", start: 378, end: 416 },
      { country: "Scotland", start: 416, end: 438 },
      { country: "Greece", start: 438, end: 468 },
      { country: "Serbia", start: 468, end: 500 },
    ]);
  });

  it("matches generateWorld's actual tid layout", () => {
    // Cross-check against the real generator rather than re-deriving the
    // layout by hand — a regression guard, same spirit as clubs.test.ts's
    // CLUBS/tid regression test.
    const ranges = countryClubRanges(worldCompetitions());
    expect(ranges.reduce((sum, r) => sum + (r.end - r.start), 0)).toBe(500);
  });
});

describe("competitionPromotionSpots", () => {
  const d1: Competition = { id: 0, country: "Wakanda", tier: 1, name: "D1" };
  const d2: Competition = { id: 1, country: "Wakanda", tier: 2, name: "D2" };

  it("falls back to the shipped count when a league sets nothing", () => {
    expect(competitionPromotionSpots(d1, d2)).toBe(PROMOTION_RELEGATION_COUNT);
  });

  it("takes the league's own count, zero included", () => {
    expect(competitionPromotionSpots({ ...d1, promotionSpots: 5 }, d2)).toBe(5);
    expect(competitionPromotionSpots({ ...d1, promotionSpots: 0 }, d2)).toBe(0);
  });

  it("holds the count inside the smaller division, and rejects nonsense", () => {
    const small = { ...d2, teamCount: 8 };
    expect(competitionPromotionSpots({ ...d1, promotionSpots: 12 }, small)).toBe(8);
    expect(competitionPromotionSpots({ ...d1, promotionSpots: -3 }, d2)).toBe(0);
    expect(competitionPromotionSpots({ ...d1, promotionSpots: NaN }, d2)).toBe(0);
  });

  it("is zero for a one-division country, which has nothing to swap with", () => {
    expect(competitionPromotionSpots(d1, null)).toBe(0);
  });
});

describe("buildCompetitions carries promotionSpots", () => {
  it("writes an added league's count onto both of its divisions", () => {
    const comps = buildCompetitions([{ country: "Wakanda", promotionSpots: 1 }]);
    expect(comps.map((c) => c.promotionSpots)).toEqual([1, 1]);
  });

  it("leaves it absent when the league didn't set one, so the default applies", () => {
    const comps = buildCompetitions([{ country: "Wakanda" }]);
    expect(comps.every((c) => c.promotionSpots === undefined)).toBe(true);
    expect(competitionPromotionSpots(comps[0], comps[1])).toBe(PROMOTION_RELEGATION_COUNT);
  });
});

describe("league names are the player's to set", () => {
  it("uses the names given, so a league can be called what it's really called", () => {
    const comps = buildCompetitions([
      { country: "Netherlands", d1Name: "Eredivisie", d2Name: "Eerste Divisie" },
    ]);
    expect(comps.map((c) => c.name)).toEqual(["Eredivisie", "Eerste Divisie"]);
    // Naming a division doesn't change its country, which still groups the two
    // divisions, flags them and picks their nationalities.
    expect(comps.every((c) => c.country === "Netherlands")).toBe(true);
  });

  it("falls back to the country when a name is absent or blank", () => {
    // The name box is free text a player can empty, and a blank league name
    // reads as a broken game rather than as a choice.
    const comps = buildCompetitions([{ country: "Wakanda", d1Name: "   " }]);
    expect(comps.map((c) => c.name)).toEqual(["Wakanda Division 1", "Wakanda Division 2"]);
  });

  it("warns when two divisions end up sharing a name", () => {
    // A roster file finds its competition BY NAME, so a duplicate means a file
    // aimed at that name can only fill one of them.
    const warnings = worldTuningWarnings([
      { country: "Netherlands", d1Name: "Top Flight" },
      { country: "Belgium", d1Name: "Top Flight" },
    ]);
    expect(warnings.some((w) => w.includes("Top Flight"))).toBe(true);
  });

  it("says nothing about names when they're all distinct", () => {
    const warnings = worldTuningWarnings(worldLeagueSpecs());
    expect(warnings.some((w) => w.includes("Two divisions"))).toBe(false);
  });
});
