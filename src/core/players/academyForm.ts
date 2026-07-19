import type { StandingsRow, SeasonHistoryEntry } from "../standings.js";
import { ACADEMY_FORM_SEASONS, ACADEMY_FORM_SWING } from "../constants.js";

/**
 * Per-club youth-intake modifier from recent league form: for each of the
 * last ACADEMY_FORM_SEASONS completed seasons, a club scores its normalized
 * finishing position within its own competition that season (+1 champion,
 * -1 bottom, 0 mid-table); the scores are averaged over however many of
 * those seasons exist and scaled to ±ACADEMY_FORM_SWING points, added to
 * academyBase at intake time. Scoring by within-competition rank keeps the
 * modifier zero-sum per division per season, so it redistributes intake
 * quality toward in-form clubs without inflating the league-wide mean —
 * the failure mode the fixed academyBase anchor exists to prevent.
 *
 * `currentTables` is the just-finished season's per-competition tables
 * (already computed in simOffseason for settlement, before any
 * promotion/relegation swap); `history` is league.seasonHistory, which at
 * that point holds only *prior* seasons — the most recent
 * ACADEMY_FORM_SEASONS - 1 entries fill out the window.
 */
export function computeAcademyFormModifiers(
  currentTables: Iterable<StandingsRow[]>,
  history: SeasonHistoryEntry[],
): Map<number, number> {
  const seasonScores: Map<number, number>[] = [];

  seasonScores.push(scoreSeason([...currentTables]));
  for (const entry of history.slice(-(ACADEMY_FORM_SEASONS - 1)).reverse()) {
    seasonScores.push(scoreSeason(splitByCompetition(entry)));
  }

  const modifiers = new Map<number, number>();
  for (const tid of seasonScores[0].keys()) {
    let sum = 0;
    let seasons = 0;
    for (const scores of seasonScores) {
      const s = scores.get(tid);
      if (s === undefined) continue;
      sum += s;
      seasons++;
    }
    if (seasons > 0) modifiers.set(tid, (sum / seasons) * ACADEMY_FORM_SWING);
  }
  return modifiers;
}

/** +1 for finishing top of a table, -1 for bottom, linear between. */
function scoreSeason(tables: StandingsRow[][]): Map<number, number> {
  const scores = new Map<number, number>();
  for (const rows of tables) {
    if (rows.length < 2) continue;
    rows.forEach((row, i) => {
      scores.set(row.tid, 1 - (2 * i) / (rows.length - 1));
    });
  }
  return scores;
}

/**
 * A SeasonHistoryEntry's table concatenates every competition's
 * already-sorted rows; compsByTid recovers the per-competition groups with
 * finishing order preserved (the same read clubHistory.ts uses).
 */
function splitByCompetition(entry: SeasonHistoryEntry): StandingsRow[][] {
  const byComp = new Map<number, StandingsRow[]>();
  for (const row of entry.table) {
    const compId = entry.compsByTid[row.tid];
    if (compId === undefined) continue;
    let rows = byComp.get(compId);
    if (!rows) byComp.set(compId, (rows = []));
    rows.push(row);
  }
  return [...byComp.values()];
}
