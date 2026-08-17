import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { simSeason as coreSimSeason } from "../../src/core/season.js";

function simSeason(seed: number) {
  const rng = mulberry32(seed);
  return coreSimSeason(rng).table;
}

/**
 * Averaged over 20 seasons, not 5 — a precision fix to the estimator, with the
 * spec's bands left exactly where they were (2026-08-16).
 *
 * A single season's champion total has a standard deviation of about 5 points
 * (measured, `scripts/championPointsProbe.ts`: 20 seasons span 72-91). A
 * 5-season average therefore carries ~2.2 points of sampling error of its own,
 * against a true mean of ~82 sitting only ~1.8 of those from the 78 floor — so
 * this gate could fail on seed luck alone, with nothing at all wrong with the
 * sim. That is not hypothetical: raising YELLOW_GIVEN_FOUL 0.11 -> 0.18 read
 * 75.8 here, while the same change measured over 20 seasons moved the champion
 * mean *up*, 81.75 -> 82.20, and *reduced* its spread (sd 5.80 -> 4.66).
 *
 * Widening the band would have been the wrong fix — 78-94 is the spec's realism
 * target and it was never the thing that was wrong. Averaging more seasons cuts
 * the estimator's own error in half instead, which is what the assertion always
 * assumed it had. Same lesson as the M3 top-scorer and M1 "average team" gates:
 * fix the statistic, don't move the band.
 */
describe("M1 gate (b) — season table spread", () => {
  it("champion 78-94 pts and bottom 15-32 pts (averaged over 20 seeded seasons)", () => {
    let champSum = 0;
    let bottomSum = 0;
    const SEASONS = 20;
    for (let s = 0; s < SEASONS; s++) {
      const table = simSeason(1000 + s);
      champSum += table[0].points;
      bottomSum += table[table.length - 1].points;
    }
    const champ = champSum / SEASONS;
    const bottom = bottomSum / SEASONS;
    expect(champ).toBeGreaterThanOrEqual(78);
    expect(champ).toBeLessThanOrEqual(94);
    expect(bottom).toBeGreaterThanOrEqual(15);
    expect(bottom).toBeLessThanOrEqual(32);
  });
});
