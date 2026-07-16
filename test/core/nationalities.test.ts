import { describe, it, expect } from "vitest";
import { NATIONALITIES, namePoolFor, pickNationality } from "../../src/core/players/nationalities.js";
import { flagFor } from "../../src/core/players/flags.js";
import { mulberry32 } from "../../src/engine/rng.js";

describe("Italy nationality pool", () => {
  it("has a name pool with at least 20 first and 20 last names", () => {
    const pool = namePoolFor("Italy");
    expect(pool).toBeDefined();
    expect(pool!.first.length).toBeGreaterThanOrEqual(20);
    expect(pool!.last.length).toBeGreaterThanOrEqual(20);
  });

  it("has a positive weight comparable to Spain's", () => {
    expect(NATIONALITIES.Italy.weight).toBeGreaterThan(0);
    expect(NATIONALITIES.Italy.weight).toBeCloseTo(NATIONALITIES.Spain.weight, -1);
  });

  it("has a flag emoji, not the unknown-nationality placeholder", () => {
    expect(flagFor("Italy")).toBe("🇮🇹");
    expect(flagFor("Italy")).not.toBe("🏳️");
  });
});

describe("pickNationality home-country weighting", () => {
  it("with no home country, matches today's flat distribution (England is the plurality)", () => {
    const rng = mulberry32(1);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      const n = pickNationality(rng);
      counts[n] = (counts[n] ?? 0) + 1;
    }
    const england = counts.England ?? 0;
    for (const [country, count] of Object.entries(counts)) {
      if (country !== "England") expect(england).toBeGreaterThan(count);
    }
  });

  it("with homeCountry 'Spain', Spain becomes the plurality instead of England", () => {
    const rng = mulberry32(2);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      const n = pickNationality(rng, "Spain");
      counts[n] = (counts[n] ?? 0) + 1;
    }
    const spain = counts.Spain ?? 0;
    for (const [country, count] of Object.entries(counts)) {
      if (country !== "Spain") expect(spain).toBeGreaterThan(count);
    }
  });

  it("homeCountry 'England' behaves identically to no homeCountry", () => {
    const rngA = mulberry32(3);
    const rngB = mulberry32(3);
    const seqA = Array.from({ length: 50 }, () => pickNationality(rngA));
    const seqB = Array.from({ length: 50 }, () => pickNationality(rngB, "England"));
    expect(seqA).toEqual(seqB);
  });

  it("an unrecognized homeCountry falls back to the flat distribution instead of throwing", () => {
    const rng = mulberry32(4);
    expect(() => pickNationality(rng, "Atlantis")).not.toThrow();
  });
});
