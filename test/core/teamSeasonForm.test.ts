import { describe, it, expect } from "vitest";
import { teamSeasonFormDelta, applySeasonForm } from "../../src/core/teamSeasonForm.js";
import { TEAM_SEASON_FORM_PROB, TEAM_SEASON_FORM_DELTA } from "../../src/core/constants.js";
import { makeTeam } from "../../src/engine/composites.js";

describe("teamSeasonFormDelta", () => {
  it("is deterministic for the same (lid, season, tid)", () => {
    for (let i = 0; i < 50; i++) {
      expect(teamSeasonFormDelta(1, 2030 + i, i)).toBe(teamSeasonFormDelta(1, 2030 + i, i));
    }
  });

  it("re-rolls across seasons — a club's swing is not permanent", () => {
    // Find a club-season with a swing, then check the same club is back to
    // normal (or at least differs) in some nearby season.
    let found = false;
    outer: for (let tid = 0; tid < 200; tid++) {
      for (let season = 2026; season < 2126; season++) {
        if (teamSeasonFormDelta(1, season, tid) !== 0) {
          const neighbors = [season + 1, season + 2, season + 3, season + 4].map(
            (s) => teamSeasonFormDelta(1, s, tid),
          );
          expect(neighbors.some((d) => d === 0)).toBe(true);
          found = true;
          break outer;
        }
      }
    }
    expect(found).toBe(true);
  });

  it("fires rarely and roughly symmetrically", () => {
    let dream = 0;
    let hell = 0;
    const N = 40_000;
    for (let i = 0; i < N; i++) {
      const d = teamSeasonFormDelta(7, 2026 + (i % 200), Math.floor(i / 200));
      if (d > 0) dream++;
      else if (d < 0) hell++;
    }
    const expected = N * TEAM_SEASON_FORM_PROB;
    // Within ±40% of the configured probability, each direction.
    expect(dream).toBeGreaterThan(expected * 0.6);
    expect(dream).toBeLessThan(expected * 1.4);
    expect(hell).toBeGreaterThan(expected * 0.6);
    expect(hell).toBeLessThan(expected * 1.4);
    // And the magnitude is always exactly ±TEAM_SEASON_FORM_DELTA or 0.
    for (let i = 0; i < 500; i++) {
      const d = teamSeasonFormDelta(7, 2026, i);
      expect([0, TEAM_SEASON_FORM_DELTA, -TEAM_SEASON_FORM_DELTA]).toContain(d);
    }
  });
});

describe("applySeasonForm", () => {
  it("returns the input unchanged for a zero delta", () => {
    const c = makeTeam("X", { attack: 0.6 });
    expect(applySeasonForm(c, 0)).toBe(c);
  });

  it("shifts every composite by the delta, clamped to the engine's range", () => {
    const c = makeTeam("X", { attack: 0.92, finishing: 0.5, defense: 0.06, keeping: 0.5, control: 0.5 });
    const up = applySeasonForm(c, TEAM_SEASON_FORM_DELTA);
    expect(up.attack).toBe(0.95); // clamped
    expect(up.finishing).toBeCloseTo(0.5 + TEAM_SEASON_FORM_DELTA);
    const down = applySeasonForm(c, -TEAM_SEASON_FORM_DELTA);
    expect(down.defense).toBe(0.05); // clamped
    expect(down.control).toBeCloseTo(0.5 - TEAM_SEASON_FORM_DELTA);
    // Never mutates the input.
    expect(c.attack).toBe(0.92);
  });
});
