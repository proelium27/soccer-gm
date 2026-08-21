import { describe, expect, it } from "vitest";
import type { Competition } from "../../src/core/competitions.js";
import {
  worldCompetitions, competitionStrengthOffset, competitionAcademyOffset,
  competitionBudgetScale, isWeakLeague, academyBaseCenterOf,
  buildCompetitions, worldLeagueSpecs, tier1Pairs, countryClubRanges,
  worldTuningWarnings, suggestedBudgetScale,
} from "../../src/core/competitions.js";
import {
  COUNTRY_STRENGTH_OFFSET, COUNTRY_BUDGET_SCALE, LEAGUE_BASE, DIVISION_2_OFFSET,
  CONTINENTAL_CUP_FORMAT, SHIELD_FORMAT, NUM_TEAMS, NUM_TEAMS_D2,
  isValidCupFieldSize, largestValidCupField,
} from "../../src/core/constants.js";
import { CLUBS, shippedClubsFor } from "../../src/core/teams/clubs.js";
import {
  cupSlotsForCompetition, cupOffsetForCompetition, cupSlotRange, cupPlan,
} from "../../src/core/cup/cup.js";
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

describe("building a world's competitions table", () => {
  it("rebuilds the shipped world exactly from its own specs", () => {
    // The guard that keeps "start from the shipped world and change nothing"
    // from quietly producing a different world: every knob must stay ABSENT,
    // not be written out as its current table value.
    expect(buildCompetitions(worldLeagueSpecs())).toEqual(worldCompetitions());
  });

  it("hands out ids sequentially in table order, D1 then D2 per country", () => {
    const table = buildCompetitions([{ country: "Neverland" }, { country: "Ruritania" }]);
    expect(table.map((c) => [c.id, c.country, c.tier])).toEqual([
      [0, "Neverland", 1], [1, "Neverland", 2],
      [2, "Ruritania", 1], [3, "Ruritania", 2],
    ]);
    expect(table[0].name).toBe("Neverland Division 1");
  });

  it("carries a spec's knobs onto both of its divisions", () => {
    const [d1, d2] = buildCompetitions([{
      country: "Neverland", strengthOffset: 7, academyOffset: 2,
      budgetScale: 0.6, cupSlots: 1, shieldSlots: 3,
    }]);
    for (const comp of [d1, d2]) {
      expect(comp.strengthOffset).toBe(7);
      expect(comp.academyOffset).toBe(2);
      expect(comp.budgetScale).toBe(0.6);
      expect(comp.continentalSlots).toEqual({ continental: 1, shield: 3 });
    }
  });

  it("leaves an untouched knob absent rather than writing a default", () => {
    const [d1] = buildCompetitions([{ country: "Neverland", budgetScale: 0.6 }]);
    expect(d1.budgetScale).toBe(0.6);
    expect("strengthOffset" in d1).toBe(false);
    expect("continentalSlots" in d1).toBe(false);
  });

  it("a table with a country left out still pairs every remaining country", () => {
    const table = buildCompetitions(worldLeagueSpecs().filter((s) => s.country !== "England"));
    const pairs = tier1Pairs(table);
    expect(pairs).toHaveLength(7);
    for (const { d1, d2 } of pairs) expect(d1.country).toBe(d2.country);
  });
});

