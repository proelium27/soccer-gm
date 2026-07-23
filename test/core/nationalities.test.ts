import { describe, it, expect } from "vitest";
import {
  LEAGUE_NATIONALITY_WEIGHTS, NATIONALITIES, OTHER_NATIONS, namePoolFor, pickNationality,
} from "../../src/core/players/nationalities.js";
import { flagCodeFor } from "../../src/core/players/flags.js";
import { mulberry32 } from "../../src/engine/rng.js";

const REST = "__REST__";
const LEAGUES = Object.keys(LEAGUE_NATIONALITY_WEIGHTS);

function drawCounts(homeCountry: string | undefined, n = 4000, seed = 1): Record<string, number> {
  const rng = mulberry32(seed);
  const counts: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const nat = pickNationality(rng, homeCountry);
    counts[nat] = (counts[nat] ?? 0) + 1;
  }
  return counts;
}

describe("per-league nationality tables", () => {
  it("every named nation in every league table has a name pool (incl. Kosovo, Turkey, United States)", () => {
    for (const table of Object.values(LEAGUE_NATIONALITY_WEIGHTS)) {
      for (const country of Object.keys(table)) {
        if (country === REST) continue;
        const pool = namePoolFor(country);
        expect(pool, `missing name pool for ${country}`).toBeDefined();
        expect(pool!.first.length).toBeGreaterThan(0);
        expect(pool!.last.length).toBeGreaterThan(0);
      }
    }
  });

  it("every league table has a REST slot and its home nation as the plurality weight", () => {
    for (const [home, table] of Object.entries(LEAGUE_NATIONALITY_WEIGHTS)) {
      expect(table[REST], `${home} missing REST slot`).toBeGreaterThan(0);
      const maxWeight = Math.max(...Object.values(table));
      expect(table[home], `${home} not its own plurality`).toBe(maxWeight);
    }
  });

  it("each country's own nationality is the drawn plurality in its league", () => {
    for (const home of LEAGUES) {
      const counts = drawCounts(home, 4000, 11);
      const homeCount = counts[home] ?? 0;
      for (const [country, count] of Object.entries(counts)) {
        if (country !== home) {
          expect(homeCount, `${country} out-drew ${home} in ${home}'s league`).toBeGreaterThan(count);
        }
      }
    }
  });
});

describe("league-specific flavor (real-calibrated tails)", () => {
  it("Morocco is far commoner in Spain's league than in England's", () => {
    const es = drawCounts("Spain", 6000, 21);
    const en = drawCounts("England", 6000, 21);
    expect((es.Morocco ?? 0)).toBeGreaterThan((en.Morocco ?? 0) * 3);
  });

  it("Japan is commoner in Germany's league than in England's (Bundesliga pipeline)", () => {
    const de = drawCounts("Germany", 6000, 22);
    const en = drawCounts("England", 6000, 22);
    expect((de.Japan ?? 0)).toBeGreaterThan((en.Japan ?? 0));
  });

  it("Wales is a named nation in England's league but only a REST-tail nation in Spain's (notably rarer)", () => {
    const en = drawCounts("England", 6000, 23);
    const es = drawCounts("Spain", 6000, 23);
    expect((en.Wales ?? 0)).toBeGreaterThan(50);
    // Named (weight 23) in England vs. a mid-weight tail nation in Spain.
    expect((es.Wales ?? 0)).toBeLessThan((en.Wales ?? 0) * 0.6);
  });

  it("the REST tail actually yields nations outside a league's named set", () => {
    const named = new Set(Object.keys(LEAGUE_NATIONALITY_WEIGHTS.England).filter((c) => c !== REST));
    const counts = drawCounts("England", 6000, 24);
    const tailHit = Object.keys(counts).some((c) => !named.has(c));
    expect(tailHit).toBe(true);
  });

  it("Kosovo (a Germany-only named nation) has both a name pool and a flag", () => {
    expect(namePoolFor("Kosovo")).toBeDefined();
    expect(flagCodeFor("Kosovo")).toBe("xk");
    expect(flagCodeFor("Italy")).toBe("it");
  });

  it("every generated nationality maps to a flag code", () => {
    const all = [...Object.keys(NATIONALITIES), ...Object.keys(OTHER_NATIONS)];
    const missing = all.filter((n) => flagCodeFor(n) === null);
    expect(missing).toEqual([]);
  });
});

describe("no-country / fallback behavior", () => {
  it("with no home country, falls back to England's table (England is the plurality)", () => {
    const counts = drawCounts(undefined, 4000, 1);
    const england = counts.England ?? 0;
    for (const [country, count] of Object.entries(counts)) {
      if (country !== "England") expect(england).toBeGreaterThan(count);
    }
  });

  it("homeCountry 'England' behaves identically to no homeCountry", () => {
    const rngA = mulberry32(3);
    const rngB = mulberry32(3);
    const seqA = Array.from({ length: 50 }, () => pickNationality(rngA));
    const seqB = Array.from({ length: 50 }, () => pickNationality(rngB, "England"));
    expect(seqA).toEqual(seqB);
  });

  it("an unrecognized homeCountry falls back to England's table instead of throwing", () => {
    expect(() => pickNationality(mulberry32(9), "Atlantis")).not.toThrow();
    // Same stream as an England draw, since unknown -> England table.
    const rngUnknown = mulberry32(9);
    const rngEngland = mulberry32(9);
    const seqUnknown = Array.from({ length: 30 }, () => pickNationality(rngUnknown, "Atlantis"));
    const seqEngland = Array.from({ length: 30 }, () => pickNationality(rngEngland, "England"));
    expect(seqUnknown).toEqual(seqEngland);
  });

  it("realized England share matches its table weight over the table total (~39%)", () => {
    const table = LEAGUE_NATIONALITY_WEIGHTS.England;
    let total = 0;
    for (const w of Object.values(table)) total += w;
    const expectedShare = table.England / total;

    const rng = mulberry32(7);
    let englandCount = 0;
    const trials = 20000;
    for (let i = 0; i < trials; i++) {
      if (pickNationality(rng) === "England") englandCount++;
    }
    expect(englandCount / trials).toBeCloseTo(expectedShare, 1);
  });
});
