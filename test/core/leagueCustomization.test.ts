import { describe, expect, it } from "vitest";
import type { Competition } from "../../src/core/competitions.js";
import {
  worldCompetitions, competitionStrengthOffset, competitionAcademyOffset,
  competitionBudgetScale, isWeakLeague, academyBaseCenterOf,
} from "../../src/core/competitions.js";
import {
  COUNTRY_STRENGTH_OFFSET, COUNTRY_BUDGET_SCALE, LEAGUE_BASE, DIVISION_2_OFFSET,
  CONTINENTAL_CUP_FORMAT, SHIELD_FORMAT,
} from "../../src/core/constants.js";
import { cupSlotsForCompetition, cupOffsetForCompetition, cupSlotRange } from "../../src/core/cup/cup.js";
import { generateClubIdentities, abbrevFor } from "../../src/core/teams/clubNames.js";

/**
 * The per-league knobs added so a player can add their own league. The whole
 * design rests on the shipped world reading identically through the new
 * accessors as it did through the old country tables, so that is what most of
 * this file pins.
 */
describe("per-league tuning falls back to the shipped country tables", () => {
  const comps = worldCompetitions();

  it("resolves every shipped competition to its country's table value", () => {
    for (const comp of comps) {
      expect(competitionStrengthOffset(comp)).toBe(COUNTRY_STRENGTH_OFFSET[comp.country] ?? 0);
      expect(competitionBudgetScale(comp)).toBe(COUNTRY_BUDGET_SCALE[comp.country] ?? 1);
    }
  });

  it("classifies the big four as strong and the rest as weak, as before", () => {
    const weak = comps.filter((c) => c.tier === 1 && isWeakLeague(c)).map((c) => c.country);
    expect(weak).toEqual(["France", "Portugal", "Belgium", "Turkey"]);
  });

  it("academy offset defaults to the strength offset — one number doing both jobs", () => {
    for (const comp of comps) {
      expect(competitionAcademyOffset(comp)).toBe(competitionStrengthOffset(comp));
    }
  });

  it("a competition's own values win over its country's", () => {
    const custom: Competition = {
      id: 99, country: "France", tier: 1, name: "Custom",
      strengthOffset: 3, budgetScale: 0.9,
    };
    expect(competitionStrengthOffset(custom)).toBe(3);
    expect(competitionBudgetScale(custom)).toBe(0.9);
    // Academy still tracks the league's OWN strength, not France's table entry.
    expect(competitionAcademyOffset(custom)).toBe(3);
  });

  it("a country absent from every table resolves to neutral defaults", () => {
    const added: Competition = { id: 99, country: "Neverland", tier: 1, name: "Added" };
    expect(competitionStrengthOffset(added)).toBe(0);
    expect(competitionBudgetScale(added)).toBe(1);
    expect(isWeakLeague(added)).toBe(false);
  });
});

describe("academy anchor can be set apart from current strength", () => {
  it("a declining league anchors below its generated strength", () => {
    const declining: Competition = {
      id: 99, country: "Added", tier: 1, name: "Declining",
      strengthOffset: 0, academyOffset: 8,
    };
    expect(competitionAcademyOffset(declining)).toBe(8);
    expect(academyBaseCenterOf(declining)).toBe(LEAGUE_BASE - 8);
  });

  it("a rising league anchors above it", () => {
    const rising: Competition = {
      id: 99, country: "Added", tier: 1, name: "Rising",
      strengthOffset: 10, academyOffset: 2,
    };
    expect(academyBaseCenterOf(rising)).toBe(LEAGUE_BASE - 2);
  });

  it("tier 2 takes the division offset on top, in its own league's band", () => {
    const d2: Competition = {
      id: 99, country: "Added", tier: 2, name: "Added D2", strengthOffset: 6,
    };
    expect(academyBaseCenterOf(d2)).toBe(LEAGUE_BASE - 6 - DIVISION_2_OFFSET);
  });
});

