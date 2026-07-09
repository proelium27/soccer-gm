import { describe, it, expect } from "vitest";
import {
  doubleRoundRobin,
  generateSchedule,
} from "../../src/core/schedule.js";

/* ------------------------------------------------------------------ */
/*  Legacy doubleRoundRobin (kept for backward compatibility)         */
/* ------------------------------------------------------------------ */
describe("doubleRoundRobin", () => {
  it("for 20 teams yields 380 fixtures, 38 per team", () => {
    const fixtures = doubleRoundRobin(Array.from({ length: 20 }, (_, i) => i));
    expect(fixtures).toHaveLength(380);
    for (let t = 0; t < 20; t++) {
      const played = fixtures.filter((f) => f.home === t || f.away === t);
      expect(played).toHaveLength(38);
    }
  });
  it("every ordered pair appears exactly once (home and away)", () => {
    const fixtures = doubleRoundRobin([0, 1, 2]);
    const keys = fixtures.map((f) => `${f.home}-${f.away}`).sort();
    expect(keys).toEqual(["0-1", "0-2", "1-0", "1-2", "2-0", "2-1"]);
  });
});

/* ------------------------------------------------------------------ */
/*  generateSchedule – matchday-grouped circle-method scheduler       */
/* ------------------------------------------------------------------ */
describe("generateSchedule", () => {
  const teamIds = Array.from({ length: 20 }, (_, i) => i);
  const schedule = generateSchedule(teamIds);

  it("produces exactly 380 games", () => {
    expect(schedule).toHaveLength(380);
  });

  it("has 38 matchdays with exactly 10 games each", () => {
    const byMatchday = new Map<number, number>();
    for (const g of schedule) {
      byMatchday.set(g.matchday, (byMatchday.get(g.matchday) ?? 0) + 1);
    }
    expect(byMatchday.size).toBe(38);
    for (let md = 1; md <= 38; md++) {
      expect(byMatchday.get(md)).toBe(10);
    }
  });

  it("no team plays twice in the same matchday", () => {
    for (let md = 1; md <= 38; md++) {
      const games = schedule.filter((g) => g.matchday === md);
      const teams = games.flatMap((g) => [g.home, g.away]);
      expect(new Set(teams).size).toBe(teams.length);
    }
  });

  it("every ordered pair (A home, B away) appears exactly once", () => {
    const seen = new Set<string>();
    for (const g of schedule) {
      const key = `${g.home}-${g.away}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(380);
  });

  it("works for a small even number of teams (4)", () => {
    const small = generateSchedule([10, 20, 30, 40]);
    // 4 teams: 3 rounds * 2 halves = 6 matchdays, 2 games each = 12 total
    expect(small).toHaveLength(12);
    const matchdays = new Set(small.map((g) => g.matchday));
    expect(matchdays.size).toBe(6);
  });

  it("throws for an odd number of teams", () => {
    expect(() => generateSchedule([1, 2, 3])).toThrow();
  });
});
