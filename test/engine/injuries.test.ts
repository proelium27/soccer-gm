import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { makeTeam } from "../../src/engine/composites.js";
import { simMatchDetailed } from "../../src/engine/matchSim.js";
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
    heading: 45,
    stamina: 50,
    interceptions: pos === "CB" || pos === "DM" ? 70 : 40,
  }));
}

function makeBench(pidOffset: number): MatchPlayer[] {
  const positions: MatchPlayer["pos"][] = ["CB", "FB", "CM", "W", "ST", "AM", "DM"];
  return positions.map((pos, i) => ({
    pid: pidOffset + i + 1,
    pos,
    ovr: pos === "ST" ? 68 : 62,
    shooting: pos === "ST" ? 85 : 45,
    dribbling: 50,
    tackling: 50,
    keeping: 5,
    positioning: 55,
    heading: 45,
    stamina: 50,
    interceptions: 50,
  }));
}

describe("injuries", () => {
  it("an injured player is immediately replaced from the bench when one is available", () => {
    let injuryCount = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const rng = mulberry32(seed);
      const result = simMatchDetailed(
        rng, makeTeam("Home"), makeTeam("Away"),
        makeSquad(0), makeSquad(100), makeBench(1000), makeBench(2000),
      );
      const events = result.boxScore.events;
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (e.type !== "injury") continue;
        injuryCount++;
        const injuredPid = e.pids[0];
        // Should be followed immediately by a substitution taking the injured player off.
        const next = events[i + 1];
        expect(next.type).toBe("substitution");
        expect(next.pids[0]).toBe(injuredPid);
      }
    }
    expect(injuryCount).toBeGreaterThan(0);
  });

  it("does not crash when no bench is available for an injury", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = mulberry32(seed);
      expect(() =>
        simMatchDetailed(rng, makeTeam("Home"), makeTeam("Away"), makeSquad(0), makeSquad(100)),
      ).not.toThrow();
    }
  });
});
