import { describe, expect, it } from "vitest";
import { archiveCup } from "../../src/core/cup/archive.js";
import {
  aggregateCupStats,
  cupStatsForPlayer,
  cupStatsBySeasonForPlayer,
} from "../../src/core/cup/cupStats.js";
import type { CupState } from "../../src/core/cup/types.js";

/**
 * A box-score line with only the fields the cup aggregate reads.
 */
function line(pid: number, over: Partial<Record<string, number>> = {}) {
  return {
    pid, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, saves: 0,
    goalsAgainst: 0, tackles: 0, interceptions: 0, minutesPlayed: 90,
    ...over,
  };
}

/**
 * A cup with one player (pid 1) appearing in all three stages, so the
 * under-count fix is directly observable: the old code summed only `ties`.
 */
function cupWithAllStages(): CupState {
  const box = (pids: ReturnType<typeof line>[]) =>
    ({ home: pids, away: [], events: [] });
  return {
    season: 4,
    name: "Cup",
    teams: [],
    seeds: {},
    leaguePhase: {
      teams: [1, 2],
      matches: [
        { round: 0, matchday: 3, home: 1, away: 2, played: true, homeGoals: 1, awayGoals: 0, boxScore: box([line(1, { goals: 1 })]) },
        { round: 1, matchday: 7, home: 1, away: 2, played: true, homeGoals: 2, awayGoals: 2, boxScore: box([line(1, { goals: 2 })]) },
      ],
    },
    playoff: {
      teams: [], slots: [], matchday: 27,
      ties: [{
        round: 0, matchday: 27, home: 1, away: 2, homeGoals: 1, awayGoals: 0,
        wentToExtraTime: false, wentToPens: false, homePens: 0, awayPens: 0,
        winner: 1, boxScore: box([line(1, { goals: 1 })]),
      }],
    },
    playIn: null,
    ties: [{
      round: 0, matchday: 29, home: 1, away: 2, homeGoals: 3, awayGoals: 1,
      wentToExtraTime: false, wentToPens: false, homePens: 0, awayPens: 0,
      winner: 1, boxScore: box([line(1, { goals: 3 })]),
    }],
    championTid: 1,
    twoLegged: true,
    koLegs: null,
    statLines: null,
  } as unknown as CupState;
}

describe("aggregateCupStats", () => {
  it("counts every stage, not just the knockout ties", () => {
    const cup = cupWithAllStages();
    const lines = aggregateCupStats(cup);
    expect(lines).toHaveLength(1);
    const l = lines[0];
    // 2 group games + 1 playoff + 1 knockout tie.
    expect(l.appearances).toBe(4);
    expect(l.goals).toBe(1 + 2 + 1 + 3);
    expect(l.minutesPlayed).toBe(360);
  });
});

describe("archiveCup", () => {
  it("drops every stage's box scores but keeps the scorelines", () => {
    const archived = archiveCup(cupWithAllStages());

    expect(archived.leaguePhase!.matches.every((m) => m.boxScore === null)).toBe(true);
    expect(archived.playoff!.ties.every((t) => t.boxScore === null)).toBe(true);
    expect(archived.ties.every((t) => t.boxScore === null)).toBe(true);

    // Everything the UI draws survives.
    expect(archived.leaguePhase!.matches[0].homeGoals).toBe(1);
    expect(archived.ties[0].homeGoals).toBe(3);
    expect(archived.ties[0].winner).toBe(1);
    expect(archived.championTid).toBe(1);
  });

  it("keeps the player's stats readable after the box scores are gone", () => {
    const before = cupStatsForPlayer(cupWithAllStages(), 1);
    const after = cupStatsForPlayer(archiveCup(cupWithAllStages()), 1);
    expect(after).toEqual(before);
    expect(after.appearances).toBe(4);
    expect(after.goals).toBe(7);
  });

  it("is idempotent", () => {
    const once = archiveCup(cupWithAllStages());
    const twice = archiveCup(once);
    expect(twice.statLines).toEqual(once.statLines);
  });

  it("aggregates whatever survives on a partly-stripped cup", () => {
    // A save whose league-phase box scores were already dropped by an earlier
    // version still gets its remaining stages captured, rather than nothing.
    const cup = cupWithAllStages();
    cup.leaguePhase!.matches = cup.leaguePhase!.matches.map((m) => ({ ...m, boxScore: null }));
    const archived = archiveCup(cup);
    const l = archived.statLines!.find((x) => x.pid === 1)!;
    expect(l.appearances).toBe(2); // playoff + knockout only
    expect(l.goals).toBe(4);
  });

  it("reports nothing for a player who never featured", () => {
    const archived = archiveCup(cupWithAllStages());
    expect(cupStatsForPlayer(archived, 999).appearances).toBe(0);
  });

  it("omits seasons a player sat out of the by-season list", () => {
    const archived = archiveCup(cupWithAllStages());
    expect(cupStatsBySeasonForPlayer(null, [archived], 1)).toHaveLength(1);
    expect(cupStatsBySeasonForPlayer(null, [archived], 999)).toHaveLength(0);
  });
});
