import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generatePlayer } from "../../src/core/players/generate.js";
import { RATING_MIN, RATING_MAX, ABS_LOW_MAX } from "../../src/core/constants.js";
import { generateLeague, generateTwoDivisionLeague, generateWorld } from "../../src/core/league/generate.js";
import { NUM_TEAMS, NUM_TEAMS_D2 } from "../../src/core/constants.js";
import { worldCompetitions } from "../../src/core/competitions.js";

describe("generatePlayer", () => {
  it("returns a complete player with all ratings in range", () => {
    const p = generatePlayer(mulberry32(7), "ST", 55, 1, 20, 1);
    expect(p.pid).toBe(1);
    expect(p.pos).toBe("ST");
    expect(p.ovr).toBeGreaterThan(0);
    for (const v of Object.values(p.ratings)) {
      expect(v).toBeGreaterThanOrEqual(RATING_MIN);
      expect(v).toBeLessThanOrEqual(RATING_MAX);
    }
    expect(p.potential).toBeGreaterThanOrEqual(p.ovr);
  });
  it("is deterministic for a given seed", () => {
    const a = generatePlayer(mulberry32(9), "CB", 60, 3, 20, 1);
    const b = generatePlayer(mulberry32(9), "CB", 60, 3, 20, 1);
    expect(a).toEqual(b);
  });
  it("archetype holds: a generated ST out-finishes a generated CB on average", () => {
    let stFin = 0, cbFin = 0;
    for (let i = 0; i < 200; i++) {
      stFin += generatePlayer(mulberry32(1000 + i), "ST", 55, i, 20, 1).ratings.finishing;
      cbFin += generatePlayer(mulberry32(1000 + i), "CB", 55, i, 20, 1).ratings.finishing;
    }
    expect(stFin / 200).toBeGreaterThan(cbFin / 200 + 15);
  });
  it("position-exclusive stats stay low regardless of team quality", () => {
    // An elite-base striker still cannot keep goal.
    const elite = generatePlayer(mulberry32(3), "ST", 80, 1, 20, 1);
    expect(elite.ratings.goalkeeping).toBeLessThanOrEqual(ABS_LOW_MAX);
  });
});

describe("generateTwoDivisionLeague", () => {
  it("produces 40 teams: tids 0-19 division 0, tids 20-39 division 1", () => {
    const league = generateTwoDivisionLeague(mulberry32(42));
    expect(league.teams).toHaveLength(NUM_TEAMS + NUM_TEAMS_D2);
    for (const t of league.teams) {
      if (t.tid < NUM_TEAMS) expect(t.compId).toBe(0);
      else expect(t.compId).toBe(1);
    }
  });

  it("D2's strongest team is no stronger than D1's average team", () => {
    const league = generateTwoDivisionLeague(mulberry32(42));
    const d1 = league.teams.filter((t) => t.compId === 0);
    const d2 = league.teams.filter((t) => t.compId === 1);
    const avgOvr = (ts: typeof d1) => ts.reduce((s, t) => s + t.avgOvr, 0) / ts.length;
    const d1Avg = avgOvr(d1);
    const d2Best = Math.max(...d2.map((t) => t.avgOvr));
    expect(d2Best).toBeLessThanOrEqual(d1Avg + 0.5); // small tolerance for generation noise
  });

  it("D1 half is identical to plain generateLeague for the same seed", () => {
    const plain = generateLeague(mulberry32(42));
    const combined = generateTwoDivisionLeague(mulberry32(42));
    const d1FromCombined = combined.teams.filter((t) => t.compId === 0);
    expect(d1FromCombined.map((t) => t.roster)).toEqual(plain.teams.map((t) => t.roster));
  });
});

describe("generateWorld", () => {
  it("produces 160 teams across 8 competitions, 20 per competition", () => {
    const world = generateWorld(mulberry32(42));
    expect(world.teams).toHaveLength(160);
    for (const comp of worldCompetitions()) {
      expect(world.teams.filter((t) => t.compId === comp.id)).toHaveLength(20);
    }
  });

  it("assigns tid blocks in country order: England 0-39, Spain 40-79, Italy 80-119, Germany 120-159", () => {
    const world = generateWorld(mulberry32(42));
    const tidsFor = (compId: number) => world.teams.filter((t) => t.compId === compId).map((t) => t.tid);
    expect(Math.min(...tidsFor(0), ...tidsFor(1))).toBe(0);
    expect(Math.max(...tidsFor(0), ...tidsFor(1))).toBe(39);
    expect(Math.min(...tidsFor(2), ...tidsFor(3))).toBe(40);
    expect(Math.max(...tidsFor(2), ...tidsFor(3))).toBe(79);
    expect(Math.min(...tidsFor(4), ...tidsFor(5))).toBe(80);
    expect(Math.max(...tidsFor(4), ...tidsFor(5))).toBe(119);
    expect(Math.min(...tidsFor(6), ...tidsFor(7))).toBe(120);
    expect(Math.max(...tidsFor(6), ...tidsFor(7))).toBe(159);
  });

  it("has ~4000 players (160 teams x 25)", () => {
    const world = generateWorld(mulberry32(42));
    expect(world.players).toHaveLength(4000);
  });

  it("has unique pids across the whole world", () => {
    const world = generateWorld(mulberry32(42));
    const pids = world.players.map((p) => p.pid);
    expect(new Set(pids).size).toBe(pids.length);
  });

  it("England's block is byte-identical to generateTwoDivisionLeague for the same seed", () => {
    const world = generateWorld(mulberry32(9));
    const plain = generateTwoDivisionLeague(mulberry32(9));
    const englandFromWorld = world.teams.filter((t) => t.tid < 40);
    expect(englandFromWorld.map((t) => t.roster)).toEqual(plain.teams.map((t) => t.roster));
  });

  it("each country's tier-2 strongest team is no stronger than its own tier-1 average (equal-sibling generation)", () => {
    const world = generateWorld(mulberry32(42));
    for (const country of ["England", "Spain", "Italy", "Germany"]) {
      const comps = worldCompetitions().filter((c) => c.country === country);
      const d1 = world.teams.filter((t) => t.compId === comps.find((c) => c.tier === 1)!.id);
      const d2 = world.teams.filter((t) => t.compId === comps.find((c) => c.tier === 2)!.id);
      const d1Avg = d1.reduce((s, t) => s + t.avgOvr, 0) / d1.length;
      const d2Best = Math.max(...d2.map((t) => t.avgOvr));
      expect(d2Best).toBeLessThanOrEqual(d1Avg + 0.5);
    }
  });

  it("majority nationality among Spain's players is Spain more often than among England's players", () => {
    const world = generateWorld(mulberry32(42));
    const spainComp = worldCompetitions().find((c) => c.country === "Spain" && c.tier === 1)!;
    const englandComp = worldCompetitions().find((c) => c.country === "England" && c.tier === 1)!;
    const spainTids = new Set(world.teams.filter((t) => t.compId === spainComp.id).map((t) => t.tid));
    const englandTids = new Set(world.teams.filter((t) => t.compId === englandComp.id).map((t) => t.tid));
    const nationalityShare = (tids: Set<number>, nationality: string) => {
      const rosterPids = new Set(world.teams.filter((t) => tids.has(t.tid)).flatMap((t) => t.roster));
      const players = world.players.filter((p) => rosterPids.has(p.pid));
      return players.filter((p) => p.nationality === nationality).length / players.length;
    };
    expect(nationalityShare(spainTids, "Spain")).toBeGreaterThan(nationalityShare(englandTids, "Spain"));
  });
});
