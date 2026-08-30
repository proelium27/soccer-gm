import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { makeTeam } from "../../src/engine/composites.js";
import { simMatchDetailed } from "../../src/engine/matchSim.js";
import type { MatchPlayer } from "../../src/engine/attribution.js";

/**
 * `SimMatchOptions.neutral` — the flag the promotion playoff final uses to play
 * at Wembley, where neither finalist is at home.
 *
 * Two identical sides are the whole test: any difference between their goal
 * totals over many seeded matches can only be the home bonus, since nothing
 * else distinguishes them.
 */
function makeSquad(pidOffset: number): MatchPlayer[] {
  const positions: MatchPlayer["pos"][] = [
    "GK", "CB", "CB", "FB", "FB", "DM", "CM", "CM", "W", "W", "ST",
  ];
  return positions.map((pos, i) => ({
    pid: pidOffset + i + 1,
    pos,
    slot: pos,
    secondary: [],
    ovr: 65,
    shooting: 55,
    dribbling: 50,
    tackling: 50,
    keeping: pos === "GK" ? 70 : 5,
    positioning: 55,
    heading: 45,
    stamina: 50,
    interceptions: 50,
    passing: 50,
  }));
}

const MATCHES = 400;

/** Total goals each side scores over `MATCHES` seeded matches between equal teams. */
function aggregate(neutral: boolean): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (let seed = 1; seed <= MATCHES; seed++) {
    const result = simMatchDetailed(
      mulberry32(seed),
      makeTeam("Home"), makeTeam("Away"),
      makeSquad(0), makeSquad(100), [], [],
      neutral ? { neutral: true } : {},
    );
    home += result.home;
    away += result.away;
  }
  return { home, away };
}

describe("neutral venue", () => {
  it("gives the home side an edge by default and takes it away when neutral", () => {
    const normal = aggregate(false);
    const neutral = aggregate(true);

    // With the bonus, two identical sides are not identical: home outscores away.
    expect(normal.home).toBeGreaterThan(normal.away);

    // Without it they are, so whatever edge is left is sampling noise. The gap
    // must be a fraction of the one the bonus produces — asserted relative to
    // that gap rather than as a fixed number, so a retune of
    // HOME_ATTACK_BONUS moves both sides of the comparison together.
    const normalGap = normal.home - normal.away;
    const neutralGap = Math.abs(neutral.home - neutral.away);
    expect(neutralGap).toBeLessThan(normalGap / 2);
  });

  it("leaves every ordinary match bit-identical, since the flag is off by default", () => {
    // The guarantee the whole change rests on: `neutral` alters a composite
    // value, never a draw, so omitting it and passing false are the same match.
    // (The league-wide version of this is the touchStats scoreline hash, which
    // did not move.)
    for (let seed = 1; seed <= 25; seed++) {
      const omitted = simMatchDetailed(
        mulberry32(seed), makeTeam("Home"), makeTeam("Away"),
        makeSquad(0), makeSquad(100), [], [],
      );
      const explicit = simMatchDetailed(
        mulberry32(seed), makeTeam("Home"), makeTeam("Away"),
        makeSquad(0), makeSquad(100), [], [],
        { neutral: false },
      );
      expect(explicit.home).toBe(omitted.home);
      expect(explicit.away).toBe(omitted.away);
    }
  });
});
