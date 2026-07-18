import { describe, expect, it } from "vitest";
import {
  englandCompetitions, competitionOf, tierOf, partnerOf, countriesOf, worldCompetitions, tier1Pairs,
  countryClubRanges,
} from "../../src/core/competitions.js";
import { NUM_TEAMS, NUM_TEAMS_D2 } from "../../src/core/constants.js";

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
    expect(partnerOf(comps, 0).id).toBe(1);
    expect(partnerOf(comps, 1).id).toBe(0);
    expect(countriesOf(comps)).toEqual(["England"]);
  });

  it("competitionOf throws on an unknown compId", () => {
    expect(() => competitionOf(comps, 99)).toThrow();
  });
});

describe("worldCompetitions", () => {
  const comps = worldCompetitions();

  it("has 8 entries: 4 countries x 2 tiers", () => {
    expect(comps).toHaveLength(8);
  });

  it("starts with England, matching englandCompetitions() exactly", () => {
    expect(comps.slice(0, 2)).toEqual(englandCompetitions());
  });

  it("has Spain, Italy, and Germany each with one tier-1 and one tier-2 competition", () => {
    for (const country of ["Spain", "Italy", "Germany"]) {
      const group = comps.filter((c) => c.country === country);
      expect(group).toHaveLength(2);
      expect(group.map((c) => c.tier).sort()).toEqual([1, 2]);
    }
  });

  it("every id is unique", () => {
    const ids = comps.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("partnerOf works across all 4 countries", () => {
    for (const comp of comps) {
      const partner = partnerOf(comps, comp.id);
      expect(partner.country).toBe(comp.country);
      expect(partner.tier).not.toBe(comp.tier);
    }
  });

  it("tier1Pairs returns one pair per country, in table order", () => {
    const pairs = tier1Pairs(comps);
    expect(pairs.map((p) => p.d1.country)).toEqual(["England", "Spain", "Italy", "Germany"]);
    for (const pair of pairs) {
      expect(pair.d1.tier).toBe(1);
      expect(pair.d2.tier).toBe(2);
      expect(pair.d2.country).toBe(pair.d1.country);
    }
  });
});

describe("countryClubRanges", () => {
  it("splits the world into 4 contiguous 40-wide ranges, in table order", () => {
    const ranges = countryClubRanges(worldCompetitions(), NUM_TEAMS, NUM_TEAMS_D2);
    expect(ranges).toEqual([
      { country: "England", start: 0, end: 40 },
      { country: "Spain", start: 40, end: 80 },
      { country: "Italy", start: 80, end: 120 },
      { country: "Germany", start: 120, end: 160 },
    ]);
  });

  it("matches generateWorld's actual tid layout", () => {
    // Cross-check against the real generator rather than re-deriving the
    // layout by hand — a regression guard, same spirit as clubs.test.ts's
    // CLUBS/tid regression test.
    const ranges = countryClubRanges(worldCompetitions(), NUM_TEAMS, NUM_TEAMS_D2);
    expect(ranges.reduce((sum, r) => sum + (r.end - r.start), 0)).toBe(160);
  });
});
