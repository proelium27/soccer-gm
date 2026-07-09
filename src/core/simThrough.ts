import type { PlayedMatch } from "./standings.js";
import type { PlayerMatchLine } from "../engine/attribution.js";
import type { LeagueStore } from "./leagueState.js";
import type { ScheduleGame } from "./schedule.js";
import type { League, LeagueTeam } from "./league/generate.js";
import type { Player } from "./players/types.js";
import { leagueMatchData } from "./league/composites.js";
import { lastMatchdayOfMonth } from "./calendar.js";
import { simMatchDetailed } from "../engine/matchSim.js";
import { emptySeasonStats } from "./players/types.js";

function accumulateStats(
  players: Player[],
  season: number,
  homeTid: number,
  awayTid: number,
  homeLines: PlayerMatchLine[],
  awayLines: PlayerMatchLine[],
  teams: { tid: number; roster: number[] }[],
): void {
  const homeRoster = new Set(teams.find((t) => t.tid === homeTid)!.roster);
  const awayRoster = new Set(teams.find((t) => t.tid === awayTid)!.roster);
  const allLines = [...homeLines, ...awayLines];
  const relevantPids = new Set([...homeRoster, ...awayRoster]);

  for (const p of players) {
    if (!relevantPids.has(p.pid)) continue;

    let ss = p.stats.find((s) => s.season === season);
    if (!ss) {
      ss = emptySeasonStats(season);
      p.stats.push(ss);
    }

    const line = allLines.find((l) => l.pid === p.pid);
    if (line) {
      ss.appearances++;
      ss.goals += line.goals;
      ss.assists += line.assists;
      ss.shots += line.shots;
      ss.shotsOnTarget += line.shotsOnTarget;
      ss.saves += line.saves;
      ss.tackles += line.tackles;
    }
  }
}

export function simThrough(
  league: LeagueStore,
  through: "game" | "month" | "deadline" | "season",
  rng: () => number,
): LeagueStore {
  if (league.phase !== "regular" || league.schedule.length === 0) {
    return league;
  }

  const currentMatchday = Math.min(...league.schedule.map((g) => g.matchday));

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
  if (targetMatchday < currentMatchday) {
    targetMatchday = currentMatchday;
  }

  const leagueTeams: LeagueTeam[] = league.teams.map((t) => ({
    tid: t.tid,
    name: t.name,
    roster: t.roster,
    avgOvr: 0,
  }));
  const leagueObj: League = { teams: leagueTeams, players: league.players };
  const matchData = leagueMatchData(leagueObj);

  const toSim: ScheduleGame[] = [];
  const remaining: ScheduleGame[] = [];
  for (const game of league.schedule) {
    if (game.matchday <= targetMatchday) {
      toSim.push(game);
    } else {
      remaining.push(game);
    }
  }

  const updatedPlayers = league.players.map((p) => ({
    ...p,
    stats: [...p.stats.map((s) => ({ ...s }))],
  }));

  const newResults: PlayedMatch[] = toSim.map((game) => {
    const hd = matchData[game.home];
    const ad = matchData[game.away];
    const result = simMatchDetailed(
      rng,
      hd.composites,
      ad.composites,
      hd.xi,
      ad.xi,
    );

    accumulateStats(
      updatedPlayers,
      league.season,
      game.home,
      game.away,
      result.boxScore.home,
      result.boxScore.away,
      league.teams,
    );

    return {
      home: game.home,
      away: game.away,
      homeGoals: result.home,
      awayGoals: result.away,
      possessionHome: result.possessionHome,
      matchday: game.matchday,
      boxScore: result.boxScore,
    };
  });

  return {
    lid: league.lid,
    meta: league.meta,
    teams: league.teams,
    players: updatedPlayers,
    season: league.season,
    phase: remaining.length === 0 ? "offseason" : "regular",
    schedule: remaining,
    played: [...league.played, ...newResults],
  };
}
