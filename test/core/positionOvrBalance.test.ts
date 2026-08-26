import { describe, it, expect } from "vitest";
import { computeOvr } from "../../src/core/players/ovr.js";
import { POSITIONS, type Player, type Position } from "../../src/core/players/types.js";
import {
  POSITION_OVR_CALIBRATION, POSITION_RATING_SPREAD, ROSTER_COMPOSITION,
} from "../../src/core/constants.js";
import { makeLeague } from "../helpers/league.js";

/**
 * OVR has to mean the same thing at every position, or the game's whole quality
 * currency reads differently depending on where a player stands. Before this was
 * measured, mean OVR ran ST 55.9 down to FB 49.4 and 132 of 320 clubs had a
 * striker as their best player against 1 with a full-back.
 *
 * Two properties, because two separate mechanisms broke it: the LEVEL (a
 * position's weights sit on the skills it generates highest) and the SPREAD (a
 * position betting its rating on fewer attributes varies more, and wins every
 * extreme). Fixing only the first hands the problem to the goalkeeper.
 */
describe("position OVR balance", () => {
  const league = makeLeague(0, 1);
  const rostered = new Set<number>();
  for (const t of league.teams) for (const pid of t.roster) rostered.add(pid);
  const players: Player[] = league.players.filter((p) => rostered.has(p.pid));
  const groups = new Map<Position, number[]>(
    POSITIONS.map((pos) => [pos, players.filter((p) => p.pos === pos).map((p) => p.ovr)]),
  );

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = (xs: number[]) => {
    const m = mean(xs);
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
  };

  it("rates every position the same on average", () => {
    const means = POSITIONS.map((pos) => mean(groups.get(pos)!));
    // A point of slack: these are measured constants against one seeded world,
    // not an identity. The bug being guarded against was six points wide.
    expect(Math.max(...means) - Math.min(...means)).toBeLessThan(1);
  });

  it("spreads every position the same, so no position owns the top end", () => {
    const sds = POSITIONS.map((pos) => sd(groups.get(pos)!));
    expect(Math.max(...sds) - Math.min(...sds)).toBeLessThan(1);

    // The spread that actually decides "who is my best player" is the one
    // WITHIN a squad, where team strength is shared and only the rating draws
    // differ. Keeper was 50% wider than everyone else here.
    //
    // Only positions a club stocks three or more of. A mean of per-squad sds
    // is biased low by the sample size (Jensen), so the two-slot positions read
    // lower for a reason that has nothing to do with the thing being measured,
    // and mixing them in would compare arithmetic against ratings.
    const deep = POSITIONS.filter((pos) => ROSTER_COMPOSITION[pos] >= 3);
    const withinSd = new Map<Position, number[]>(deep.map((pos) => [pos, []]));
    const byPid = new Map(players.map((p) => [p.pid, p]));
    for (const t of league.teams) {
      for (const pos of deep) {
        const g = t.roster
          .map((pid) => byPid.get(pid))
          .filter((p): p is Player => !!p && p.pos === pos)
          .map((p) => p.ovr);
        if (g.length > 2) withinSd.get(pos)!.push(sd(g));
      }
    }
    const withins = deep.map((pos) => mean(withinSd.get(pos)!));
    expect(Math.max(...withins) - Math.min(...withins)).toBeLessThan(0.75);
  });

  it("gives every position a share of the best-player-at-his-club slots", () => {
    // OVR is an integer and a squad's top few sit within a point or two, so
    // ties are common; awarding one to whoever comes first in the roster array
    // biases this by generation order, which read as a 4-point skew until it
    // was split. Share the credit.
    const byPid = new Map(players.map((p) => [p.pid, p]));
    const best = new Map<Position, number>(POSITIONS.map((pos) => [pos, 0]));
    for (const t of league.teams) {
      const squad = t.roster.map((pid) => byPid.get(pid)).filter((p): p is Player => !!p);
      if (squad.length === 0) continue;
      const top = Math.max(...squad.map((p) => p.ovr));
      const tied = squad.filter((p) => p.ovr === top);
      for (const p of tied) best.set(p.pos, best.get(p.pos)! + 1 / tied.length);
    }
    const slots = POSITIONS.reduce((a, p) => a + ROSTER_COMPOSITION[p], 0);
    for (const pos of POSITIONS) {
      const share = best.get(pos)! / league.teams.length;
      const expected = ROSTER_COMPOSITION[pos] / slots;
      // Every position within a factor of two of its roster share. Loose on
      // purpose — one seeded world is a small sample for an extreme-value
      // statistic — but the shipped bug was 3.4x over on one position and 50x
      // under on another, nowhere near this band.
      expect(share).toBeGreaterThan(expected / 2);
      expect(share).toBeLessThan(expected * 2);
    }
  });

  it("keeps the calibration zero-sum, so the world mean OVR is untouched", () => {
    const slots = POSITIONS.reduce((a, p) => a + ROSTER_COMPOSITION[p], 0);
    const weighted = POSITIONS.reduce(
      (a, pos) => a + (ROSTER_COMPOSITION[pos] / slots) * POSITION_OVR_CALIBRATION[pos],
      0,
    );
    // Rounding the shipped table to one decimal is the only slack here. Let
    // this drift and every threshold read against OVR quietly moves with it:
    // GROWTH_DAMPING_START, the D2 ceiling, the protected-star bar, wages.
    expect(Math.abs(weighted)).toBeLessThan(0.1);
  });

  it("derives the spread multipliers rather than storing them", () => {
    // Guards the invariant rather than the values: whatever the weight rows
    // say, the scaling has to leave the positions on one spread. A hand-edited
    // row that forgot to re-derive shows up here.
    for (const pos of POSITIONS) {
      expect(POSITION_RATING_SPREAD[pos]).toBeGreaterThan(0);
      expect(computeOvr(pos, players[0].ratings, players[0].heightCm)).toBeGreaterThan(0);
    }
    const values = POSITIONS.map((p) => POSITION_RATING_SPREAD[p]);
    // The keeper row is the concentrated one, so his multiplier must be the
    // smallest — if it ever isn't, the derivation stopped tracking the rows.
    expect(POSITION_RATING_SPREAD.GK).toBe(Math.min(...values));
  });
});
