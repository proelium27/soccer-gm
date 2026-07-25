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
  /**
   * Sum of match ratings over appearances with minutes played; divide by
   * `ratedAppearances` for the average. Worth more than a league average
   * rating for cross-league comparison: cup matches normalize against the
   * whole 20-club field pooled together (see simThrough's cupMatchData), so a
   * 7.5 in the cup means the same thing whichever league the player comes from.
   */
  ratingSum: number;
  /** Appearances that had minutes and so contributed to `ratingSum`. */
  ratedAppearances: number;
}

function emptyLine(season: number): CupStatLine {
  return {
    season, appearances: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0,
    saves: 0, goalsAgainst: 0, tackles: 0, interceptions: 0, minutesPlayed: 0,
    ratingSum: 0, ratedAppearances: 0,
  };
}

/** Average cup match rating, or null when he never played a minute. */
export function cupAvgRating(line: CupStatLine): number | null {
  return line.ratedAppearances > 0 ? line.ratingSum / line.ratedAppearances : null;
}

/**
 * Every box score in one cup, whatever format it is: the Swiss league phase's
 * matches, the playoff round, a legacy play-in, and the knockout ties. They
 * live in four different places on CupState, and until the worldwide awards
 * needed a complete cup record only `ties` was ever summed — which quietly left
 * a Swiss cup's six league-phase games out of every player's cup line.
 */
function allBoxScores(cup: CupState) {
  return [
    ...(cup.leaguePhase?.matches ?? []).flatMap((m) => (m.boxScore ? [m.boxScore] : [])),
    ...(cup.playoff?.ties ?? []).map((t) => t.boxScore),
    ...(cup.playIn?.ties ?? []).map((t) => t.boxScore),
    ...cup.ties.map((t) => t.boxScore),
  ];
}

/**
 * Sum a player's box-score lines across one whole cup into a single season line.
 *
 * A two-legged knockout tie counts as one appearance with both legs' stats
 * folded in, because that's how it's stored — mergeLines combines the legs into
 * the tie's single box score before it's appended.
 */
export function cupStatsForPlayer(cup: CupState, pid: number): CupStatLine {
  const line = emptyLine(cup.season);
  for (const box of allBoxScores(cup)) {
    for (const side of [box.home, box.away]) {
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
      if (l.minutesPlayed > 0 && Number.isFinite(l.rating)) {
        line.ratingSum += l.rating;
        line.ratedAppearances++;
      }
    }
  }
  return line;
}

/**
 * The same totals as cupStatsForPlayer, for every player at once, keyed by pid
 * — so a whole-world award pass doesn't re-scan every box score once per player.
 */
export function cupStatsByPid(cup: CupState): Map<number, CupStatLine> {
  const lines = new Map<number, CupStatLine>();
  for (const box of allBoxScores(cup)) {
    for (const side of [box.home, box.away]) {
      for (const l of side) {
        let line = lines.get(l.pid);
        if (!line) {
          line = emptyLine(cup.season);
          lines.set(l.pid, line);
        }
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
        if (l.minutesPlayed > 0 && Number.isFinite(l.rating)) {
          line.ratingSum += l.rating;
          line.ratedAppearances++;
        }
      }
    }
  }
  return lines;
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
