import { describe, it, expect } from "vitest";
import { computeTeamForm, computePowerRankingSnapshot } from "../../src/core/teams/powerRanking.js";
import { computeTeamRating } from "../../src/core/teams/teamRating.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { generateLeague } from "../../src/core/league/generate.js";
import type { PlayedMatch } from "../../src/core/standings.js";
import type { StoredTeam } from "../../src/core/teams/clubs.js";

// computeTeamForm only reads home/away/homeGoals/awayGoals; the rest of PlayedMatch is irrelevant here.
function match(home: number, away: number, homeGoals: number, awayGoals: number): PlayedMatch {
  return { home, away, homeGoals, awayGoals } as unknown as PlayedMatch;
}

describe("computeTeamForm", () => {
  it("returns zeroed stats and no bonus for a team with no matches played", () => {
    const stats = computeTeamForm(1, 65, [], new Map());
    expect(stats).toEqual({ played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, performanceBonus: 0 });
  });

  it("ignores matches that don't involve the team", () => {
    const matches = [match(2, 3, 1, 0)];
    const stats = computeTeamForm(1, 65, matches, new Map([[2, 65], [3, 65]]));
    expect(stats.played).toBe(0);
  });

  it("gives a bigger bonus for beating a strong opponent than an equally-strong win over a weak one", () => {
    const ovrByTid = new Map([[1, 65], [2, 65], [3, 85]]);
    const beatWeak = computeTeamForm(1, 65, [match(1, 2, 2, 0)], ovrByTid);
    const beatStrong = computeTeamForm(1, 65, [match(1, 3, 2, 0)], ovrByTid);
    expect(beatStrong.performanceBonus).toBeGreaterThan(beatWeak.performanceBonus);
  });

  it("penalizes losing to a weak opponent more than losing to a strong one", () => {
    const ovrByTid = new Map([[1, 65], [2, 65], [3, 85]]);
    const lostToWeak = computeTeamForm(1, 65, [match(1, 2, 0, 2)], ovrByTid);
    const lostToStrong = computeTeamForm(1, 65, [match(1, 3, 0, 2)], ovrByTid);
    expect(lostToWeak.performanceBonus).toBeLessThan(lostToStrong.performanceBonus);
  });

  it("rewards a bigger margin of victory, up to the goal-difference cap", () => {
    const ovrByTid = new Map([[1, 65], [2, 65]]);
    const narrow = computeTeamForm(1, 65, [match(1, 2, 1, 0)], ovrByTid);
    const blowout = computeTeamForm(1, 65, [match(1, 2, 5, 0)], ovrByTid);
    const evenBigger = computeTeamForm(1, 65, [match(1, 2, 9, 0)], ovrByTid);
    expect(blowout.performanceBonus).toBeGreaterThan(narrow.performanceBonus);
    // Goal difference is capped, so a 9-0 counts the same as a 5-0.
    expect(evenBigger.performanceBonus).toBeCloseTo(blowout.performanceBonus, 5);
  });

  it("gives a positive bonus for outperforming an even OVR matchup and negative for underperforming it", () => {
    const ovrByTid = new Map([[1, 65], [2, 65]]);
    const win = computeTeamForm(1, 65, [match(1, 2, 2, 0)], ovrByTid);
    const loss = computeTeamForm(1, 65, [match(1, 2, 0, 2)], ovrByTid);
    expect(win.performanceBonus).toBeGreaterThan(0);
    expect(loss.performanceBonus).toBeLessThan(0);
  });

  it("tracks W-D-L and GF/GA/GD correctly across home and away matches", () => {
    const ovrByTid = new Map([[1, 65], [2, 65], [3, 65]]);
    const matches = [match(1, 2, 2, 1), match(3, 1, 0, 0), match(1, 2, 0, 3)];
    const stats = computeTeamForm(1, 65, matches, ovrByTid);
    expect(stats.played).toBe(3);
    expect(stats.won).toBe(1);
    expect(stats.drawn).toBe(1);
    expect(stats.lost).toBe(1);
    expect(stats.gf).toBe(2);
    expect(stats.ga).toBe(4);
    expect(stats.gd).toBe(-2);
  });

  it("falls back to the team's own OVR for an opponent missing from the map", () => {
    const withFallback = computeTeamForm(1, 65, [match(1, 2, 1, 1)], new Map());
    const withExplicitEqualOvr = computeTeamForm(1, 65, [match(1, 2, 1, 1)], new Map([[2, 65]]));
    expect(withFallback.performanceBonus).toBeCloseTo(withExplicitEqualOvr.performanceBonus, 10);
  });
});

describe("computePowerRankingSnapshot", () => {
  function makeFixture() {
    const league = generateLeague(mulberry32(7));
    // Only the fields the snapshot reads matter; the rest of StoredTeam is inert here.
    const teams = league.teams.map((t) => ({
      tid: t.tid,
      name: t.name,
      roster: t.roster,
      compId: t.compId,
      starters: null,
      formation: "4-3-3",
    })) as unknown as StoredTeam[];
    return { teams, players: league.players };
  }

  it("ranks every team exactly once, sorted by powerScore descending, and stamps season/matchday", () => {
    const { teams, players } = makeFixture();
    const snapshot = computePowerRankingSnapshot(teams, players, [], 3, 15);

    expect(snapshot.season).toBe(3);
    expect(snapshot.matchday).toBe(15);
    expect(snapshot.rows).toHaveLength(teams.length);
    expect(new Set(snapshot.rows.map((r) => r.tid)).size).toBe(teams.length);
    for (let i = 1; i < snapshot.rows.length; i++) {
      expect(snapshot.rows[i - 1].powerScore).toBeGreaterThanOrEqual(snapshot.rows[i].powerScore);
    }
  });

  it("with no matches played, powerScore equals the club's squad OVR and the record is zeroed", () => {
    const { teams, players } = makeFixture();
    const snapshot = computePowerRankingSnapshot(teams, players, [], 1, 5);

    const playerByPid = new Map(players.map((p) => [p.pid, p]));
    for (const row of snapshot.rows) {
      const team = teams.find((t) => t.tid === row.tid)!;
      const roster = team.roster.map((pid) => playerByPid.get(pid)!);
      expect(row.ovr).toBe(computeTeamRating(roster, null).ovr);
      expect(row.powerScore).toBe(row.ovr);
      expect(row.played).toBe(0);
      expect(row.performanceBonus).toBe(0);
    }
  });

  it("a win over an even-strength opponent lifts a club's powerScore above its raw OVR", () => {
    const { teams, players } = makeFixture();
    const winner = teams[0].tid;
    const loser = teams[1].tid;
    const snapshot = computePowerRankingSnapshot(
      teams, players, [match(winner, loser, 3, 0)], 1, 5,
    );

    const winnerRow = snapshot.rows.find((r) => r.tid === winner)!;
    const loserRow = snapshot.rows.find((r) => r.tid === loser)!;
    expect(winnerRow.powerScore).toBeGreaterThan(winnerRow.ovr);
    expect(winnerRow.won).toBe(1);
    expect(winnerRow.gd).toBe(3);
    expect(loserRow.powerScore).toBeLessThan(loserRow.ovr);
    expect(loserRow.lost).toBe(1);
  });

  it("records each club's competition at snapshot time", () => {
    const { teams, players } = makeFixture();
    const snapshot = computePowerRankingSnapshot(teams, players, [], 1, 5);
    for (const row of snapshot.rows) {
      expect(row.compId).toBe(teams.find((t) => t.tid === row.tid)!.compId);
    }
  });
});
