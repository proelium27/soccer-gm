import type { PlayedMatch } from "./standings.js";
import type { PlayerMatchLine } from "../engine/attribution.js";
import type { LeagueStore } from "./leagueState.js";
import type { ScheduleGame } from "./schedule.js";
import type { League, LeagueTeam } from "./league/generate.js";
import type { Player } from "./players/types.js";
import { leagueMatchData } from "./league/composites.js";
import {
  lastMatchdayOfMonth, TRANSFER_DEADLINE_MATCHDAY, WINTER_WINDOW_OPEN_MATCHDAY,
} from "./calendar.js";
import { simMatchDetailed } from "../engine/matchSim.js";
import { emptySeasonStats } from "./players/types.js";
import { applyInjuries } from "./injuries.js";
import { runAITransferMarket } from "./ai/transferMarket.js";
import { hashInts } from "../engine/rng.js";
import type { StoredTeam } from "./teams/clubs.js";
import { playerGoalTotals, detectMatchdayNewsEvents } from "./newsEvents.js";
import type { NewsEvent } from "./newsEvents.js";

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
      ss.xg += line.xg;
      ss.goalsAgainst += line.goalsAgainst;
      ss.xga += line.xga;
      ss.saves += line.saves;
      ss.tackles += line.tackles;
      ss.interceptions += line.interceptions;
      ss.minutesPlayed += line.minutesPlayed;
      ss.ratingSum += line.rating;
      ss.avgRating = ss.ratingSum / ss.appearances;
    }
  }
}

export type MatchdayProgress = (
  matchday: number,
  matchdayIndex: number,
  totalMatchdays: number,
  results: PlayedMatch[],
) => void;

export function simThrough(
  league: LeagueStore,
  through: "game" | "month" | "deadline" | "season",
  rng: () => number,
  onMatchday?: MatchdayProgress,
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
      // Stop just before deadline day so the winter window is still open.
      // Already there (or past it): nothing to sim "to" — in particular,
      // don't play deadline day itself and shut the window unasked.
      targetMatchday = TRANSFER_DEADLINE_MATCHDAY - 1;
      if (targetMatchday < currentMatchday) return league;
      break;
    case "season":
      targetMatchday = 38;
      break;
  }
  if (targetMatchday < currentMatchday) {
    targetMatchday = currentMatchday;
  }

  const toLeagueTeams = (ts: StoredTeam[]): LeagueTeam[] =>
    ts.map((t) => ({
      tid: t.tid,
      name: t.name,
      roster: t.roster,
      avgOvr: 0,
      academyBase: t.academyBase,
      starters: t.starters,
    }));

  // Team state can change mid-batch (the winter transfer market moves players
  // between clubs), so it's threaded through the matchday loop rather than
  // snapshotted once up front.
  let currentTeams: StoredTeam[] = league.teams;
  let transfers = league.transfers;
  let winterMarketRunSeason = league.winterMarketRunSeason;
  const newEvents: NewsEvent[] = [];

  const toSim: ScheduleGame[] = [];
  const remaining: ScheduleGame[] = [];
  for (const game of league.schedule) {
    if (game.matchday <= targetMatchday) {
      toSim.push(game);
    } else {
      remaining.push(game);
    }
  }

  let currentPlayers = league.players.map((p) => ({
    ...p,
    stats: [...p.stats.map((s) => ({ ...s }))],
  }));

  // All games share one RNG stream, so sim order defines the results:
  // ascending matchday, then schedule order within each matchday.
  const matchdays = [...new Set(toSim.map((g) => g.matchday))].sort(
    (a, b) => a - b,
  );

  const newResults: PlayedMatch[] = [];
  matchdays.forEach((matchday, index) => {
    // Winter transfer window: the first time this batch reaches the window's
    // opening matchday, run the AI↔AI market once (guarded per season so it
    // can't re-fire however the user chops up the sim). Trades here change
    // the rosters every subsequent matchday is played with. User excluded.
    if (
      winterMarketRunSeason !== league.season &&
      matchday >= WINTER_WINDOW_OPEN_MATCHDAY &&
      matchday <= TRANSFER_DEADLINE_MATCHDAY
    ) {
      const market = runAITransferMarket(
        currentTeams, currentPlayers, transfers, league.season,
        [...league.played, ...newResults], "winter", "regular",
        league.meta.userTid, hashInts(league.lid, league.season, 8),
      );
      currentTeams = market.teams;
      transfers = market.transfers;
      winterMarketRunSeason = league.season;
    }

    // Recomputed every matchday (not once for the whole batch) so that
    // injuries picked up on one matchday correctly sideline a player, and
    // recoveries bring them back, for the next.
    const leagueObj: League = { teams: toLeagueTeams(currentTeams), players: currentPlayers };
    const matchData = leagueMatchData(leagueObj);

    const goalTotalsBefore = playerGoalTotals(currentPlayers, league.season);

    const gamesThisMatchday = toSim.filter((g) => g.matchday === matchday);
    const mdResults = gamesThisMatchday.map((game): PlayedMatch => {
      const hd = matchData[game.home];
      const ad = matchData[game.away];
      const result = simMatchDetailed(
        rng,
        hd.composites,
        ad.composites,
        hd.xi,
        ad.xi,
        hd.bench,
        ad.bench,
        { recompute: { home: hd.recompute, away: ad.recompute } },
      );

      accumulateStats(
        currentPlayers,
        league.season,
        game.home,
        game.away,
        result.boxScore.home,
        result.boxScore.away,
        currentTeams,
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

    currentPlayers = applyInjuries(rng, currentPlayers, mdResults);

    const goalTotalsAfter = playerGoalTotals(currentPlayers, league.season);
    newEvents.push(
      ...detectMatchdayNewsEvents(mdResults, league.season, matchday, goalTotalsBefore, goalTotalsAfter),
    );

    newResults.push(...mdResults);
    onMatchday?.(matchday, index, matchdays.length, mdResults);
  });

  return {
    ...league,
    teams: currentTeams,
    players: currentPlayers,
    phase: remaining.length === 0 ? "offseason" : "regular",
    schedule: remaining,
    played: [...league.played, ...newResults],
    transfers,
    winterMarketRunSeason,
    newsEvents: [...league.newsEvents, ...newEvents],
  };
}