describe("continental slots are per league, and the fields stay disjoint", () => {
  const comps = worldCompetitions();
  const england = comps.find((c) => c.country === "England" && c.tier === 1)!;
  const france = comps.find((c) => c.country === "France" && c.tier === 1)!;

  it("keeps the shipped allocation: strong 1-4 then 5-6, weak 1-2 then 3-4", () => {
    expect(cupSlotRange(england, CONTINENTAL_CUP_FORMAT)).toEqual([1, 4]);
    expect(cupSlotRange(england, SHIELD_FORMAT)).toEqual([5, 6]);
    expect(cupSlotRange(france, CONTINENTAL_CUP_FORMAT)).toEqual([1, 2]);
    expect(cupSlotRange(france, SHIELD_FORMAT)).toEqual([3, 4]);
  });

  it("a league's own slot count moves the Shield's start to match", () => {
    // The bug this guards: the Shield's start used to be a constant copied from
    // the Cup's slot count, so a league with a custom Cup allocation would have
    // put the same club in both competitions (or skipped a place entirely).
    const custom: Competition = {
      id: 99, country: "Added", tier: 1, name: "Added D1",
      continentalSlots: { continental: 1, shield: 3 },
    };
    expect(cupSlotsForCompetition(custom, CONTINENTAL_CUP_FORMAT)).toBe(1);
    expect(cupOffsetForCompetition(custom, CONTINENTAL_CUP_FORMAT)).toBe(0);
    expect(cupOffsetForCompetition(custom, SHIELD_FORMAT)).toBe(1);
    expect(cupSlotRange(custom, CONTINENTAL_CUP_FORMAT)).toEqual([1, 1]);
    expect(cupSlotRange(custom, SHIELD_FORMAT)).toEqual([2, 4]);
  });

  it("a league sending nobody to the Cup starts the Shield at its champion", () => {
    const shieldOnly: Competition = {
      id: 99, country: "Added", tier: 1, name: "Added D1",
      continentalSlots: { continental: 0, shield: 2 },
    };
    expect(cupOffsetForCompetition(shieldOnly, SHIELD_FORMAT)).toBe(0);
    expect(cupSlotRange(shieldOnly, SHIELD_FORMAT)).toEqual([1, 2]);
  });

  it("never lets the two competitions claim the same finishing place", () => {
    const cases: Competition[] = [
      england, france,
      { id: 99, country: "A", tier: 1, name: "A", continentalSlots: { continental: 3, shield: 1 } },
      { id: 98, country: "B", tier: 1, name: "B", continentalSlots: { continental: 0, shield: 4 } },
      { id: 97, country: "C", tier: 1, name: "C", strengthOffset: 9 },
    ];
    for (const comp of cases) {
      const [, cupLast] = cupSlotRange(comp, CONTINENTAL_CUP_FORMAT);
      const [shieldFirst] = cupSlotRange(comp, SHIELD_FORMAT);
      expect(shieldFirst).toBe(cupLast + 1);
    }
  });
});

describe("generated club identities for an added league", () => {
  it("is deterministic for a given country and size", () => {
    expect(generateClubIdentities("Neverland", 40)).toEqual(generateClubIdentities("Neverland", 40));
  });

  it("gives different countries different clubs", () => {
    const a = generateClubIdentities("Neverland", 20).map((c) => c.name);
    const b = generateClubIdentities("Ruritania", 20).map((c) => c.name);
    expect(a).not.toEqual(b);
  });

  it("produces unique names and unique abbrevs across a two-division country", () => {
    const clubs = generateClubIdentities("Neverland", 40);
    expect(new Set(clubs.map((c) => c.name)).size).toBe(40);
    expect(new Set(clubs.map((c) => c.abbrev)).size).toBe(40);
  });

  it("emits three-letter uppercase abbrevs and a two-tone kit", () => {
    for (const club of generateClubIdentities("Neverland", 40)) {
      expect(club.abbrev).toMatch(/^[A-Z0-9]{3}$/);
      expect(club.colors).toHaveLength(2);
      expect(club.name.length).toBeGreaterThan(2);
    }
  });

  it("abbrevFor walks the name on collision rather than falling back to a counter", () => {
    const taken = new Set(["THO"]);
    expect(abbrevFor("Thornbury", taken)).toBe("HOR");
  });
});
