import { describe, it, expect } from "vitest";
import {
  matchdayToMonth,
  lastMatchdayOfMonth,
  TRANSFER_DEADLINE_MATCHDAY,
} from "../../src/core/calendar.js";

describe("matchdayToMonth", () => {
  it("matchday 1 → August", () => {
    expect(matchdayToMonth(1)).toBe("August");
  });
  it("matchday 5 → September", () => {
    expect(matchdayToMonth(5)).toBe("September");
  });
  it("matchday 22 → January", () => {
    expect(matchdayToMonth(22)).toBe("January");
  });
  it("matchday 38 → May", () => {
    expect(matchdayToMonth(38)).toBe("May");
  });
  it("throws for out-of-range matchday", () => {
    expect(() => matchdayToMonth(0)).toThrow();
    expect(() => matchdayToMonth(39)).toThrow();
  });
});

describe("lastMatchdayOfMonth", () => {
  it("lastMatchdayOfMonth(1) → 4 (August)", () => {
    expect(lastMatchdayOfMonth(1)).toBe(4);
  });
  it("lastMatchdayOfMonth(4) → 4 (end of August)", () => {
    expect(lastMatchdayOfMonth(4)).toBe(4);
  });
  it("lastMatchdayOfMonth(22) → 25 (January)", () => {
    expect(lastMatchdayOfMonth(22)).toBe(25);
  });
  it("lastMatchdayOfMonth(37) → 38 (May)", () => {
    expect(lastMatchdayOfMonth(37)).toBe(38);
  });
  it("throws for out-of-range matchday", () => {
    expect(() => lastMatchdayOfMonth(0)).toThrow();
    expect(() => lastMatchdayOfMonth(39)).toThrow();
  });
});

describe("TRANSFER_DEADLINE_MATCHDAY", () => {
  it("equals 22", () => {
    expect(TRANSFER_DEADLINE_MATCHDAY).toBe(22);
  });
});
