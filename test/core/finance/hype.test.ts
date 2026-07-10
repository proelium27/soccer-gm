import { describe, it, expect } from "vitest";
import { updateHype } from "../../../src/core/finance/hype.js";
import { HYPE_MAX, HYPE_MIN } from "../../../src/core/constants.js";
import type { StandingsRow } from "../../../src/core/standings.js";

function row(overrides: Partial<StandingsRow>): StandingsRow {
  return { tid: 0, played: 38, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, ...overrides };
}

describe("updateHype", () => {
  it("moves toward a higher target for a strong, high-ranked season", () => {
    const strongRow = row({ points: 90, played: 38 });
    const next = updateHype(50, strongRow, 1);
    expect(next).toBeGreaterThan(50);
  });

  it("moves toward a lower target for a weak, low-ranked season", () => {
    const weakRow = row({ points: 20, played: 38 });
    const next = updateHype(50, weakRow, 20);
    expect(next).toBeLessThan(50);
  });

  it("stays within [HYPE_MIN, HYPE_MAX]", () => {
    const dominantRow = row({ points: 114, played: 38 });
    const next = updateHype(HYPE_MAX, dominantRow, 1);
    expect(next).toBeLessThanOrEqual(HYPE_MAX);
    expect(next).toBeGreaterThanOrEqual(HYPE_MIN);
  });

  it("does not snap all the way to the target in one season", () => {
    const dominantRow = row({ points: 114, played: 38 });
    const next = updateHype(0, dominantRow, 1);
    expect(next).toBeLessThan(100);
  });
});
