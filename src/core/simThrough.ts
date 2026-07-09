import type { PlayedMatch } from "./standings.js";
import type { LeagueStore } from "./leagueState.js";
import type { ScheduleGame } from "./schedule.js";
import type { League, LeagueTeam } from "./league/generate.js";
import { leagueComposites } from "./league/composites.js";
import { lastMatchdayOfMonth } from "./calendar.js";
import { simMatch } from "../engine/matchSim.js";

/**
 * Advance a league state by simming scheduled matches up to a target determined
 * by the `through` parameter. Pure — returns a new LeagueStore without mutating
 * the input.
 */
export function simThrough(
  league: LeagueStore,
  through: "game" | "month" | "deadline" | "season",
  rng: () => number,
): LeagueStore {
  // 1. Guard: nothing to do if not in regular season or no games left
  if (league.phase !== "regular" || league.schedule.length === 0) {
    return league;
  }

  // 2. Current matchday = minimum matchday in schedule
  const currentMatchday = Math.min(...league.schedule.map((g) => g.matchday));

  // 3. Determine target matchday
  let targetMatchday: number;
  switch (through) {
    case "game":
      targetMatchday = currentMatchday;
      break;
    case "month":
      targetMatchday = lastMatchdayOfMonth(currentMatchday);
      break;
    case "deadline":
      targetMatchday = 22;
      break;
    case "season":
      targetMatchday = 38;
      break;
  }
  // Don't go backwards
  if (targetMatchday < currentMatchday) {
    targetMatchday = currentMatchday;
  }

  // 4. Compute composites once from the league's teams and players.
  //    Map StoredTeam → LeagueTeam for the League interface.
  const leagueTeams: LeagueTeam[] = league.teams.map((t) => ({
    tid: t.tid,
    name: t.name,
    roster: t.roster,
    avgOvr: 0, // not used by leagueComposites
  }));
  const leagueObj: League = { teams: leagueTeams, players: league.players };
  const composites = leagueComposites(leagueObj);

  // 5. Partition schedule: games to sim vs games remaining
  const toSim: ScheduleGame[] = [];
  const remaining: ScheduleGame[] = [];
  for (const game of league.schedule) {
    if (game.matchday <= targetMatchday) {
      toSim.push(game);
    } else {
      remaining.push(game);
    }
  }

  // Sim each game and build PlayedMatch results
  const newResults: PlayedMatch[] = toSim.map((game) => {
    const result = simMatch(rng, composites[game.home], composites[game.away]);
    return {
      home: game.home,
      away: game.away,
      homeGoals: result.home,
      awayGoals: result.away,
    };
  });

  // 6. Return new LeagueStore
  return {
    lid: league.lid,
    meta: league.meta,
    teams: league.teams,
    players: league.players,
    season: league.season,
    phase: remaining.length === 0 ? "offseason" : "regular",
    schedule: remaining,
    played: [...league.played, ...newResults],
  };
}
