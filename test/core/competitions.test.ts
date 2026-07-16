import { describe, expect, it } from "vitest";
import {
  englandCompetitions, competitionOf, tierOf, partnerOf, countriesOf,
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
