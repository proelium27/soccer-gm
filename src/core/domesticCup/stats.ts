import type { BoxScore } from "../../engine/attribution.js";
import type { CupStatLine, CupPlayerLine } from "../cup/cupStats.js";
import type { DomesticCupState } from "./types.js";
import {
  emptyCupLine, aggregateBoxScores, lineFromBoxScores, storedLineToStatLine,
} from "../cup/cupStats.js";

/** Every box score this cup still holds (a live cup; an archived one has none). */
export function domesticBoxScores(cup: DomesticCupState): BoxScore[] {
  const out: BoxScore[] = [];
  // Defaulted throughout: this runs inside migrate on every archived cup, where
  // a throw would stop the save loading at all.
  for (const round of cup.rounds ?? []) {
    for (const tie of round.ties ?? []) if (tie.boxScore) out.push(tie.boxScore);
  }
  return out;
}

/** Fold a finished domestic cup's box scores into one line per player. */
export function aggregateDomesticStats(cup: DomesticCupState): CupPlayerLine[] {
  return aggregateBoxScores(domesticBoxScores(cup), cup.season);
}

/**
 * A player's line for one domestic cup: the stored aggregate once archived,
 * otherwise summed live from the box scores.
 *
 * The stored branch is correctness, not speed — archiving drops the box scores,
 * so summing them on an archived cup would score every past season as zero.
 */
export function domesticStatsForPlayer(cup: DomesticCupState, pid: number): CupStatLine {
  if (cup.statLines !== null && cup.statLines !== undefined) {
    const stored = cup.statLines.find((l) => l.pid === pid);
    return stored ? storedLineToStatLine(stored) : emptyCupLine(cup.season);
  }
  return lineFromBoxScores(domesticBoxScores(cup), cup.season, pid);
}

/**
 * Every player's totals across a set of domestic cups, keyed by pid — so a
 * whole-world award pass doesn't re-scan every cup once per player.
 *
 * Reads the stored aggregate on an archived cup exactly like
 * `domesticStatsForPlayer`, and for the same reason: archiving drops the box
 * scores, so summing them would score every past season as zero.
 *
 * Takes a list because eight countries play their cups at once and a caller
 * scoring a season wants all of them; a player features in one, so the merge
 * across cups is only there to make the caller's life simple.
 */
export function domesticStatsByPid(cups: DomesticCupState[]): Map<number, CupStatLine> {
  const out = new Map<number, CupStatLine>();
  const add = (pid: number, line: CupStatLine): void => {
    const prev = out.get(pid);
    if (!prev) {
      out.set(pid, line);
      return;
    }
    // Only reachable for a player sold across a border mid-season, who really
    // did play in two countries' cups. Appearances and minutes sum; the rating
    // sum and its denominator sum with them, so cupAvgRating stays a mean.
    out.set(pid, {
      season: prev.season,
      appearances: prev.appearances + line.appearances,
      goals: prev.goals + line.goals,
      assists: prev.assists + line.assists,
      shots: prev.shots + line.shots,
      shotsOnTarget: prev.shotsOnTarget + line.shotsOnTarget,
      saves: prev.saves + line.saves,
      goalsAgainst: prev.goalsAgainst + line.goalsAgainst,
      tackles: prev.tackles + line.tackles,
      interceptions: prev.interceptions + line.interceptions,
      minutesPlayed: prev.minutesPlayed + line.minutesPlayed,
      ratingSum: prev.ratingSum + line.ratingSum,
      ratedAppearances: prev.ratedAppearances + line.ratedAppearances,
    });
  };

  for (const cup of cups) {
    if (cup.statLines !== null && cup.statLines !== undefined) {
      for (const stored of cup.statLines) add(stored.pid, storedLineToStatLine(stored));
      continue;
    }
    for (const line of aggregateBoxScores(domesticBoxScores(cup), cup.season)) {
      const { pid, ...rest } = line;
      add(pid, rest);
    }
  }
  return out;
}

/**
 * Every season's domestic cup line for a player, across the live cups and all
 * archived ones, newest first — omitting seasons he never featured in.
 *
 * Usually one line per season, but **not guaranteed**: a player sold across a
 * border in the winter window plays in his old country's cup and then his new
 * one, and both are real. Callers must not key a row by season alone.
 */
export function domesticStatsBySeasonForPlayer(
  current: DomesticCupState[],
  history: DomesticCupState[],
  pid: number,
): CupStatLine[] {
  return [...history, ...current]
    .map((cup) => domesticStatsForPlayer(cup, pid))
    .filter((line) => line.appearances > 0)
    .sort((a, b) => b.season - a.season);
}
