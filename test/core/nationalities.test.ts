import { describe, it, expect } from "vitest";
import {
  LEAGUE_NATIONALITY_WEIGHTS, NATIONALITIES, OTHER_NATIONS, UNLISTED_NATIONALITIES,
  namePoolFor, pickNationality, sanitizeNationalityWeights,
} from "../../src/core/players/nationalities.js";
import { WORLD_NATIONALITIES } from "../../src/core/players/worldNationalities.js";
import { confederationOf } from "../../src/core/international/confederations.js";
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

describe("name pools", () => {
  // Every pool the generator can reach, keyed by nationality. OTHER_NATIONS'
  // "Ivory Coast" is shadowed by the NATIONALITIES entry (see namePoolFor), so
  // going through namePoolFor is what tests the pool actually used.
  const ALL_NATIONS = [...new Set([
    ...Object.keys(NATIONALITIES),
    ...Object.keys(OTHER_NATIONS),
    ...Object.keys(UNLISTED_NATIONALITIES),
  ])];

  it("has no duplicate name within any list", () => {
    for (const nation of ALL_NATIONS) {
      const pool = namePoolFor(nation)!;
      for (const field of ["first", "last"] as const) {
        const seen = new Set<string>();
        const dupes: string[] = [];
        for (const name of pool[field]) {
          const key = name.toLowerCase();
          if (seen.has(key)) dupes.push(name);
          seen.add(key);
        }
        expect(dupes, `${nation}.${field} has duplicates`).toEqual([]);
      }
    }
  });

  it("is ASCII-only (the file's accent-free convention)", () => {
    for (const nation of ALL_NATIONS) {
      const pool = namePoolFor(nation)!;
      const bad = [...pool.first, ...pool.last].filter((n) => /[^\x20-\x7E]/.test(n));
      expect(bad, `${nation} has non-ASCII names`).toEqual([]);
    }
  });

  // A name is one first x one last draw, so pool size squared is the whole
  // namespace. The floors below are what keeps a generated world from handing
  // a dozen players the same name (scripts/namePoolProbe.ts measures the rate).
  //
  // Raised 20 -> 50 on 2026-08-26, when a league the player builds could first
  // choose its own nationalities. Before that a small pool only ever supplied a
  // handful of players through some league's rest-of-world tail; now ANY nation
  // can be a league's home nation and supply ~1000 of them. Measured at 24x24
  // (576 names) against 1000 players: 82% shared a name with someone and one
  // name landed six times. At the floor below the same draw is ~24% and no name
  // appears more than three times, against England's 8%.
  it("every pool clears the 50x50 floor", () => {
    for (const nation of ALL_NATIONS) {
      const pool = namePoolFor(nation)!;
      expect(pool.first.length, `${nation} first names`).toBeGreaterThanOrEqual(50);
      expect(pool.last.length, `${nation} last names`).toBeGreaterThanOrEqual(50);
    }
  });

  it("home-league countries clear 80x80 (they generate ~500 players each)", () => {
    for (const home of Object.keys(LEAGUE_NATIONALITY_WEIGHTS)) {
      const pool = namePoolFor(home)!;
      expect(pool.first.length, `${home} first names`).toBeGreaterThanOrEqual(80);
      expect(pool.last.length, `${home} last names`).toBeGreaterThanOrEqual(80);
    }
  });
});

describe("the full FIFA nationality set", () => {
  // Every nation a league can be told to produce. The point of the set is that
  // it is COMPLETE — any country can be the home nation of a league the player
  // builds — so the assertions below are about coverage, not about the pools.
  const ALL = new Set([
    ...Object.keys(NATIONALITIES),
    ...Object.keys(OTHER_NATIONS),
    ...Object.keys(UNLISTED_NATIONALITIES),
  ]);

  it("covers all 211 FIFA members, split exactly as the real confederations are", () => {
    // These six counts ARE FIFA's membership (UEFA 55, CAF 54, AFC 46,
    // CONCACAF 35, OFC 11, CONMEBOL 10). Pinning them rather than the total
    // catches the likelier mistake: a nation filed under the continent it sits
    // on instead of the confederation it plays in — Guyana and Guam both look
    // wrong and are right, and a typo in either moves two counts at once.
    const counts: Record<string, number> = {};
    for (const nation of ALL) {
      const conf = confederationOf(nation);
      expect(conf, `${nation} has a name pool but no confederation`).not.toBeNull();
      counts[conf!] = (counts[conf!] ?? 0) + 1;
    }
    expect(counts).toEqual({
      Europe: 55,
      Africa: 54,
      Asia: 46,
      "North America": 35,
      Oceania: 11,
      "South America": 10,
    });
    expect(ALL.size).toBe(211);
  });

  it("adds no name that shadows a hand-curated pool", () => {
    // UNLISTED_NATIONALITIES spreads WORLD_NATIONALITIES in first so a curated
    // entry wins a collision — but a collision would still mean two people
    // maintaining one nation's names in two places, which drifts silently.
    const curated = new Set([...Object.keys(NATIONALITIES), ...Object.keys(OTHER_NATIONS)]);
    const collisions = Object.keys(WORLD_NATIONALITIES).filter((n) => curated.has(n));
    expect(collisions).toEqual([]);
  });

  it("keeps every nation pickable, i.e. sanitize accepts it as a league's own mix", () => {
    // A league's authored table goes through sanitizeNationalityWeights, which
    // drops any nation with no name pool. That drop is silent, so a nation
    // offered by the world editor but refused here would look like the editor
    // was broken.
    for (const nation of ALL) {
      expect(sanitizeNationalityWeights({ [nation]: 10 }), nation).toEqual({ [nation]: 10 });
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
