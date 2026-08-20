import type { BoxScore } from "../../engine/attribution.js";
import type { CupState } from "./types.js";

/**
 * A player's Continental Cup stat line for one season. Goals/assists/etc.
 * include extra time; penalty-shootout kicks are not counted as goals, matching
 * the sim. Cup stats are deliberately NOT folded into league SeasonStats (see
 * core/simThrough).
 *
 * A two-legged knockout tie counts as **one** appearance, because its two legs
 * are merged into a single box-score line before storage (see resolveTwoLeggedTie
 * / mergeLines) — the minutes cover both legs, but the individual legs can no
 * longer be told apart, so counting them separately would be false precision.
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

/** A stored, pre-aggregated cup line — what an archived cup keeps instead of box scores. */
export interface CupPlayerLine extends CupStatLine {
  pid: number;
}

/**
 * A zeroed line for `season`. Exported because the domestic cups aggregate the
 * same way over their own box scores (see core/domesticCup/stats.ts) — one
 * implementation of "fold box scores into cup lines", used by both cups.
 */
export function emptyCupLine(season: number): CupStatLine {
  return emptyLine(season);
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

function addLine(into: CupStatLine, l: BoxScore["home"][number]): void {
  into.appearances++;
  into.goals += l.goals;
  into.assists += l.assists;
  into.shots += l.shots;
  into.shotsOnTarget += l.shotsOnTarget;
  into.saves += l.saves;
  into.goalsAgainst += l.goalsAgainst;
  into.tackles += l.tackles;
  into.interceptions += l.interceptions;
  into.minutesPlayed += l.minutesPlayed;
  // Must be accumulated here, not only at read time: archiveCup folds box
  // scores into statLines and then deletes them, so anything addLine misses is
  // gone from that cup forever. The worldwide awards read cup ratings.
  if (l.minutesPlayed > 0 && Number.isFinite(l.rating)) {
    into.ratingSum += l.rating;
    into.ratedAppearances++;
  }
}

/**
 * Every box score a cup still holds, across **all three** stages.
 *
 * This is the fix for a long-standing under-count: the cup's three stages live in
 * three separate places (`leaguePhase.matches`, `playoff.ties`, and the top-level
 * `ties`), and this used to read only the last of them. So a club that played all
 * six group games and went out in the playoff showed 0 cup appearances for every
 * player, and even a quarter-finalist lost his group games. Measured on one real
 * season: 1857 appearances played, 199 counted.
 */
function boxScoresOf(cup: CupState): BoxScore[] {
  const out: BoxScore[] = [];
  // Every list is defaulted: archiveCup runs on every archived cup during
  // migrate, and a throw there would stop the save loading at all.
  for (const m of cup.leaguePhase?.matches ?? []) if (m.boxScore) out.push(m.boxScore);
  for (const t of cup.playoff?.ties ?? []) if (t.boxScore) out.push(t.boxScore);
  for (const t of cup.playIn?.ties ?? []) if (t.boxScore) out.push(t.boxScore);
  for (const t of cup.ties ?? []) if (t.boxScore) out.push(t.boxScore);
  return out;
}

/**
 * Fold a cup's box scores into one line per player who featured.
 *
 * Called as a cup is archived: the lines are kept and the box scores dropped,
 * which is ~8x smaller (431 KB vs 3.6 MB across 13 cups) and keeps the Player
 * Profile Cup tab working. Save size is what freezes the game, so this matters
 * (see CLAUDE.md's save-size section).
 */
export function aggregateCupStats(cup: CupState): CupPlayerLine[] {
  return aggregateBoxScores(boxScoresOf(cup), cup.season);
}

/**
 * Fold a list of box scores into one line per player who featured. The shared
 * half of aggregateCupStats — the domestic cups store their box scores in a
 * different shape but aggregate them identically.
 */
export function aggregateBoxScores(boxes: BoxScore[], season: number): CupPlayerLine[] {
  const byPid = new Map<number, CupPlayerLine>();
  for (const box of boxes) {
    for (const side of [box.home, box.away]) {
      for (const l of side) {
        let line = byPid.get(l.pid);
        if (!line) {
          line = { pid: l.pid, ...emptyLine(season) };
          byPid.set(l.pid, line);
        }
        addLine(line, l);
      }
    }
  }
  return [...byPid.values()];
}

/** One player's totals over a list of box scores. Shared with the domestic cups. */
export function lineFromBoxScores(boxes: BoxScore[], season: number, pid: number): CupStatLine {
  const line = emptyLine(season);
  for (const box of boxes) {
    for (const side of [box.home, box.away]) {
      const l = side.find((x) => x.pid === pid);
      if (l) addLine(line, l);
    }
  }
  return line;
}

/** A stored aggregate line stripped back to a CupStatLine, defaulting the rating fields. */
export function storedLineToStatLine(stored: CupPlayerLine): CupStatLine {
  const { pid: _pid, ...line } = stored;
  // Lines aggregated before ratings were tracked have neither field; default
  // them so cupAvgRating reports "no rating" rather than NaN.
  return { ...line, ratingSum: line.ratingSum ?? 0, ratedAppearances: line.ratedAppearances ?? 0 };
}

/**
 * A player's line for one cup: read from the stored aggregate when the cup has
 * been archived, otherwise summed live from its box scores.
 */
export function cupStatsForPlayer(cup: CupState, pid: number): CupStatLine {
  if (cup.statLines !== null && cup.statLines !== undefined) {
    const stored = cup.statLines.find((l) => l.pid === pid);
    if (!stored) return emptyLine(cup.season);
    const { pid: _pid, ...line } = stored;
    return line;
  }
  const line = emptyLine(cup.season);
  for (const box of boxScoresOf(cup)) {
    for (const side of [box.home, box.away]) {
      const l = side.find((x) => x.pid === pid);
      if (l) addLine(line, l);
    }
  }
  return line;
}

/**
 * The same totals as cupStatsForPlayer, for every player at once, keyed by pid
 * — so a whole-world award pass doesn't re-scan every box score once per player.
 *
 * Reads the stored aggregate on an archived cup, exactly like cupStatsForPlayer.
 * That branch is load-bearing rather than an optimisation: archiveCup drops the
 * box scores, so summing them here would silently score every archived season's
 * cup as zero — which is precisely what the worldwide awards read when
 * migrate.ts backfills past seasons.
 */
export function cupStatsByPid(cup: CupState): Map<number, CupStatLine> {
  const lines = new Map<number, CupStatLine>();
  if (cup.statLines !== null && cup.statLines !== undefined) {
    for (const { pid, ...line } of cup.statLines) {
      // Lines aggregated before ratings were tracked have neither field;
      // default them so cupAvgRating reports "no rating" rather than NaN.
      lines.set(pid, { ...line, ratingSum: line.ratingSum ?? 0, ratedAppearances: line.ratedAppearances ?? 0 });
    }
    return lines;
  }
  for (const box of boxScoresOf(cup)) {
    for (const side of [box.home, box.away]) {
      for (const l of side) {
        let line = lines.get(l.pid);
        if (!line) {
          line = emptyLine(cup.season);
          lines.set(l.pid, line);
        }
        addLine(line, l);
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
