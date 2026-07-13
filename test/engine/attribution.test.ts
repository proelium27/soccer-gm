import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { makeTeam } from "../../src/engine/composites.js";
import { simMatchDetailed } from "../../src/engine/matchSim.js";
import type { MatchPlayer } from "../../src/engine/attribution.js";
import { pickShooter, pickAssister, pickTackler, pickInterceptor } from "../../src/engine/attribution.js";

function makeSquad(pidOffset = 0): MatchPlayer[] {
  return [
    { pid: pidOffset + 1, pos: "GK", shooting: 10, dribbling: 10, tackling: 10, keeping: 80, positioning: 50, heading: 40, stamina: 60, interceptions: 10 },
    { pid: pidOffset + 2, pos: "CB", shooting: 20, dribbling: 30, tackling: 75, keeping: 5, positioning: 70, heading: 65, stamina: 60, interceptions: 75 },
    { pid: pidOffset + 3, pos: "CB", shooting: 15, dribbling: 25, tackling: 72, keeping: 5, positioning: 68, heading: 60, stamina: 60, interceptions: 72 },
    { pid: pidOffset + 4, pos: "FB", shooting: 25, dribbling: 50, tackling: 60, keeping: 5, positioning: 55, heading: 40, stamina: 60, interceptions: 60 },
    { pid: pidOffset + 5, pos: "FB", shooting: 30, dribbling: 55, tackling: 58, keeping: 5, positioning: 52, heading: 38, stamina: 60, interceptions: 58 },
    { pid: pidOffset + 6, pos: "DM", shooting: 35, dribbling: 45, tackling: 70, keeping: 5, positioning: 65, heading: 50, stamina: 60, interceptions: 70 },
    { pid: pidOffset + 7, pos: "CM", shooting: 50, dribbling: 60, tackling: 50, keeping: 5, positioning: 60, heading: 45, stamina: 60, interceptions: 50 },
    { pid: pidOffset + 8, pos: "CM", shooting: 55, dribbling: 62, tackling: 48, keeping: 5, positioning: 58, heading: 42, stamina: 60, interceptions: 48 },
    { pid: pidOffset + 9, pos: "W", shooting: 65, dribbling: 75, tackling: 25, keeping: 5, positioning: 55, heading: 35, stamina: 60, interceptions: 25 },
    { pid: pidOffset + 10, pos: "W", shooting: 60, dribbling: 70, tackling: 28, keeping: 5, positioning: 53, heading: 33, stamina: 60, interceptions: 28 },
    { pid: pidOffset + 11, pos: "ST", shooting: 82, dribbling: 65, tackling: 15, keeping: 5, positioning: 60, heading: 55, stamina: 60, interceptions: 15 },
  ];
}

