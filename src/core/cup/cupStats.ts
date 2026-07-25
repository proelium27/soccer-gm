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
}

/** A stored, pre-aggregated cup line — what an archived cup keeps instead of box scores. */
export interface CupPlayerLine extends CupStatLine {
  pid: number;
}

function emptyLine(season: number): CupStatLine {
  return {
    season, appearances: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0,
    saves: 0, goalsAgainst: 0, tackles: 0, interceptions: 0, minutesPlayed: 0,
  };
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
  const byPid = new Map<number, CupPlayerLine>();
  for (const box of boxScoresOf(cup)) {
    for (const side of [box.home, box.away]) {
      for (const l of side) {
        let line = byPid.get(l.pid);
        if (!line) {
          line = { pid: l.pid, ...emptyLine(cup.season) };
          byPid.set(l.pid, line);
        }
        addLine(line, l);
      }
    }
  }
  return [...byPid.values()];
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
