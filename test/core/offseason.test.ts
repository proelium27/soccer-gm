import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { computeStandings } from "../../src/core/standings.js";
import { isFreeAgentTid } from "../../src/core/transfers/negotiation.js";
import {
  HYPE_MAX, HYPE_MIN, NUM_TEAMS, NUM_TEAMS_D2, SCOUTING_SPEND_DEFAULT, ROSTER_SAFETY_FLOOR,
} from "../../src/core/constants.js";

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
    expect(next.schedule).toHaveLength(4560);
  });

  it("every team stays at or above the roster safety floor after progression/retirement/FA/youth", () => {
    const rng = mulberry32(3);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);

    // AI clubs now buy and sell in the transfer market, so a squad isn't
    // pinned to the 25-man composition anymore — ROSTER_SAFETY_FLOOR (the
    // same invariant runAITransferMarket enforces per-sale and the user's
    // own academy emergency call-up targets) is the real floor, not a fixed
    // squad size.
    for (const team of next.teams) {
      expect(team.roster.length).toBeGreaterThanOrEqual(ROSTER_SAFETY_FLOOR);
    }
    expect(next.teams).toHaveLength(6 * (NUM_TEAMS + NUM_TEAMS_D2));
  });

  it("swaps 3 up / 3 down between divisions and records pre-swap compsByTid", () => {
    const rng = mulberry32(6);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);

    const history = next.seasonHistory.at(-1)!;
    const d1Before = Object.values(history.compsByTid).filter((d) => d === 0).length;
    const d2Before = Object.values(history.compsByTid).filter((d) => d === 1).length;
    expect(d1Before).toBe(20);
    expect(d2Before).toBe(20);

    // Still 20-and-20 after the swap (composition changed, counts didn't).
    const d1After = next.teams.filter((t) => t.compId === 0).length;
    const d2After = next.teams.filter((t) => t.compId === 1).length;
    expect(d1After).toBe(20);
    expect(d2After).toBe(20);
  });

  it("stores per-competition awards on seasonHistory", () => {
    const rng = mulberry32(7);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);
    const history = next.seasonHistory.at(-1)!;
    expect(Object.keys(history.awards)).toHaveLength(next.competitions.length);
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

  it("routes the user's youth intake to the academy, not straight to the roster", () => {
    const rng = mulberry32(5);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);

    const userTeam = next.teams.find((t) => t.tid === next.meta.userTid)!;
    const academyYouth = userTeam.academyRoster.filter((pid) => {
      const p = next.players.find((q) => q.pid === pid);
      return p && next.season - p.born === 16;
    });
    expect(academyYouth.length).toBeGreaterThan(0);
  });

  it("still lands AI clubs' youth intake straight on the senior roster", () => {
    const rng = mulberry32(5);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);

    const aiTeams = next.teams.filter((t) => t.tid !== next.meta.userTid);
    for (const t of aiTeams) expect(t.academyRoster).toEqual([]);
    // Some youth get trimmed back out immediately by trimRosterSurplus if a
    // club was already at target depth, so check across all AI clubs rather
    // than any single one.
    const sixteenYearOlds = aiTeams.flatMap((t) => t.roster).filter((pid) => {
      const p = next.players.find((q) => q.pid === pid);
      return p && next.season - p.born === 16;
    });
    expect(sixteenYearOlds.length).toBeGreaterThan(0);
  });

  it("records every AI free-agent arrival as a fee-0 transfer from the sentinel", () => {
    const rng = mulberry32(31);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);

    const logged = next.transfers.filter(
      (t) => t.season === next.season && isFreeAgentTid(t.fromTid),
    );
    // AI clubs fill holes from the free pool every offseason, so there is
    // always some; each one must be free and land at a real club.
    expect(logged.length).toBeGreaterThan(0);
    for (const t of logged) {
      expect(t.fee).toBe(0);
      expect(next.teams.some((team) => team.tid === t.toTid)).toBe(true);
    }
  });

  it("logs no free signing for a player the same offseason then dropped again", () => {
    const rng = mulberry32(32);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);

    // Nothing records a *departure* into free agency, so a signing later undone
    // by trimRosterSurplus would leave the player's history permanently
    // claiming a club he never played for. Every logged arrival must therefore
    // either still hold him, or be followed by a real recorded move.
    const holder = new Map<number, number>();
    for (const team of next.teams) {
      for (const pid of [...team.roster, ...team.academyRoster]) holder.set(pid, team.tid);
    }
    const lastIndex = new Map<number, number>();
    next.transfers.forEach((t, i) => lastIndex.set(t.pid, i));

    const phantoms = next.transfers.filter(
      (t, i) =>
        isFreeAgentTid(t.fromTid) &&
        t.season === next.season &&
        holder.get(t.pid) !== t.toTid &&
        (lastIndex.get(t.pid) ?? i) === i,
    );
    expect(phantoms).toEqual([]);
  });

  it("no duplicate pids exist across the player pool after offseason", () => {
    const rng = mulberry32(6);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);
    const pids = next.players.map((p) => p.pid);
    expect(new Set(pids).size).toBe(pids.length);
  });

  it("settles every team's budget and hype, and locks in each team's next-season scouting spend", () => {
    const rng = mulberry32(7);
    const league = playFullSeason(rng);
    const budgetsBefore = new Map(league.teams.map((t) => [t.tid, t.budget]));
    const next = simOffseason(league, rng);

    expect(next.teams).toHaveLength(6 * (NUM_TEAMS + NUM_TEAMS_D2));
    for (const team of next.teams) {
      // Budget moved (performance money in at season end, base in and wages
      // out at the new season's start).
      expect(team.budget).not.toBe(budgetsBefore.get(team.tid));
      expect(team.hype).toBeGreaterThanOrEqual(HYPE_MIN);
      expect(team.hype).toBeLessThanOrEqual(HYPE_MAX);
      // The committed scouting spend for the new season is nextScoutingSpend
      // carried through (clamped to budget), and the two are kept in sync so
      // the offseason slider defaults to the just-locked value.
      expect(team.scoutingSpend).toBeGreaterThanOrEqual(0);
      expect(team.scoutingSpend).toBe(team.nextScoutingSpend);
      // AI teams never touch nextScoutingSpend, so they stay at the default.
      expect(team.scoutingSpend).toBeLessThanOrEqual(SCOUTING_SPEND_DEFAULT);
    }
  });

  it("carries a user-set next-season scouting spend through the offseason into the locked value", () => {
    const rng = mulberry32(7);
    const league = playFullSeason(rng);
    const userTid = league.meta.userTid;
    // Simulate an offseason edit: the user bumps next season's scouting budget.
    const target = SCOUTING_SPEND_DEFAULT / 2;
    league.teams = league.teams.map((t) =>
      t.tid === userTid ? { ...t, nextScoutingSpend: target } : t,
    );
    const next = simOffseason(league, rng);
    const userTeam = next.teams.find((t) => t.tid === userTid)!;
    // The value locks in for the new season (clamped to budget, which is ample
    // here), and scoutingSpend now equals it.
    expect(userTeam.scoutingSpend).toBe(target);
    expect(userTeam.nextScoutingSpend).toBe(target);
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
    // Must be a safely mid-table-or-better Division 1 club: a bottom-3
    // finisher would get relegated this offseason, and enforceDivision2Ceiling
    // would then immediately move this test's boosted 90-OVR player off him
    // again (correctly, but that's a different, separately tested mechanism —
    // not what this test is checking).
    const d1Ids = league.teams.filter((t) => t.compId === 0).map((t) => t.tid);
    const d1IdSet = new Set(d1Ids);
    const d1Table = computeStandings(d1Ids, league.played.filter((m) => d1IdSet.has(m.home)));
    const aiTid = d1Table.find((row) => row.tid !== userTid)!.tid;
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
      // Isolate club-injury healing: clear any international campaign the season
      // drew, so simOffseason doesn't play it and carry fresh tournament
      // injuries in (that carry-over is covered by international.test.ts).
      international: { ...league.international, stage: null, stageInjuries: [] },
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