describe("attribution helpers", () => {
  it("pickShooter favors strikers and wingers", () => {
    const rng = mulberry32(42);
    const squad = makeSquad();
    const picks = new Map<number, number>();
    for (let i = 0; i < 1000; i++) {
      const p = pickShooter(rng, squad);
      picks.set(p.pid, (picks.get(p.pid) ?? 0) + 1);
    }
    const stPicks = picks.get(11) ?? 0;
    const gkPicks = picks.get(1) ?? 0;
    expect(stPicks).toBeGreaterThan(100);
    expect(gkPicks).toBe(0);
  });

  it("pickTackler favors center-backs and defensive midfielders", () => {
    const rng = mulberry32(42);
    const squad = makeSquad();
    const picks = new Map<number, number>();
    for (let i = 0; i < 1000; i++) {
      const p = pickTackler(rng, squad);
      picks.set(p.pid, (picks.get(p.pid) ?? 0) + 1);
    }
    const cbPicks = (picks.get(2) ?? 0) + (picks.get(3) ?? 0);
    const stPicks = picks.get(11) ?? 0;
    expect(cbPicks).toBeGreaterThan(stPicks);
  });

  it("pickInterceptor favors center-backs and defensive midfielders, weighted by the interceptions rating", () => {
    const rng = mulberry32(42);
    const squad = makeSquad();
    const picks = new Map<number, number>();
    for (let i = 0; i < 1000; i++) {
      const p = pickInterceptor(rng, squad);
      picks.set(p.pid, (picks.get(p.pid) ?? 0) + 1);
    }
    const cbPicks = (picks.get(2) ?? 0) + (picks.get(3) ?? 0);
    const stPicks = picks.get(11) ?? 0;
    expect(cbPicks).toBeGreaterThan(stPicks);
  });

  it("pickInterceptor is driven by the interceptions rating, not tackling", () => {
    // Give a winger a much higher interceptions rating than a center-back's,
    // while keeping tackling the same as the base squad — pickInterceptor
    // should now favor the winger for interception credit even though
    // pickTackler still favors the center-back.
    const rng = mulberry32(7);
    const squad = makeSquad().map((p) =>
      p.pid === 9 ? { ...p, interceptions: 95 } : p,
    );
    const picks = new Map<number, number>();
    for (let i = 0; i < 2000; i++) {
      const p = pickInterceptor(rng, squad);
      picks.set(p.pid, (picks.get(p.pid) ?? 0) + 1);
    }
    const boostedWingerPicks = picks.get(9) ?? 0;
    const otherWingerPicks = picks.get(10) ?? 0;
    expect(boostedWingerPicks).toBeGreaterThan(otherWingerPicks * 2);
  });

  it("pickAssister returns null ~25% of the time", () => {
    const rng = mulberry32(42);
    const squad = makeSquad();
    let nullCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (pickAssister(rng, squad, 11) === null) nullCount++;
    }
    expect(nullCount).toBeGreaterThan(150);
    expect(nullCount).toBeLessThan(350);
  });
});

describe("simMatchDetailed", () => {
  it("produces box score lines for all players and events", () => {
    const rng = mulberry32(42);
    const home = makeTeam("Home");
    const away = makeTeam("Away");
    const result = simMatchDetailed(rng, home, away, makeSquad(0), makeSquad(100));

    expect(result.boxScore.home).toHaveLength(11);
    expect(result.boxScore.away).toHaveLength(11);
    expect(result.boxScore.events.length).toBeGreaterThan(0);

    const totalGoals = result.home + result.away;
    const goalEvents = result.boxScore.events.filter((e) => e.type === "goal");
    expect(goalEvents).toHaveLength(totalGoals);
  });

  it("player goals sum to team goals", () => {
    const rng = mulberry32(123);
    const home = makeTeam("Home");
    const away = makeTeam("Away");
    const result = simMatchDetailed(rng, home, away, makeSquad(0), makeSquad(100));

    const homeGoals = result.boxScore.home.reduce((s, l) => s + l.goals, 0);
    const awayGoals = result.boxScore.away.reduce((s, l) => s + l.goals, 0);
    expect(homeGoals).toBe(result.home);
    expect(awayGoals).toBe(result.away);
  });

  it("player shots sum to team shots", () => {
    const rng = mulberry32(456);
    const home = makeTeam("Home");
    const away = makeTeam("Away");
    const result = simMatchDetailed(rng, home, away, makeSquad(0), makeSquad(100));

    const homeShots = result.boxScore.home.reduce((s, l) => s + l.shots, 0);
    const awayShots = result.boxScore.away.reduce((s, l) => s + l.shots, 0);
    expect(homeShots).toBe(result.stat.home.shots);
    expect(awayShots).toBe(result.stat.away.shots);
  });

  it("GK accumulates saves", () => {
    const rng = mulberry32(789);
    const home = makeTeam("Home");
    const away = makeTeam("Away");
    const result = simMatchDetailed(rng, home, away, makeSquad(0), makeSquad(100));

    const homeGK = result.boxScore.home.find((l) => l.pid === 1)!;
    const awayGK = result.boxScore.away.find((l) => l.pid === 101)!;
    const totalSaves = homeGK.saves + awayGK.saves;
    const savedEvents = result.boxScore.events.filter((e) => e.type === "shot_saved");
    expect(totalSaves).toBe(savedEvents.length);
  });
});
