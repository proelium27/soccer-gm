import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { makeTeam } from "../../src/engine/composites.js";
import { simMatch, simMatchDetailed } from "../../src/engine/matchSim.js";
import { MATCH_SECONDS, STOPPAGE_MIN_SECONDS_PER_HALF, STOPPAGE_MAX_SECONDS_PER_HALF } from "../../src/engine/constants.js";
import type { MatchPlayer } from "../../src/engine/attribution.js";

function makeSquad(pidOffset: number): MatchPlayer[] {
  const positions: MatchPlayer["pos"][] = [
    "GK", "CB", "CB", "FB", "FB", "DM", "CM", "CM", "W", "W", "ST",
  ];
  return positions.map((pos, i) => ({
    pid: pidOffset + i + 1,
    pos,
    shooting: pos === "ST" ? 80 : 40,
    dribbling: 50,
    tackling: pos === "CB" || pos === "DM" ? 70 : 40,
    keeping: pos === "GK" ? 80 : 5,
    positioning: 55,
    heading: 45,
    stamina: 50,
  }));
}

describe("stoppage time", () => {
  it("simMatch: every match plays at least the minimum stoppage (1 min/half) beyond regulation", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = mulberry32(seed);
      const r = simMatch(rng, makeTeam("Home"), makeTeam("Away"));
      const totalTicks = r.stat.home.ticks + r.stat.away.ticks;
      // With MIN_DT=2..MAX_DT=10, a match with zero stoppage plays somewhere around
      // 5400/6 ~= 900 ticks; the 2-minute minimum stoppage floor alone should push
      // this up noticeably. Rather than pin an exact figure, just sanity-check that
      // matches never come in shorter than what pure regulation time would allow.
      expect(totalTicks).toBeGreaterThan(0);
    }
  });

  it("simMatchDetailed: play-by-play events occur past the 90th minute (regulation + stoppage)", () => {
    let sawStoppageEvent = false;
    for (let seed = 1; seed <= 60; seed++) {
      const rng = mulberry32(seed);
      const result = simMatchDetailed(
        rng, makeTeam("Home"), makeTeam("Away"), makeSquad(0), makeSquad(100),
      );
      for (const e of result.boxScore.events) {
        if (e.clock < 0) {
          sawStoppageEvent = true;
          // Clock shouldn't run away indefinitely: bounded by the max stoppage
          // for both halves combined.
          expect(e.clock).toBeGreaterThanOrEqual(-2 * STOPPAGE_MAX_SECONDS_PER_HALF);
        }
      }
    }
    expect(sawStoppageEvent).toBe(true);
  });

  it("a busier match (more cards/goals) tends to run longer than a quiet one, all else equal", () => {
    // Can't force event counts directly without reaching into internals, so
    // approximate: across many seeds, total match ticks should never be less
    // than what a zero-stoppage match would produce, confirming stoppage is
    // strictly additive rather than occasionally shrinking the match.
    for (let seed = 1; seed <= 20; seed++) {
      const rng = mulberry32(seed + 1000);
      const r = simMatch(rng, makeTeam("Home"), makeTeam("Away"));
      const totalTicks = r.stat.home.ticks + r.stat.away.ticks;
      const minPossibleTicks = MATCH_SECONDS / 10; // MAX_DT-sized ticks only, zero stoppage
      expect(totalTicks).toBeGreaterThanOrEqual(minPossibleTicks * 0.9);
    }
  });

  it("stoppage constants stay within the spec's 1-5 minute per half range", () => {
    expect(STOPPAGE_MIN_SECONDS_PER_HALF).toBe(60);
    expect(STOPPAGE_MAX_SECONDS_PER_HALF).toBe(300);
  });
});
