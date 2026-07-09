import type { LeagueStore } from "./leagueState.js";
import type { Player } from "./players/types.js";
import type { StoredTeam } from "./teams/clubs.js";
import { progressPlayer, rollRetirement } from "./players/progression.js";
import { generateYouthIntake } from "./players/youth.js";
import { releaseExpiredContracts, runAIFreeAgency, trimRosterSurplus } from "./freeAgency.js";
import { computeStandings } from "./standings.js";
import { generateSchedule } from "./schedule.js";

function teamAvgOvr(roster: number[], playerMap: Map<number, Player>): number {
  const ovrs = roster.map((pid) => playerMap.get(pid)?.ovr ?? 0);
  if (ovrs.length === 0) return 50;
  return ovrs.reduce((s, v) => s + v, 0) / ovrs.length;
}

/**
 * Run one full offseason: contract expiry, progression, retirement, AI free
 * agency, youth intake, then a fresh schedule for the new season. Only
 * callable when the league is in the "offseason" phase (all 38 matchdays
 * played). The user's team is left untouched by free agency/youth so the UI
 * can offer those as manual actions later; youth intake still applies to
 * every club per spec (no draft mechanic).
 */
export function simOffseason(league: LeagueStore, rng: () => number): LeagueStore {
  if (league.phase !== "offseason") {
    return league;
  }

  const endingSeason = league.season;
  const nextSeason = endingSeason + 1;

  // 1. Release expired contracts to the free agent pool.
  let teams: StoredTeam[] = releaseExpiredContracts(league.teams, league.players, endingSeason);

  // 2. Progress every remaining player's ratings.
  let players: Player[] = league.players.map((p) => progressPlayer(rng, p, endingSeason));

  // 3. Roll retirement; drop retirees from rosters and the player pool.
  const retiredPids = new Set(
    players
      .filter((p) => rollRetirement(rng, p, endingSeason))
      .map((p) => p.pid),
  );
  players = players.filter((p) => !retiredPids.has(p.pid));
  teams = teams.map((t) => ({
    ...t,
    roster: t.roster.filter((pid) => !retiredPids.has(pid)),
  }));

  // 4. AI free agency fills roster holes (worst team picks first), skipping
  //    the user's club so they can sign manually.
  const standings = computeStandings(teams.map((t) => t.tid), league.played);
  const signingOrder = [...standings].sort((a, b) => a.points - b.points).map((s) => s.tid);
  ({ teams, players } = runAIFreeAgency(
    teams,
    players,
    nextSeason,
    rng,
    league.meta.userTid,
    signingOrder,
  ));

  // 5. Youth intake for every club.
  let nextPid = Math.max(0, ...players.map((p) => p.pid)) + 1;
  const playerMap = new Map(players.map((p) => [p.pid, p]));
  teams = teams.map((t) => {
    const { players: youth, nextPid: updatedNextPid } = generateYouthIntake(
      rng,
      teamAvgOvr(t.roster, playerMap),
      nextSeason,
      nextPid,
    );
    nextPid = updatedNextPid;
    players.push(...youth);
    return { ...t, roster: [...t.roster, ...youth.map((p) => p.pid)] };
  });

  // 6. Trim AI squads back down to target composition so youth intake
  //    doesn't accumulate indefinitely across seasons.
  teams = trimRosterSurplus(teams, players, league.meta.userTid);

  // 7. New schedule, new season, back to regular play.
  const schedule = generateSchedule(teams.map((t) => t.tid));

  return {
    ...league,
    teams,
    players,
    season: nextSeason,
    phase: "regular",
    schedule,
    played: [],
  };
}
