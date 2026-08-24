import { describe, it, expect, afterEach } from "vitest";
import {
  SEASON_START_YEAR,
  MIN_START_YEAR,
  MAX_START_YEAR,
  seasonYear,
  seasonYearFrom,
  setSeasonStartYear,
  normalizeStartYear,
} from "../../src/ui/format.js";

// seasonYear reads module state (see format.ts), so every test puts it back.
afterEach(() => setSeasonStartYear(undefined));

describe("season → year display", () => {
  it("starts at 2026 when a save doesn't name a start year", () => {
    setSeasonStartYear(undefined);
    expect(seasonYear(1)).toBe(SEASON_START_YEAR);
    expect(seasonYear(5)).toBe(SEASON_START_YEAR + 4);
  });

  it("counts up from the save's own start year", () => {
    setSeasonStartYear(1998);
    expect(seasonYear(1)).toBe(1998);
    expect(seasonYear(12)).toBe(2009);
  });

  it("goes back to the default when a save is closed", () => {
    setSeasonStartYear(1998);
    setSeasonStartYear(undefined);
    expect(seasonYear(1)).toBe(SEASON_START_YEAR);
  });

  it("formats a season against an explicit start year without touching the active one", () => {
    setSeasonStartYear(1998);
    expect(seasonYearFrom(2030, 3)).toBe(2032);
    expect(seasonYear(3)).toBe(2000);
  });
});

describe("normalizeStartYear", () => {
  it("accepts a year inside the picker's range", () => {
    expect(normalizeStartYear("1998")).toBe(1998);
    expect(normalizeStartYear(" 2026 ")).toBe(2026);
    expect(normalizeStartYear(String(MIN_START_YEAR))).toBe(MIN_START_YEAR);
    expect(normalizeStartYear(String(MAX_START_YEAR))).toBe(MAX_START_YEAR);
  });

  it("rejects anything that isn't a year in range", () => {
    // Empty is the mid-edit state, which must leave the field unusable rather
    // than silently falling back to a year the player didn't choose.
    expect(normalizeStartYear("")).toBeNull();
    expect(normalizeStartYear("   ")).toBeNull();
    expect(normalizeStartYear("20x6")).toBeNull();
    expect(normalizeStartYear("2026.5")).toBeNull();
    expect(normalizeStartYear("-2026")).toBeNull();
    expect(normalizeStartYear(String(MIN_START_YEAR - 1))).toBeNull();
    expect(normalizeStartYear(String(MAX_START_YEAR + 1))).toBeNull();
  });
});
