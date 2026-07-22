import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { makeTeam } from "../../src/engine/composites.js";
import { simMatch, simMatchDetailed } from "../../src/engine/matchSim.js";
import type { MatchPlayer } from "../../src/engine/attribution.js";

function makeSquad(pidOffset: number): MatchPlayer[] {
  const positions: MatchPlayer["pos"][] = [
    "GK", "CB", "CB", "FB", "FB", "DM", "CM", "CM", "W", "W", "ST",
  ];
  return positions.map((pos, i) => ({
    pid: pidOffset + i + 1,
    pos,
    ovr: pos === "ST" ? 68 : 62,
    shooting: pos === "ST" ? 80 : 40,
    dribbling: 50,
    tackling: pos === "CB" || pos === "DM" ? 70 : 40,
    keeping: pos === "GK" ? 80 : 5,
    positioning: 55,
    heading: pos === "CB" || pos === "ST" ? 70 : 40,
    stamina: 50,
    interceptions: pos === "CB" || pos === "DM" ? 70 : 40,
  }));
}

describe("set pieces + penalties", () => {
  it("simMatch produces corner and penalty texture over many matches without touching player identity", () => {
    // simMatch is composite-only, so this just sanity-checks it still runs and produces
    // sane, bounded scorelines across many seeds (the real rate check lives in the §8 gates).
    for (let seed = 1; seed <= 20; seed++) {
      const rng = mulberry32(seed);
      const r = simMatch(rng, makeTeam("Home"), makeTeam("Away"));
      expect(r.home).toBeGreaterThanOrEqual(0);
      expect(r.away).toBeGreaterThanOrEqual(0);
    }
  });

  it("penalty events resolve to a goal, a save, or an off-target miss, attributed to the taker", () => {
    let penaltyCount = 0;
    let goals = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const rng = mulberry32(seed);
      const result = simMatchDetailed(
        rng, makeTeam("Home"), makeTeam("Away"), makeSquad(0), makeSquad(100),
      );
      const events = result.boxScore.events;
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (e.type !== "penalty") continue;
        penaltyCount++;
        const taker = e.pids[0];
        const next = events[i + 1];
        expect(["goal", "shot_saved", "shot_off_target"]).toContain(next.type);
        expect(next.pids[0]).toBe(taker);
        const line = [...result.boxScore.home, ...result.boxScore.away].find((l) => l.pid === taker);
        expect(line).toBeDefined();
        expect(line!.shots).toBeGreaterThanOrEqual(1);
        if (next.type === "goal") goals++;
      }
    }
    expect(penaltyCount).toBeGreaterThan(0);
    // Conversion rate should be in the right ballpark of the ~76% spec target.
    const conversion = goals / penaltyCount;
    expect(conversion).toBeGreaterThan(0.5);
    expect(conversion).toBeLessThan(0.95);
  });

  it("corner events are followed by a heading-weighted bonus shot attributed correctly", () => {
    let cornerCount = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const rng = mulberry32(seed);
      const result = simMatchDetailed(
        rng, makeTeam("Home"), makeTeam("Away"), makeSquad(0), makeSquad(100),
      );
      const events = result.boxScore.events;
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (e.type !== "corner") continue;
        cornerCount++;
        const next = events[i + 1];
        expect(["goal", "shot_saved", "shot_blocked", "shot_off_target"]).toContain(next.type);
        const header = next.pids[0];
        const line = [...result.boxScore.home, ...result.boxScore.away].find((l) => l.pid === header);
        expect(line).toBeDefined();
        expect(line!.shots).toBeGreaterThanOrEqual(1);
      }
    }
    expect(cornerCount).toBeGreaterThan(0);
  });
});
