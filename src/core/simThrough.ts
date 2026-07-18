import type { PlayedMatch } from "./standings.js";
import type { PlayerMatchLine } from "../engine/attribution.js";
import type { LeagueStore } from "./leagueState.js";
import type { ScheduleGame } from "./schedule.js";
import type { LeagueTeam } from "./league/generate.js";
import type { Player } from "./players/types.js";
import { leagueMatchData } from "./league/composites.js";
import type { TeamMatchData } from "./league/composites.js";
import {
  lastMatchdayOfMonth, TRANSFER_DEADLINE_MATCHDAY, WINTER_WINDOW_OPEN_MATCHDAY,
} from "./calendar.js";
import { simMatchDetailed } from "../engine/matchSim.js";
import { emptySeasonStats } from "./players/types.js";
import { applyInjuries } from "./injuries.js";
import { runAITransferMarket } from "./ai/transferMarket.js";
import { runAILoanMarket } from "./loans.js";
import { hashInts } from "../engine/rng.js";
import type { StoredTeam } from "./teams/clubs.js";
import { playerGoalTotals, detectMatchdayNewsEvents } from "./newsEvents.js";
import type { NewsEvent } from "./newsEvents.js";
import type { CupState } from "./cup/types.js";
import { dueCupRound, cupFinalists } from "./cup/cup.js";
import { playCupRound } from "./cup/simCup.js";
import { clampBudget } from "./finance/budget.js";
import { tierOf } from "./competitions.js";
import { CUP_FINAL_ROUND } from "./constants.js";

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
    const tid = homeRoster.has(p.pid) ? homeTid : awayTid;

    let ss = p.stats.find((s) => s.season === season);
    if (!ss) {
      ss = emptySeasonStats(season, tid);
      p.stats.push(ss);
    } else {
      ss.tid = tid;
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
      compId: t.compId,
      starters: t.starters,
    }));

  // Team state can change mid-batch (the winter transfer market moves players
  // between clubs), so it's threaded through the matchday loop rather than
  // snapshotted once up front.
  let currentTeams: StoredTeam[] = league.teams;
  let transfers = league.transfers;
  let activeLoans = league.activeLoans;
  let winterMarketRunSeason = league.winterMarketRunSeason;
  // Continental Cup for this season (null before season 2, and always set for
  // the current season by simOffseason). Knockout rounds fire on fixed league
  // matchdays inside the loop below; the state advances round by round and is
  // returned with the rest of the league.
  let cup: CupState | null = league.cup;
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
  // When set, the batch stopped before this matchday (the user's Continental
  // Cup final): every game from here on is pushed back to `remaining` so the
  // user regains control and can sim the final deliberately.
  let stoppedBeforeMatchday: number | null = null;
  for (let index = 0; index < matchdays.length; index++) {
    const matchday = matchdays[index];

    // Stop-before-final: if the user's club has reached the cup final (known
    // once the semi-finals are played) and the final is still ahead of where
    // this batch began, halt here rather than auto-simming through the final.
    // `matchday > currentMatchday` is what lets a *resumed* batch — which
    // starts exactly on the final's matchday — actually play it instead of
    // stopping forever.
    if (
      cup &&
      matchday > currentMatchday &&
      dueCupRound(cup, matchday) === CUP_FINAL_ROUND &&
      cupFinalists(cup).includes(league.meta.userTid)
    ) {
      stoppedBeforeMatchday = matchday;
      break;
    }

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
        league.meta.userTid, hashInts(league.lid, league.season, 8), league.competitions,
      );
      currentTeams = market.teams;
      transfers = market.transfers;

      const loanMarket = runAILoanMarket(
        currentTeams, currentPlayers, activeLoans, transfers, league.season,
        [...league.played, ...newResults], "winter", league.meta.userTid,
        hashInts(league.lid, league.season, 12), league.competitions,
      );
      currentTeams = loanMarket.teams;
      activeLoans = loanMarket.activeLoans;
      transfers = loanMarket.transfers;

      winterMarketRunSeason = league.season;
    }

    // Recomputed every matchday (not once for the whole batch) so that
    // injuries picked up on one matchday correctly sideline a player, and
    // recoveries bring them back, for the next.
    const matchData = new Map<number, TeamMatchData>();
    for (const comp of league.competitions) {
      const compTeams = currentTeams.filter((t) => t.compId === comp.id);
      const compMatchData = leagueMatchData({ teams: toLeagueTeams(compTeams), players: currentPlayers });
      compTeams.forEach((t, i) => matchData.set(t.tid, compMatchData[i]));
    }

    // Continental Cup: if a knockout round is due on this matchday, play it in
    // full using the composites just built for every club, then credit each
    // club's prize money to its budget (clamped like any other income). Cup
    // matches use their own seeded rng (inside playCupRound), so they don't
    // perturb the league match stream. Cup stats are kept out of SeasonStats
    // by design — they live only on the tie's box score.
    if (cup && dueCupRound(cup, matchday) !== null) {
      const { cup: advanced, prizes } = playCupRound(cup, matchData, league.lid);
      cup = advanced;
      if (prizes.size > 0) {
        currentTeams = currentTeams.map((t) => {
          const prize = prizes.get(t.tid);
          return prize
            ? { ...t, budget: clampBudget(t.budget + prize, tierOf(league.competitions, t.compId)) }
            : t;
        });
      }
    }

    const goalTotalsBefore = playerGoalTotals(currentPlayers, league.season);

    const gamesThisMatchday = toSim.filter((g) => g.matchday === matchday);
    const mdResults = gamesThisMatchday.map((game): PlayedMatch => {
      const hd = matchData.get(game.home)!;
      const ad = matchData.get(game.away)!;
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
  }

  // A stop-before-final break leaves this matchday and every later one
  // unplayed — fold them back into `remaining` so the batch ends cleanly with
  // the league still in its regular phase.
  const finalRemaining =
    stoppedBeforeMatchday === null
      ? remaining
      : [...toSim.filter((g) => g.matchday >= stoppedBeforeMatchday), ...remaining];

  return {
    ...league,
    teams: currentTeams,
    players: currentPlayers,
    phase: finalRemaining.length === 0 ? "offseason" : "regular",
    schedule: finalRemaining,
    played: [...league.played, ...newResults],
    transfers,
    activeLoans,
    winterMarketRunSeason,
    newsEvents: [...league.newsEvents, ...newEvents],
    cup,
  };
}
