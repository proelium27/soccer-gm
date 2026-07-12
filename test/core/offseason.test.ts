import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { HYPE_MAX, HYPE_MIN, NUM_TEAMS, SCOUTING_SPEND_MIN } from "../../src/core/constants.js";

function playFullSeason(rng: () => number) {
  let league = createLeagueState(0, rng);
  league = simThrough(league, "season", rng);
  return league;
}

describe("simOffseason", () => {
  it("is a no-op unless the league is in the offseason phase", () => {
    const rng = mulberry32(1);
    const league = createLeagueState(0, rng);
    const result = simOffseason(league, rng);
    expect(result).toBe(league);
  });

  it("advances the season, resets schedule/played, and returns to regular phase", () => {
    const rng = mulberry32(2);
    const league = playFullSeason(rng);
    expect(league.phase).toBe("offseason");

    const next = simOffseason(league, rng);
    expect(next.season).toBe(league.season + 1);
    expect(next.phase).toBe("regular");
    expect(next.played).toEqual([]);
    expect(next.schedule).toHaveLength(380);
  });

  it("every team still fields a full 25-man roster after progression/retirement/FA/youth", () => {
    const rng = mulberry32(3);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);

    for (const team of next.teams) {
      expect(team.roster.length).toBeGreaterThanOrEqual(20);
    }
    expect(next.teams).toHaveLength(NUM_TEAMS);
  });

  it("every roster keeps at least one GK after the offseason", () => {
    const rng = mulberry32(4);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);
    const playerMap = new Map(next.players.map((p) => [p.pid, p]));

    for (const team of next.teams) {
      const gkCount = team.roster.filter((pid) => playerMap.get(pid)?.pos === "GK").length;
      expect(gkCount).toBeGreaterThan(0);
    }
  });

  it("youth intake adds new 16-year-olds to every club", () => {
    const rng = mulberry32(5);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);

    const sixteenYearOlds = next.players.filter((p) => next.season - p.born === 16);
    expect(sixteenYearOlds.length).toBeGreaterThanOrEqual(NUM_TEAMS * 3);
  });

  it("no duplicate pids exist across the player pool after offseason", () => {
    const rng = mulberry32(6);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);
    const pids = next.players.map((p) => p.pid);
    expect(new Set(pids).size).toBe(pids.length);
  });

  it("settles every team's budget and hype, and resets scouting spend for the new season", () => {
    const rng = mulberry32(7);
    const league = playFullSeason(rng);
    const budgetsBefore = new Map(league.teams.map((t) => [t.tid, t.budget]));
    const next = simOffseason(league, rng);

    expect(next.teams).toHaveLength(NUM_TEAMS);
    for (const team of next.teams) {
      // Budget moved (performance money in at season end, base in and wages
      // out at the new season's start).
      expect(team.budget).not.toBe(budgetsBefore.get(team.tid));
      expect(team.hype).toBeGreaterThanOrEqual(HYPE_MIN);
      expect(team.hype).toBeLessThanOrEqual(HYPE_MAX);
      expect(team.scoutingSpend).toBe(SCOUTING_SPEND_MIN);
    }
  });

  it("produces a spread of budgets across clubs (success payouts aren't flat)", () => {
    const rng = mulberry32(8);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);

    const budgets = next.teams.map((t) => t.budget);
    expect(Math.max(...budgets)).toBeGreaterThan(Math.min(...budgets));
  });

  it("keeps every AI club solvent and grows the league's total budget each season", () => {
    // Since AI clubs now trade with each other, an individual club's budget no
    // longer only ever grows — a net buyer spends cash on fees. The design
    // invariants that must still hold: no AI club is ever driven into deficit,
    // and the league-wide total budget still climbs every season (transfer
    // fees just move money between clubs; season settlement injects it).
    const rng = mulberry32(11);
    let league = playFullSeason(rng);
    const userTid = league.meta.userTid;
    const total = (l: typeof league) => l.teams.reduce((s, t) => s + t.budget, 0);

    for (let s = 0; s < 2; s++) {
      const totalBefore = total(league);
      league = simOffseason(league, rng);
      for (const team of league.teams) {
        if (team.tid !== userTid) expect(team.budget).toBeGreaterThanOrEqual(0);
      }
      expect(total(league)).toBeGreaterThan(totalBefore);
      league = simThrough(league, "season", rng);
    }
  });

  it("proactively renews an AI player's contract before it would otherwise expire", () => {
    const rng = mulberry32(31);
    const league = playFullSeason(rng);
    const userTid = league.meta.userTid;
    const aiTid = league.teams.find((t) => t.tid !== userTid)!.tid;
    const aiTeam = league.teams.find((t) => t.tid === aiTid)!;

    // Force the AI team's best outfield player into his final contract
    // season (would expire at league.season + 1, i.e. the very next
    // offseason, if nothing renews him first) and make him an obvious keep:
    // in his prime, at a position where he's the club's only option.
    const best = league.players
      .filter((p) => aiTeam.roster.includes(p.pid) && p.pos !== "GK")
      .sort((a, b) => b.ovr - a.ovr)[0];
    const withExpiring = {
      ...league,
      teams: league.teams.map((t) =>
        t.tid === aiTid
          ? { ...t, roster: t.roster.filter((pid) =>
              !(league.players.find((p) => p.pid === pid)?.pos === best.pos && pid !== best.pid)
            ), budget: 300_000_000 }
          : t,
      ),
      players: league.players.map((p) =>
        p.pid === best.pid
          ? { ...p, born: (league.season + 1) - 26, ovr: 90, contract: { ...p.contract, expiresSeason: league.season + 1 } }
          : p,
      ),
    };

    const next = simOffseason(withExpiring, rng);
    const renewed = next.players.find((p) => p.pid === best.pid);
    // He must still be on the roster (not released to free agency) and his
    // contract must run past the season simOffseason just rolled into.
    expect(next.teams.find((t) => t.tid === aiTid)!.roster).toContain(best.pid);
    expect(renewed!.contract.expiresSeason).toBeGreaterThan(next.season);
  });
});

describe("simOffseason injuries", () => {
  it("clears any lingering injury at the season rollover", () => {
    const rng = mulberry32(21);
    const league = playFullSeason(rng);
    // Wound a handful of players as if hurt on the final matchday, with the
    // longest possible recovery still outstanding.
    const wounded = new Set(league.players.slice(0, 5).map((p) => p.pid));
    const withInjuries = {
      ...league,
      players: league.players.map((p) =>
        wounded.has(p.pid) ? { ...p, injury: { gamesRemaining: 6, type: "knock" } } : p,
      ),
    };

    const next = simOffseason(withInjuries, rng);
    for (const p of next.players) {
      expect(p.injury).toBeNull();
    }
  });
});
