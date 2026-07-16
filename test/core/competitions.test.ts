import { describe, expect, it } from "vitest";
import {
  englandCompetitions, competitionOf, tierOf, partnerOf, countriesOf, worldCompetitions,
} from "../../src/core/competitions.js";

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

  it("has 6 entries: 3 countries x 2 tiers", () => {
    expect(comps).toHaveLength(6);
  });

  it("starts with England, matching englandCompetitions() exactly", () => {
    expect(comps.slice(0, 2)).toEqual(englandCompetitions());
  });

  it("has Spain and Italy each with one tier-1 and one tier-2 competition", () => {
    for (const country of ["Spain", "Italy"]) {
      const group = comps.filter((c) => c.country === country);
      expect(group).toHaveLength(2);
      expect(group.map((c) => c.tier).sort()).toEqual([1, 2]);
    }
  });

  it("every id is unique", () => {
    const ids = comps.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("partnerOf works across all 3 countries", () => {
    for (const comp of comps) {
      const partner = partnerOf(comps, comp.id);
      expect(partner.country).toBe(comp.country);
      expect(partner.tier).not.toBe(comp.tier);
    }
  });
});
