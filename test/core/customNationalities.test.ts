import { describe, it, expect } from "vitest";
import {
  pickNationality, sanitizeNationalityWeights, nationalityShares, restOfWorldPreview,
  REST_OF_WORLD, LEAGUE_NATIONALITY_WEIGHTS, type NationalityWeights,
  NATIONALITIES, OTHER_NATIONS, UNLISTED_NATIONALITIES,
} from "../../src/core/players/nationalities.js";
import { buildCompetitions, competitionNationalities } from "../../src/core/competitions.js";
import { generateYouthIntake } from "../../src/core/players/youth.js";
import { mulberry32 } from "../../src/engine/rng.js";

/** Empirical distribution of `n` draws from a table, as fractions. */
function distribution(table: NationalityWeights | null, n = 20000): Map<string, number> {
  const rng = mulberry32(7);
  const counts = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const nat = pickNationality(rng, "Atlantis", table);
    counts.set(nat, (counts.get(nat) ?? 0) + 1);
  }
  return new Map([...counts].map(([k, v]) => [k, v / n]));
}

describe("hand-authored league nationalities", () => {
  it("an invented country falls back to England without a table (the behaviour this fixes)", () => {
    const d = distribution(null);
    // Not an assertion about England's exact numbers, just that an unrecognized
    // country lands on England's table rather than anything of its own.
    expect(d.get("England") ?? 0).toBeGreaterThan(0.3);
  });

  it("a custom table replaces that fallback outright", () => {
    const d = distribution({ Netherlands: 60, Belgium: 30, [REST_OF_WORLD]: 10 });
    expect(d.get("Netherlands") ?? 0).toBeCloseTo(0.6, 1);
    expect(d.get("Belgium") ?? 0).toBeCloseTo(0.3, 1);
    // England can only arrive via the rest-of-world bucket now, which is 10%.
    expect(d.get("England") ?? 0).toBeLessThan(0.06);
  });

  it("a table with no rest-of-world bucket draws only what it names", () => {
    const d = distribution({ Japan: 50, Nigeria: 50 });
    expect(new Set(d.keys())).toEqual(new Set(["Japan", "Nigeria"]));
  });

  it("weights are relative, so the same ratios in different units agree", () => {
    const asPercent = distribution({ Brazil: 70, Portugal: 30 });
    const asCounts = distribution({ Brazil: 14, Portugal: 6 });
    expect(asCounts.get("Brazil")).toBeCloseTo(asPercent.get("Brazil")!, 2);
  });

  it("realized shares are what the editor shows, over-summing source data included", () => {
    // The published Turkish breakdown totalled 130.7%: feeding it raw states 48%
    // domestic and delivers less. nationalityShares is what surfaces that.
    const shares = new Map(nationalityShares({ Turkey: 48, Brazil: 50, Senegal: 32.7 }));
    expect(shares.get("Turkey")!).toBeCloseTo(36.7, 0);
    expect([...shares.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
  });

  it("the rest-of-world bucket leans English, and says so", () => {
    // Not a bug to fix here but a fact to surface: TAIL_BASE is built from the
    // shipped NATIONALITIES weights, which are the Premier League's foreign
    // makeup rather than a neutral global prior.
    const preview = restOfWorldPreview({ [REST_OF_WORLD]: 100 });
    expect(preview[0][0]).toBe("England");
    expect(preview[0][1]).toBeGreaterThan(30);
  });

  it("survives a table that names every nation and still keeps a rest-of-world row", () => {
    // The tail is then empty. Before this was handled the draw indexed
    // entries[-1] and threw; the shipped tables can't reach it (each names a
    // dozen of 78), so it only became possible once tables were player-authored.
    const everyone: NationalityWeights = { [REST_OF_WORLD]: 500 };
    for (const nation of [
      ...Object.keys(NATIONALITIES), ...Object.keys(OTHER_NATIONS), ...Object.keys(UNLISTED_NATIONALITIES),
    ]) everyone[nation] = 1;

    expect(() => distribution(everyone, 500)).not.toThrow();

    // The empty row draws nothing at all rather than a share it can't deliver,
    // so the named nations normalize among themselves.
    const shares = new Map(nationalityShares(everyone));
    expect(shares.get(REST_OF_WORLD)).toBe(0);
    expect([...shares.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
    expect(restOfWorldPreview(everyone)).toEqual([]);
  });

  it("naming a nation removes it from that table's own tail", () => {
    const preview = restOfWorldPreview({ England: 10, [REST_OF_WORLD]: 90 });
    expect(preview.map(([c]) => c)).not.toContain("England");
  });
});

describe("sanitizeNationalityWeights", () => {
  it("drops nations with no name pool, which would generate nonsense names", () => {
    expect(sanitizeNationalityWeights({ Netherlands: 50, Wakanda: 50 }))
      .toEqual({ Netherlands: 50 });
  });

  it("drops non-positive and non-finite weights", () => {
    expect(sanitizeNationalityWeights({
      Japan: 10, Brazil: 0, Spain: -5, Italy: NaN, France: Infinity,
    })).toEqual({ Japan: 10 });
  });

  it("keeps the rest-of-world sentinel, which has no name pool of its own", () => {
    expect(sanitizeNationalityWeights({ [REST_OF_WORLD]: 5 })).toEqual({ [REST_OF_WORLD]: 5 });
  });

  it("returns null when nothing usable is left, meaning 'shipped behaviour'", () => {
    expect(sanitizeNationalityWeights({ Wakanda: 10 })).toBeNull();
    expect(sanitizeNationalityWeights({})).toBeNull();
    expect(sanitizeNationalityWeights(undefined)).toBeNull();
  });
});

describe("the table reaches the competitions it was authored for", () => {
  it("both of a country's divisions get the same table", () => {
    const comps = buildCompetitions([
      { country: "Atlantis", nationalities: { Japan: 100 } },
    ]);
    expect(comps).toHaveLength(2);
    for (const c of comps) expect(competitionNationalities(c)).toEqual({ Japan: 100 });
  });

  it("a shipped league is left absent, so it keeps its calibrated table", () => {
    const [england] = buildCompetitions([{ country: "England" }]);
    expect(england.nationalities).toBeUndefined();
    expect(competitionNationalities(england)).toBeNull();
    // And the shipped table is still what a draw for England resolves to.
    expect(LEAGUE_NATIONALITY_WEIGHTS.England).toBeDefined();
  });
});

describe("youth intake keeps the league's own mix", () => {
  it("prospects are drawn from the custom table, not England's", () => {
    // The load-bearing case: generation alone isn't enough, because intake runs
    // every offseason and would drift the league English one year at a time.
    const rng = mulberry32(3);
    const nats: NationalityWeights = { Japan: 100 };
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const { players } = generateYouthIntake(rng, 55, 2030, i * 100, i, "Atlantis", nats);
      for (const p of players) seen.add(p.nationality);
    }
    expect([...seen]).toEqual(["Japan"]);
  });

  it("without a table it still falls back, so shipped leagues are untouched", () => {
    const rng = mulberry32(3);
    const { players } = generateYouthIntake(rng, 55, 2030, 0, 1, "Spain", null);
    expect(players.length).toBeGreaterThan(0);
    // Spain's shipped table is heavily domestic; England's is not. Either way
    // the point is only that a null table resolves through the country.
    expect(players.every((p) => typeof p.nationality === "string")).toBe(true);
  });
});
