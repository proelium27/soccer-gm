import type { StandingsRow } from "./standings.js";
import type { StoredTeam } from "./teams/clubs.js";
import {
  PROMOTION_RELEGATION_COUNT, ACADEMY_BASE_CONVERGENCE_SEASONS, DIVISION_ACADEMY_BASE_CENTER,
} from "./constants.js";

export interface DivisionSwap {
  /** Tids moving from Division 2 up to Division 1. */
  promoted: number[];
  /** Tids moving from Division 1 down to Division 2. */
  relegated: number[];
}

/**
 * Bottom PROMOTION_RELEGATION_COUNT of Division 1's final table swap with
 * top PROMOTION_RELEGATION_COUNT of Division 2's final table. Both tables
 * must already be sorted by computeStandings (points, then GD, then GF,
 * then tid).
 */
export function computeDivisionSwap(
  d1Table: StandingsRow[],
  d2Table: StandingsRow[],
): DivisionSwap {
  return {
    promoted: d2Table.slice(0, PROMOTION_RELEGATION_COUNT).map((r) => r.tid),
    relegated: d1Table.slice(-PROMOTION_RELEGATION_COUNT).map((r) => r.tid),
  };
}

/**
 * Flip `division` for every swapped team and start (or restart) its
 * academyBase convergence toward the new division's center. Teams not in
 * the swap are returned unchanged.
 */
export function applyDivisionSwap(teams: StoredTeam[], swap: DivisionSwap): StoredTeam[] {
  const promotedSet = new Set(swap.promoted);
  const relegatedSet = new Set(swap.relegated);
  return teams.map((t) => {
    if (promotedSet.has(t.tid)) {
      return { ...t, compId: 0, divisionConvergence: { seasonsRemaining: ACADEMY_BASE_CONVERGENCE_SEASONS } };
    }
    if (relegatedSet.has(t.tid)) {
      return { ...t, compId: 1, divisionConvergence: { seasonsRemaining: ACADEMY_BASE_CONVERGENCE_SEASONS } };
    }
    return t;
  });
}

/**
 * Move every mid-convergence team's academyBase one season closer to its
 * current division's center, decrementing seasonsRemaining and clearing
 * divisionConvergence once it reaches 0. Teams with no active convergence
 * (divisionConvergence === null) are returned unchanged — this must NEVER
 * pull every team toward the division average, only ones that actually
 * swapped divisions, or it would erase the intra-division strength spread
 * generation deliberately creates.
 */
export function stepAcademyBaseConvergence(teams: StoredTeam[]): StoredTeam[] {
  return teams.map((t) => {
    if (!t.divisionConvergence) return t;
    const center = DIVISION_ACADEMY_BASE_CENTER[t.compId as 0 | 1];
    const step = (center - t.academyBase) / t.divisionConvergence.seasonsRemaining;
    const seasonsRemaining = t.divisionConvergence.seasonsRemaining - 1;
    return {
      ...t,
      academyBase: t.academyBase + step,
      divisionConvergence: seasonsRemaining > 0 ? { seasonsRemaining } : null,
    };
  });
}
