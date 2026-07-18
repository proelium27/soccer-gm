import type { CupState } from "./types.js";

/**
 * A player's Continental Cup stat line for one season, derived on demand from
 * that season's tie box scores (cup stats are deliberately NOT folded into
 * league SeasonStats — see core/simThrough). Goals/assists/etc. include extra
 * time; penalty-shootout kicks are not counted as goals, matching the sim.
 */
export interface CupStatLine {
  season: number;
  appearances: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  saves: number;
  goalsAgainst: number;
  tackles: number;
  interceptions: number;
  minutesPlayed: number;
}

function emptyLine(season: number): CupStatLine {
  return {
    season, appearances: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0,
    saves: 0, goalsAgainst: 0, tackles: 0, interceptions: 0, minutesPlayed: 0,
  };
}

/** Sum a player's box-score lines across every tie of one cup into a single season line. */
export function cupStatsForPlayer(cup: CupState, pid: number): CupStatLine {
  const line = emptyLine(cup.season);
  for (const tie of cup.ties) {
    for (const side of [tie.boxScore.home, tie.boxScore.away]) {
      const l = side.find((x) => x.pid === pid);
      if (!l) continue;
      line.appearances++;
      line.goals += l.goals;
      line.assists += l.assists;
      line.shots += l.shots;
      line.shotsOnTarget += l.shotsOnTarget;
      line.saves += l.saves;
      line.goalsAgainst += l.goalsAgainst;
      line.tackles += l.tackles;
      line.interceptions += l.interceptions;
      line.minutesPlayed += l.minutesPlayed;
    }
  }
  return line;
}

/**
 * Every season's cup stat line for a player, across the current cup and all
 * archived cups, newest season first — omitting seasons in which he never
 * featured.
 */
export function cupStatsBySeasonForPlayer(
  currentCup: CupState | null,
  cupHistory: CupState[],
  pid: number,
): CupStatLine[] {
  const cups = [...cupHistory, ...(currentCup ? [currentCup] : [])];
  return cups
    .map((cup) => cupStatsForPlayer(cup, pid))
    .filter((line) => line.appearances > 0)
    .sort((a, b) => b.season - a.season);
}
