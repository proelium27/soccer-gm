import { describe, it, expect } from "vitest";
import { potentialFog, reconcileScoutingObserved } from "../../../src/core/scouting/potentialFog.js";
import { SCOUTING_SPEND_MAX, SCOUT_POT_CLEAR_SEASONS_MAX } from "../../../src/core/constants.js";

describe("potentialFog", () => {
  it("always brackets the true potential when fogged", () => {
    // Sweep a range of players/potentials/spends at tenure 0.
    for (let pid = 1; pid <= 200; pid++) {
      const pot = 40 + (pid % 55); // 40..94
      for (const spend of [0, SCOUTING_SPEND_MAX / 2, SCOUTING_SPEND_MAX]) {
        const fog = potentialFog(pot, pid, 1, null, spend);
        expect(fog.low).toBeLessThanOrEqual(pot);
        expect(fog.high).toBeGreaterThanOrEqual(pot);
        expect(fog.low).toBeLessThanOrEqual(fog.high);
      }
    }
  });

  it("is deterministic per (pid, season)", () => {
    const a = potentialFog(78, 42, 3, null, 0);
    const b = potentialFog(78, 42, 3, null, 0);
    expect(a).toEqual(b);
  });

  it("wobbles year to year (not identical across seasons)", () => {
    const seasons = [1, 2, 3, 4, 5].map((s) => potentialFog(78, 42, s, null, 0));
    const distinct = new Set(seasons.map((f) => `${f.low}-${f.high}`));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it("higher scouting spend narrows the band", () => {
    // Average band width over many players, low spend vs max spend, tenure 0.
    const widthAt = (spend: number) => {
      let total = 0;
      for (let pid = 1; pid <= 300; pid++) {
        const f = potentialFog(75, pid, 1, null, spend);
        total += f.high - f.low;
      }
      return total / 300;
    };
    expect(widthAt(SCOUTING_SPEND_MAX)).toBeLessThan(widthAt(0));
  });

  it("clears to the exact number once tenure reaches the clear horizon", () => {
    const observed = 1;
    const cleared = potentialFog(
      80, 7, observed + SCOUT_POT_CLEAR_SEASONS_MAX, observed, 0,
    );
    expect(cleared.known).toBe(true);
    expect(cleared.low).toBe(80);
    expect(cleared.high).toBe(80);
  });

  it("narrows monotonically as tenure grows on the user roster", () => {
    const observed = 1;
    const widths: number[] = [];
    for (let season = observed; season <= observed + SCOUT_POT_CLEAR_SEASONS_MAX; season++) {
      const f = potentialFog(75, 99, season, observed, 0);
      widths.push(f.high - f.low);
    }
    // Non-increasing, and ends at 0 (fully known).
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeLessThanOrEqual(widths[i - 1]);
    }
    expect(widths[widths.length - 1]).toBe(0);
  });

  it("higher spend clears an owned player sooner", () => {
    // One season after joining: with max spend the band should be tighter
    // (faster clearing) than with zero spend for the same tenure.
    const lowSpend = potentialFog(75, 12, 2, 1, 0);
    const highSpend = potentialFog(75, 12, 2, 1, SCOUTING_SPEND_MAX);
    expect(highSpend.high - highSpend.low).toBeLessThan(lowSpend.high - lowSpend.low);
  });

  it("treats a never-observed player as maximally fogged (tenure 0)", () => {
    const unowned = potentialFog(75, 5, 10, null, 0);
    const brandNew = potentialFog(75, 5, 10, 10, 0);
    expect(unowned).toEqual(brandNew);
  });
});

describe("reconcileScoutingObserved", () => {
  it("stamps new pids with the current season", () => {
    const next = reconcileScoutingObserved({}, [1, 2, 3], 5);
    expect(next).toEqual({ 1: 5, 2: 5, 3: 5 });
  });

  it("keeps the original observed season for players still present", () => {
    const next = reconcileScoutingObserved({ 1: 2 }, [1, 2], 5);
    expect(next[1]).toBe(2); // unchanged
    expect(next[2]).toBe(5); // newly stamped
  });

  it("drops players no longer on the roster (so a re-signing re-fogs)", () => {
    const next = reconcileScoutingObserved({ 1: 2, 9: 3 }, [1], 5);
    expect(next).toEqual({ 1: 2 });
    expect(next[9]).toBeUndefined();
  });
});
