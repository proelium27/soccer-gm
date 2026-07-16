import { describe, it, expect } from "vitest";
import {
  NATIONALITIES, UNLISTED_NATIONALITIES, namePoolFor, pickNationality,
} from "../../src/core/players/nationalities.js";
import { flagFor } from "../../src/core/players/flags.js";
import { mulberry32 } from "../../src/engine/rng.js";

describe("Italy nationality pool", () => {
  it("has a name pool with at least 20 first and 20 last names", () => {
    const pool = namePoolFor("Italy");
    expect(pool).toBeDefined();
    expect(pool!.first.length).toBeGreaterThanOrEqual(20);
    expect(pool!.last.length).toBeGreaterThanOrEqual(20);
  });

  it("has a positive weight comparable to Spain's, but lives outside NATIONALITIES", () => {
    // Italy is deliberately kept out of the flat-pool table (see
    // UNLISTED_NATIONALITIES's doc comment) so adding it can't shift the
    // outcome distribution for saves that never touch Italy.
    expect(NATIONALITIES.Italy).toBeUndefined();
    expect(UNLISTED_NATIONALITIES.Italy.weight).toBeGreaterThan(0);
    expect(UNLISTED_NATIONALITIES.Italy.weight).toBeCloseTo(NATIONALITIES.Spain.weight, -1);
  });

  it("has a flag emoji, not the unknown-nationality placeholder", () => {
    expect(flagFor("Italy")).toBe("🇮🇹");
    expect(flagFor("Italy")).not.toBe("🏳️");
  });

  it("never appears in the flat, no-homeCountry draw (the path youth intake/free agency always use)", () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 5000; i++) {
      expect(pickNationality(rng)).not.toBe("Italy");
    }
  });

  it("can still be drawn via an explicit homeCountry, despite being outside NATIONALITIES", () => {
    const rng = mulberry32(6);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      const n = pickNationality(rng, "Italy");
      counts[n] = (counts[n] ?? 0) + 1;
    }
    const italy = counts.Italy ?? 0;
    for (const [country, count] of Object.entries(counts)) {
      if (country !== "Italy") expect(italy).toBeGreaterThan(count);
    }
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

  it("the flat draw's England share is unchanged from before Italy existed (a frozen reference proportion)", () => {
    // England's original weight (390) over the original total (before Italy
    // existed): computed from NATIONALITIES + a fixed OTHER_BUCKET_WEIGHT (8),
    // pinned here as a regression guard against a future addition to
    // NATIONALITIES silently diluting every existing save's flat draw again.
    let originalTotal = 8;
    for (const def of Object.values(NATIONALITIES)) originalTotal += def.weight;
    const expectedShare = NATIONALITIES.England.weight / originalTotal;

    const rng = mulberry32(7);
    let englandCount = 0;
    const trials = 20000;
    for (let i = 0; i < trials; i++) {
      if (pickNationality(rng) === "England") englandCount++;
    }
    expect(englandCount / trials).toBeCloseTo(expectedShare, 1);
  });
});
