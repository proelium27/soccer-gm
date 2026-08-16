import { describe, it, expect } from "vitest";
import {
  per90,
  per90QualifyingMinutes,
  PER90_STAT_KEYS,
} from "../../src/core/stats/per90.js";
import { PER90_QUALIFY_FRACTION } from "../../src/core/constants.js";
import { emptySeasonStats } from "../../src/core/players/types.js";

describe("per90", () => {
  it("scales a total to a rate per 90 minutes", () => {
    // 10 goals in 900 minutes (ten full matches) is exactly 1.0 per 90.
    expect(per90(10, 900)).toBe(1);
    // Half the minutes, same total, double the rate.
    expect(per90(10, 450)).toBe(2);
  });

  it("does not round the rate — formatting is the caller's job", () => {
    expect(per90(1, 120)).toBeCloseTo(0.75, 10);
  });

  it("returns null with no minutes played rather than dividing by zero", () => {
    expect(per90(0, 0)).toBeNull();
    // A stat total with zero recorded minutes is unrepresentable as a rate,
    // not infinite — the caller renders a dash.
    expect(per90(3, 0)).toBeNull();
  });

  it("handles a fractional stat total (xG) the same way", () => {
    expect(per90(4.5, 900)).toBeCloseTo(0.45, 10);
  });
});

describe("PER90_STAT_KEYS", () => {
  it("covers only counting stats, never averages or the denominator itself", () => {
    // minutesPlayed is the denominator and appearances is context; avgRating is
    // already an average, so a "per 90" of any of them is meaningless.
    expect(PER90_STAT_KEYS).not.toContain("minutesPlayed");
    expect(PER90_STAT_KEYS).not.toContain("appearances");
    expect(PER90_STAT_KEYS).not.toContain("avgRating");
    expect(PER90_STAT_KEYS).not.toContain("ratingSum");
    expect(PER90_STAT_KEYS).not.toContain("season");
    expect(PER90_STAT_KEYS).not.toContain("tid");
  });

  it("includes the outfield and keeper counting stats the tables render", () => {
    for (const key of [
      "goals", "assists", "shots", "shotsOnTarget", "xg",
      "saves", "goalsAgainst", "xga", "tackles", "interceptions",
      "passes", "passesCompleted", "crosses", "foulsCommitted",
    ]) {
      expect(PER90_STAT_KEYS).toContain(key);
    }
  });

  it("names only real SeasonStats fields", () => {
    const stats = emptySeasonStats(2026);
    for (const key of PER90_STAT_KEYS) {
      expect(stats).toHaveProperty(key);
    }
  });
});

describe("per90QualifyingMinutes", () => {
  it("requires a fraction of the minutes available across matches played so far", () => {
    // 10 matches played => 900 available minutes => 30% is 270.
    expect(per90QualifyingMinutes(10)).toBe(
      Math.ceil(PER90_QUALIFY_FRACTION * 90 * 10),
    );
    expect(per90QualifyingMinutes(10)).toBe(270);
  });

  it("scales with the season's progress, so the board is honest early too", () => {
    // The bar rises as the season goes on rather than being a flat end-of-season
    // number that nobody can clear in September.
    expect(per90QualifyingMinutes(38)).toBeGreaterThan(per90QualifyingMinutes(10));
    expect(per90QualifyingMinutes(1)).toBe(27);
  });

  it("is zero before any match is played", () => {
    expect(per90QualifyingMinutes(0)).toBe(0);
  });

  it("keeps a cameo off the board but admits a regular starter", () => {
    const threshold = per90QualifyingMinutes(10);
    const cameo = 12;
    const regular = 8 * 90;
    expect(cameo).toBeLessThan(threshold);
    expect(regular).toBeGreaterThanOrEqual(threshold);
  });
});
