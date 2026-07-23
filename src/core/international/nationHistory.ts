import type { IntlTournamentSummary } from "./types.js";

/**
 * Per-nation records derived from archived tournaments (Light summaries). Pure
 * functions of `history` — nothing extra is stored, because a summary's field,
 * champion/runner-up and knockout scorelines already say how far each nation
 * got.
 */

/** How far a nation got, weakest to strongest, for ranking a "best finish". */
export const FINISH_ORDER = [
  "Did not qualify",
  "Group stage",
  "Quarter-finals",
  "Semi-finals",
  "Runners-up",
  "Champions",
] as const;
export type Finish = (typeof FINISH_ORDER)[number];

/**
 * A nation's finish in one archived tournament, or null if it wasn't in the
 * field. Champion and runner-up come straight off the summary; otherwise the
 * deepest knockout round the nation appears in tells the story (lost in the SF →
 * "Semi-finals", lost in the QF → "Quarter-finals", never reached the knockout →
 * "Group stage").
 */
export function finishOf(summary: IntlTournamentSummary, nation: string): Finish | null {
  if (!summary.field.includes(nation)) return null;
  if (summary.champion === nation) return "Champions";
  if (summary.runnerUp === nation) return "Runners-up";
  let deepest = -1;
  for (const k of summary.knockout) {
    if (k.home === nation || k.away === nation) deepest = Math.max(deepest, k.round);
  }
  if (deepest >= 1) return "Semi-finals";
  if (deepest >= 0) return "Quarter-finals";
  return "Group stage";
}

export interface NationRecord {
  nation: string;
  /** Tournaments the nation was in the field for. */
  tournaments: number;
  titles: number;
  /** Times it reached the final (won or lost). */
  finals: number;
  /** Times it reached the semi-finals or better. */
  semis: number;
  bestFinish: Finish;
}

/**
 * Roll every archived tournament up into one record per nation, ranked by
 * honours (titles, then finals, then semis, then appearances). Nations that
 * never qualified for any archived tournament simply don't appear.
 */
export function nationRecords(history: IntlTournamentSummary[]): NationRecord[] {
  const map = new Map<string, NationRecord>();
  const get = (nation: string): NationRecord => {
    let r = map.get(nation);
    if (!r) {
      r = { nation, tournaments: 0, titles: 0, finals: 0, semis: 0, bestFinish: "Group stage" };
      map.set(nation, r);
    }
    return r;
  };

  for (const s of history) {
    for (const nation of s.field) {
      const r = get(nation);
      r.tournaments++;
      const f = finishOf(s, nation);
      if (f === "Champions") {
        r.titles++;
        r.finals++;
        r.semis++;
      } else if (f === "Runners-up") {
        r.finals++;
        r.semis++;
      } else if (f === "Semi-finals") {
        r.semis++;
      }
      if (f && FINISH_ORDER.indexOf(f) > FINISH_ORDER.indexOf(r.bestFinish)) r.bestFinish = f;
    }
  }

  return [...map.values()].sort(
    (a, b) =>
      b.titles - a.titles ||
      b.finals - a.finals ||
      b.semis - a.semis ||
      b.tournaments - a.tournaments ||
      a.nation.localeCompare(b.nation),
  );
}
