import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generatePlayer } from "../../src/core/players/generate.js";
import { RATING_MIN, RATING_MAX, ABS_LOW_MAX } from "../../src/core/constants.js";
import { generateLeague, generateTwoDivisionLeague } from "../../src/core/league/generate.js";
import { NUM_TEAMS, NUM_TEAMS_D2 } from "../../src/core/constants.js";

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
      if (t.tid < NUM_TEAMS) expect(t.division).toBe(0);
      else expect(t.division).toBe(1);
    }
  });

  it("D2's strongest team is no stronger than D1's average team", () => {
    const league = generateTwoDivisionLeague(mulberry32(42));
    const d1 = league.teams.filter((t) => t.division === 0);
    const d2 = league.teams.filter((t) => t.division === 1);
    const avgOvr = (ts: typeof d1) => ts.reduce((s, t) => s + t.avgOvr, 0) / ts.length;
    const d1Avg = avgOvr(d1);
    const d2Best = Math.max(...d2.map((t) => t.avgOvr));
    expect(d2Best).toBeLessThanOrEqual(d1Avg + 0.5); // small tolerance for generation noise
  });

  it("D1 half is identical to plain generateLeague for the same seed", () => {
    const plain = generateLeague(mulberry32(42));
    const combined = generateTwoDivisionLeague(mulberry32(42));
    const d1FromCombined = combined.teams.filter((t) => t.division === 0);
    expect(d1FromCombined.map((t) => t.roster)).toEqual(plain.teams.map((t) => t.roster));
  });
});
