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
