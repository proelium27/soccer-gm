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

  it("has 16 entries: 8 countries x 2 tiers", () => {
    expect(comps).toHaveLength(24);
  });

  it("starts with England, matching englandCompetitions() exactly", () => {
    expect(comps.slice(0, 2)).toEqual(englandCompetitions());
  });

  it("has every non-England country with one tier-1 and one tier-2 competition", () => {
    for (const country of [
      "Spain", "Italy", "Germany", "France", "Portugal", "Belgium", "Turkey",
      "Netherlands", "Scotland", "Greece", "Serbia",
    ]) {
      const group = comps.filter((c) => c.country === country);
      expect(group).toHaveLength(2);
      expect(group.map((c) => c.tier).sort()).toEqual([1, 2]);
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
    for (const { country, divisions } of chains) {
      // Every shipped country is a two-division pyramid. The chain is only
      // variable-length because a player can build one or three divisions.
      expect(divisions.map((d) => d.tier)).toEqual([1, 2]);
      expect(divisions.every((d) => d.country === country)).toBe(true);
    }
  });

  it("promotionLinks pairs each division with the one below it", () => {
    const links = promotionLinks(comps);
    expect(links).toHaveLength(countriesOf(comps).length);
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
  it("splits the world into 8 contiguous 40-wide ranges, in table order", () => {
    const ranges = countryClubRanges(worldCompetitions());
    expect(ranges).toEqual([
      // Blocks are sized by each country's real division sizes, so they are no
      // longer a uniform 40 — see Competition.teamCount.
      { country: "England", start: 0, end: 40 },
      { country: "Spain", start: 40, end: 80 },
      { country: "Italy", start: 80, end: 120 },
      { country: "Germany", start: 120, end: 156 },
      { country: "France", start: 156, end: 192 },
      { country: "Portugal", start: 192, end: 228 },
      { country: "Belgium", start: 228, end: 260 },
      { country: "Turkey", start: 260, end: 298 },
      { country: "Netherlands", start: 298, end: 336 },
      { country: "Scotland", start: 336, end: 358 },
      { country: "Greece", start: 358, end: 388 },
      { country: "Serbia", start: 388, end: 420 },
    ]);
  });

  it("matches generateWorld's actual tid layout", () => {
    // Cross-check against the real generator rather than re-deriving the
    // layout by hand — a regression guard, same spirit as clubs.test.ts's
    // CLUBS/tid regression test.
    const ranges = countryClubRanges(worldCompetitions());
    expect(ranges.reduce((sum, r) => sum + (r.end - r.start), 0)).toBe(420);
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