describe("continental field size is trimmed to something the draw can build", () => {
  it("accepts the shipped field sizes", () => {
    expect(isValidCupFieldSize(24)).toBe(true);
    expect(isValidCupFieldSize(16)).toBe(true);
  });

  it("rejects sizes the league-phase draw cannot pair", () => {
    expect(isValidCupFieldSize(23)).toBe(false); // odd
    expect(isValidCupFieldSize(22)).toBe(false); // pots of 11 — an odd pot can't be matched
    expect(isValidCupFieldSize(8)).toBe(false); // too few to seed the QF + playoff split
  });

  it("trims down to the nearest buildable size", () => {
    expect(largestValidCupField(24)).toBe(24);
    expect(largestValidCupField(23)).toBe(20);
    expect(largestValidCupField(22)).toBe(20);
    expect(largestValidCupField(11)).toBe(0);
  });

  it("leaves the shipped world's fields exactly as they were", () => {
    const comps = worldCompetitions();
    expect(cupPlan(comps, CONTINENTAL_CUP_FORMAT)!.total).toBe(24);
    expect(cupPlan(comps, SHIELD_FORMAT)!.total).toBe(16);
  });

  it("gives an awkward world a smaller field instead of no competition", () => {
    // 8 leagues x 3 = 24 for the Cup, but the Shield's 8 x 1 = 8 is unbuildable.
    const comps = buildCompetitions(
      worldLeagueSpecs().map((s) => ({ ...s, cupSlots: 3, shieldSlots: 1 })),
    );
    expect(cupPlan(comps, CONTINENTAL_CUP_FORMAT)!.total).toBe(24);
    expect(cupPlan(comps, SHIELD_FORMAT)).toBeNull();
  });

  it("trims a field that would otherwise crash the draw", () => {
    const comps = buildCompetitions([
      ...worldLeagueSpecs(),
      { country: "Extra", cupSlots: 3, shieldSlots: 0 },
    ]);
    // 24 + 3 = 27 qualifiers, trimmed to 24.
    expect(cupPlan(comps, CONTINENTAL_CUP_FORMAT)!.total).toBe(24);
  });
});

describe("world tuning warnings", () => {
  it("says nothing about the shipped world", () => {
    expect(worldTuningWarnings(worldLeagueSpecs())).toEqual([]);
  });

  it("flags a weaker-but-richer league, the inversion that breaks a ladder", () => {
    const specs = [
      ...worldLeagueSpecs(),
      { country: "Rich And Weak", strengthOffset: 15, budgetScale: 1 },
    ];
    const warnings = worldTuningWarnings(specs);
    expect(warnings.some((w) => w.includes("Rich And Weak") && w.includes("richer"))).toBe(true);
  });

  it("passes a weaker-and-poorer league", () => {
    const specs = [
      ...worldLeagueSpecs(),
      { country: "Weak And Poor", strengthOffset: 15, budgetScale: 0.3 },
    ];
    expect(worldTuningWarnings(specs)).toEqual([]);
  });

  it("flags a world too small to field the Continental Cup", () => {
    const specs = worldLeagueSpecs().slice(0, 2);
    expect(worldTuningWarnings(specs).some((w) => w.includes("Continental Cup"))).toBe(true);
  });

  it("counts custom slot allocations toward the cup field, not the country count", () => {
    // Two countries, but each sending six — enough to seed the field.
    const specs = worldLeagueSpecs().slice(0, 2).map((s) => ({ ...s, cupSlots: 6 }));
    expect(worldTuningWarnings(specs).some((w) => w.includes("Continental Cup"))).toBe(false);
  });

  it("flags duplicate country names and an empty world", () => {
    expect(worldTuningWarnings([{ country: "A" }, { country: "a" }]).some((w) => w.includes("different countries"))).toBe(true);
    expect(worldTuningWarnings([])).toEqual(["A world needs at least one league."]);
  });

  it("suggests money that tracks strength, matching the shipped ladder", () => {
    expect(suggestedBudgetScale(0)).toBe(1);
    expect(suggestedBudgetScale(10)).toBe(0.5);
    expect(suggestedBudgetScale(12)).toBe(0.4);
    // Monotonic and floored, so a slider can't produce a free-money league.
    expect(suggestedBudgetScale(40)).toBe(0.25);
    expect(suggestedBudgetScale(5)).toBeGreaterThan(suggestedBudgetScale(9));
  });
});

describe("club identities are anchored to a country, not to a tid", () => {
  it("gives the shipped world exactly the shipped club blocks", () => {
    // Pins the refactor from CLUBS[tid] to per-country indexing: for the shipped
    // world the two must agree club for club, or every save renames its clubs.
    const ranges = countryClubRanges(worldCompetitions(), NUM_TEAMS, NUM_TEAMS_D2);
    for (const range of ranges) {
      const block = shippedClubsFor(range.country);
      expect(block).not.toBeNull();
      expect(block).toEqual(CLUBS.slice(range.start, range.end));
    }
  });

  it("has no shipped block for a country the player added", () => {
    expect(shippedClubsFor("Neverland")).toBeNull();
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
