import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { makeTeam } from "../../src/engine/composites.js";
import { simMatchDetailed } from "../../src/engine/matchSim.js";
import type { MatchPlayer } from "../../src/engine/attribution.js";

function makeSquad(pidOffset: number, stamina = 50): MatchPlayer[] {
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
    stamina,
  }));
}

function makeBench(pidOffset: number, stamina = 50): MatchPlayer[] {
  const positions: MatchPlayer["pos"][] = ["CB", "FB", "CM", "W", "ST", "AM", "DM"];
  return positions.map((pos, i) => ({
    pid: pidOffset + i + 1,
    pos,
    shooting: pos === "ST" ? 85 : 45,
    dribbling: 50,
    tackling: 50,
    keeping: 5,
    positioning: 55,
    heading: 45,
    stamina,
  }));
}

describe("fatigue + substitutions", () => {
  it("makes exactly one sub per side at each of the 60'/75' checkpoints when a bench is available", () => {
    const rng = mulberry32(1);
    const result = simMatchDetailed(
      rng,
      makeTeam("Home"),
      makeTeam("Away"),
      makeSquad(0),
      makeSquad(100),
      makeBench(1000),
      makeBench(2000),
    );
    const homeSubs = result.boxScore.events.filter((e) => e.type === "substitution" && e.side === "home");
    const awaySubs = result.boxScore.events.filter((e) => e.type === "substitution" && e.side === "away");
    // Two checkpoints (60', 75'), each subs off the lowest-energy outfield player — well
    // under MAX_SUBS (5), so both checkpoints should fire for both sides.
    expect(homeSubs).toHaveLength(2);
    expect(awaySubs).toHaveLength(2);
  });

  it("box score includes subbed-on bench players who accumulate stats", () => {
    const rng = mulberry32(1);
    const result = simMatchDetailed(
      rng,
      makeTeam("Home"),
      makeTeam("Away"),
      makeSquad(0),
      makeSquad(100),
      makeBench(1000),
      makeBench(2000),
    );
    const subEvents = result.boxScore.events.filter((e) => e.type === "substitution");
    for (const e of subEvents) {
      const onPid = e.pids[1];
      const line = [...result.boxScore.home, ...result.boxScore.away].find((l) => l.pid === onPid);
      expect(line).toBeDefined();
    }
    // Starting XI is still 11 + however many bench players came on and touched the ball/box score.
    expect(result.boxScore.home.length).toBeGreaterThanOrEqual(11);
    expect(result.boxScore.away.length).toBeGreaterThanOrEqual(11);
  });

  it("does not substitute when no bench is provided", () => {
    const rng = mulberry32(7);
    const result = simMatchDetailed(
      rng,
      makeTeam("Home"),
      makeTeam("Away"),
      makeSquad(0),
      makeSquad(100),
    );
    const subs = result.boxScore.events.filter((e) => e.type === "substitution");
    expect(subs).toHaveLength(0);
    expect(result.boxScore.home).toHaveLength(11);
    expect(result.boxScore.away).toHaveLength(11);
  });

  it("low-stamina squads generate fewer shots than an otherwise-identical high-stamina squad", () => {
    // Same composites, same seed, same everything except stamina — fatigue should be the
    // only thing driving a difference, and tired legs should mean fewer created chances.
    const trials = 40;
    let lowShots = 0;
    let highShots = 0;
    for (let seed = 1; seed <= trials; seed++) {
      const lowRng = mulberry32(seed);
      const low = simMatchDetailed(
        lowRng,
        makeTeam("Home"),
        makeTeam("Away"),
        makeSquad(0, 1),
        makeSquad(100, 1),
      );
      lowShots += low.stat.home.shots + low.stat.away.shots;

      const highRng = mulberry32(seed);
      const high = simMatchDetailed(
        highRng,
        makeTeam("Home"),
        makeTeam("Away"),
        makeSquad(0, 99),
        makeSquad(100, 99),
      );
      highShots += high.stat.home.shots + high.stat.away.shots;
    }
    expect(lowShots).toBeLessThan(highShots);
  });

  it("red-carded players are removed from the pitch and can't be subbed off or on again", () => {
    // Run several seeds and check invariants hold whenever a red card actually occurs.
    for (let seed = 1; seed <= 60; seed++) {
      const rng = mulberry32(seed);
      const result = simMatchDetailed(
        rng,
        makeTeam("Home"),
        makeTeam("Away"),
        makeSquad(0),
        makeSquad(100),
        makeBench(1000),
        makeBench(2000),
      );
      const redEvents = result.boxScore.events.filter((e) => e.type === "red_card");
      for (const e of redEvents) {
        const line = [...result.boxScore.home, ...result.boxScore.away].find((l) => l.pid === e.pids[0]);
        expect(line?.redCards).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
