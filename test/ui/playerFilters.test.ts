import { describe, it, expect } from "vitest";
import {
  EMPTY_PLAYER_FILTERS,
  hasAnyFilter,
  moneyFilter,
  numFilter,
  toSearchFilters,
} from "../../src/ui/components/PlayerFilterBar.js";

describe("numFilter", () => {
  it("reads an empty or blank box as no constraint", () => {
    expect(numFilter("")).toBeNull();
    expect(numFilter("   ")).toBeNull();
  });

  it("rejects text rather than passing NaN into the search", () => {
    expect(numFilter("abc")).toBeNull();
  });

  it("reads a number", () => {
    expect(numFilter("70")).toBe(70);
    expect(numFilter("0")).toBe(0);
  });
});

describe("moneyFilter", () => {
  it("keeps a bare number in dollars, so old-style entries still mean the same", () => {
    expect(moneyFilter("50000000")).toBe(50_000_000);
    expect(moneyFilter("50,000,000")).toBe(50_000_000);
  });

  it("accepts the shorthand people actually type", () => {
    expect(moneyFilter("50m")).toBe(50_000_000);
    expect(moneyFilter("50M")).toBe(50_000_000);
    expect(moneyFilter("2.5m")).toBe(2_500_000);
    expect(moneyFilter("800k")).toBe(800_000);
    expect(moneyFilter("$50m")).toBe(50_000_000);
    expect(moneyFilter(" 50 m ")).toBe(50_000_000);
  });

  it("is no constraint when empty or unparseable", () => {
    expect(moneyFilter("")).toBeNull();
    expect(moneyFilter("lots")).toBeNull();
    expect(moneyFilter("50bn")).toBeNull();
  });
});

describe("hasAnyFilter", () => {
  it("is false for a cleared bar and true once any field is set", () => {
    expect(hasAnyFilter(EMPTY_PLAYER_FILTERS)).toBe(false);
    expect(hasAnyFilter({ ...EMPTY_PLAYER_FILTERS, nationality: "Portugal" })).toBe(true);
    expect(hasAnyFilter({ ...EMPTY_PLAYER_FILTERS, maxWage: "200k" })).toBe(true);
  });
});

describe("toSearchFilters", () => {
  it("turns a cleared bar into an all-null constraint set", () => {
    const f = toSearchFilters(EMPTY_PLAYER_FILTERS);
    expect(f.position).toBeUndefined();
    expect(f.nationality).toBeUndefined();
    expect(f.compId).toBeNull();
    expect(f.minOvr).toBeNull();
    expect(f.maxValue).toBeNull();
    expect(f.maxWeeklyWage).toBeNull();
    expect(f.maxContractYears).toBeNull();
  });

  it("parses each field into the units the core search expects", () => {
    const f = toSearchFilters({
      ...EMPTY_PLAYER_FILTERS,
      position: "ST",
      nationality: "Spain",
      compId: "2",
      minOvr: "70",
      maxOvr: "80",
      minAge: "18",
      maxAge: "24",
      minValue: "5m",
      maxValue: "50m",
      maxWage: "200k",
      maxContractYears: "1",
    });
    expect(f).toMatchObject({
      position: "ST",
      nationality: "Spain",
      compId: 2,
      minOvr: 70,
      maxOvr: 80,
      minAge: 18,
      maxAge: 24,
      minValue: 5_000_000,
      maxValue: 50_000_000,
      maxWeeklyWage: 200_000,
      maxContractYears: 1,
    });
  });

  it("keeps a contract filter of 0 (expiring now) rather than dropping it as falsy", () => {
    expect(toSearchFilters({ ...EMPTY_PLAYER_FILTERS, maxContractYears: "0" }).maxContractYears)
      .toBe(0);
  });
});
