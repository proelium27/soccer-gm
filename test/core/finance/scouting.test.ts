import { describe, it, expect } from "vitest";
import { scoutingNoiseSd, clampScoutingSpend } from "../../../src/core/finance/scouting.js";
import {
  SCOUTING_NOISE_SD_MAX_SPEND, SCOUTING_NOISE_SD_MIN_SPEND, SCOUTING_SPEND_MAX,
} from "../../../src/core/constants.js";

describe("scoutingNoiseSd", () => {
  it("is at its widest at zero spend", () => {
    expect(scoutingNoiseSd(0)).toBeCloseTo(SCOUTING_NOISE_SD_MIN_SPEND);
  });

  it("is at its tightest at max spend", () => {
    expect(scoutingNoiseSd(SCOUTING_SPEND_MAX)).toBeCloseTo(SCOUTING_NOISE_SD_MAX_SPEND);
  });

  it("decreases monotonically with spend", () => {
    expect(scoutingNoiseSd(SCOUTING_SPEND_MAX * 0.25))
      .toBeGreaterThan(scoutingNoiseSd(SCOUTING_SPEND_MAX * 0.75));
  });
});

describe("clampScoutingSpend", () => {
  it("clamps to the club's budget when below SCOUTING_SPEND_MAX", () => {
    expect(clampScoutingSpend(10_000_000, 1_000_000)).toBe(1_000_000);
  });

  it("clamps to SCOUTING_SPEND_MAX when the budget exceeds it", () => {
    expect(clampScoutingSpend(999_999_999, 999_999_999)).toBe(SCOUTING_SPEND_MAX);
  });

  it("never goes negative even with a negative budget", () => {
    expect(clampScoutingSpend(500_000, -1_000_000)).toBe(0);
  });
});
