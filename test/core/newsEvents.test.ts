import { describe, it, expect } from "vitest";
import { playerGoalTotals, detectMatchdayNewsEvents } from "../../src/core/newsEvents.js";
import type { Player } from "../../src/core/players/types.js";
import type { PlayedMatch } from "../../src/core/standings.js";
import type { PlayerMatchLine } from "../../src/engine/attribution.js";

function line(overrides: Partial<PlayerMatchLine> & { pid: number }): PlayerMatchLine {
  return {
    goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, xg: 0, goalsAgainst: 0,
    xga: 0, saves: 0, tackles: 0, interceptions: 0, yellowCards: 0, redCards: 0,
    minutesPlayed: 90, rating: 6.0,
    ...overrides,
  };
}

function match(overrides: Partial<PlayedMatch>): PlayedMatch {
  return {
    home: 0, away: 1, homeGoals: 0, awayGoals: 0, possessionHome: 50, matchday: 1,
    boxScore: { home: [], away: [], events: [] },
    ...overrides,
  };
}

function makePlayer(pid: number, statsBySeasonGoals: [season: number, goals: number][]): Player {
  return {
    pid,
    stats: statsBySeasonGoals.map(([season, goals]) => ({
      season, goals, appearances: 0, assists: 0, shots: 0, shotsOnTarget: 0, xg: 0,
      goalsAgainst: 0, xga: 0, saves: 0, tackles: 0, interceptions: 0,
      minutesPlayed: 0, ratingSum: 0, avgRating: 0,
    })),
  } as unknown as Player;
}

describe("playerGoalTotals", () => {
  it("sums career goals across all seasons and isolates the current season's goals", () => {
    const players = [makePlayer(1, [[2025, 8], [2026, 4]])];
    const totals = playerGoalTotals(players, 2026);
    expect(totals.get(1)).toEqual({ season: 4, career: 12 });
  });

  it("defaults a player with no stats entry for the season to 0 season goals", () => {
    const players = [makePlayer(1, [[2025, 8]])];
    const totals = playerGoalTotals(players, 2026);
    expect(totals.get(1)).toEqual({ season: 0, career: 8 });
  });
});

describe("detectMatchdayNewsEvents — hat-tricks", () => {
  it("fires for a 3-goal match", () => {
    const md = [match({ boxScore: { home: [line({ pid: 1, goals: 3 })], away: [], events: [] } })];
    const events = detectMatchdayNewsEvents(md, 2026, 5, new Map(), new Map());
    expect(events).toContainEqual({ type: "hattrick", pid: 1, tid: 0, season: 2026, matchday: 5, detail: 3 });
  });

  it("does not fire for a 2-goal match", () => {
    const md = [match({ boxScore: { home: [line({ pid: 1, goals: 2 })], away: [], events: [] } })];
    const events = detectMatchdayNewsEvents(md, 2026, 5, new Map(), new Map());
    expect(events.some((e) => e.type === "hattrick")).toBe(false);
  });
});

describe("detectMatchdayNewsEvents — standout rating", () => {
  it("fires for the single highest rating at or above the floor", () => {
    const md = [match({
      boxScore: {
        home: [line({ pid: 1, rating: 8.0 }), line({ pid: 2, rating: 7.9 })],
        away: [line({ pid: 3, rating: 9.4 })],
        events: [],
      },
    })];
    const events = detectMatchdayNewsEvents(md, 2026, 5, new Map(), new Map());
    const standouts = events.filter((e) => e.type === "standoutRating");
    expect(standouts).toEqual([{ type: "standoutRating", pid: 3, tid: 1, season: 2026, matchday: 5, detail: 94 }]);
  });

  it("does not fire when the matchday's best rating is below the floor", () => {
    const md = [match({ boxScore: { home: [line({ pid: 1, rating: 7.9 })], away: [], events: [] } })];
    const events = detectMatchdayNewsEvents(md, 2026, 5, new Map(), new Map());
    expect(events.some((e) => e.type === "standoutRating")).toBe(false);
  });
});

describe("detectMatchdayNewsEvents — goal milestones", () => {
  it("fires a career milestone on an exact crossing", () => {
    const md = [match({ boxScore: { home: [line({ pid: 1, goals: 2 })], away: [], events: [] } })];
    const before = new Map([[1, { season: 3, career: 8 }]]);
    const after = new Map([[1, { season: 5, career: 10 }]]);
    const events = detectMatchdayNewsEvents(md, 2026, 5, before, after);
    expect(events).toContainEqual({ type: "goalMilestoneCareer", pid: 1, tid: 0, season: 2026, matchday: 5, detail: 10 });
  });

  it("fires when a hat-trick jumps the total past a multiple of 10 without landing on it (8 -> 11)", () => {
    const md = [match({ boxScore: { home: [line({ pid: 1, goals: 3 })], away: [], events: [] } })];
    const before = new Map([[1, { season: 3, career: 8 }]]);
    const after = new Map([[1, { season: 6, career: 11 }]]);
    const events = detectMatchdayNewsEvents(md, 2026, 5, before, after);
    expect(events).toContainEqual({ type: "goalMilestoneCareer", pid: 1, tid: 0, season: 2026, matchday: 5, detail: 10 });
  });

  it("fires both season and career milestones independently in the same match", () => {
    const md = [match({ boxScore: { home: [line({ pid: 1, goals: 2 })], away: [], events: [] } })];
    const before = new Map([[1, { season: 8, career: 18 }]]);
    const after = new Map([[1, { season: 10, career: 20 }]]);
    const events = detectMatchdayNewsEvents(md, 2026, 5, before, after);
    expect(events).toContainEqual({ type: "goalMilestoneSeason", pid: 1, tid: 0, season: 2026, matchday: 5, detail: 10 });
    expect(events).toContainEqual({ type: "goalMilestoneCareer", pid: 1, tid: 0, season: 2026, matchday: 5, detail: 20 });
  });

  it("does not fire when no multiple of 10 is crossed", () => {
    const md = [match({ boxScore: { home: [line({ pid: 1, goals: 1 })], away: [], events: [] } })];
    const before = new Map([[1, { season: 4, career: 14 }]]);
    const after = new Map([[1, { season: 5, career: 15 }]]);
    const events = detectMatchdayNewsEvents(md, 2026, 5, before, after);
    expect(events.some((e) => e.type.startsWith("goalMilestone"))).toBe(false);
  });
});
