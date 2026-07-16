import type { StandingsRow } from "./standings.js";
import type { StoredTeam } from "./teams/clubs.js";
import type { Competition } from "./competitions.js";
import { partnerOf, tierOf } from "./competitions.js";
import {
  PROMOTION_RELEGATION_COUNT, ACADEMY_BASE_CONVERGENCE_SEASONS, ACADEMY_BASE_CENTER_BY_TIER,
} from "./constants.js";

/** One country's promotion/relegation swap between its tier-1 and tier-2 competitions. */
export interface CompetitionSwap {
  d1CompId: number;
  d2CompId: number;
  /** Tids moving from the tier-2 competition up to tier 1. */
  promoted: number[];
  /** Tids moving from the tier-1 competition down to tier 2. */
  relegated: number[];
}

/**
 * For every country, bottom PROMOTION_RELEGATION_COUNT of its tier-1 final
 * table swap with top PROMOTION_RELEGATION_COUNT of its tier-2 final table.
 * Every table in `tablesByCompId` must already be sorted by computeStandings
 * (points, then GD, then GF, then tid).
 */
export function computeCountrySwaps(
  competitions: Competition[],
  tablesByCompId: Map<number, StandingsRow[]>,
): CompetitionSwap[] {
  return competitions
    .filter((c) => c.tier === 1)
    .map((d1) => {
      const d2 = partnerOf(competitions, d1.id);
      const d1Table = tablesByCompId.get(d1.id)!;
      const d2Table = tablesByCompId.get(d2.id)!;
      return {
        d1CompId: d1.id,
        d2CompId: d2.id,
        promoted: d2Table.slice(0, PROMOTION_RELEGATION_COUNT).map((r) => r.tid),
        relegated: d1Table.slice(-PROMOTION_RELEGATION_COUNT).map((r) => r.tid),
      };
    });
}

/**
 * Move each swapped team into its new competition and start (or restart) its
 * academyBase convergence toward the new competition's strength center.
 * Teams not in any swap are returned unchanged.
 */
export function applyCompetitionSwaps(teams: StoredTeam[], swaps: CompetitionSwap[]): StoredTeam[] {
  const moveTo = new Map<number, number>();
  for (const s of swaps) {
    for (const tid of s.promoted) moveTo.set(tid, s.d1CompId);
    for (const tid of s.relegated) moveTo.set(tid, s.d2CompId);
  }
  return teams.map((t) =>
    moveTo.has(t.tid)
      ? {
          ...t,
          compId: moveTo.get(t.tid)!,
          divisionConvergence: { seasonsRemaining: ACADEMY_BASE_CONVERGENCE_SEASONS },
        }
      : t,
  );
}

/**
 * Move every mid-convergence team's academyBase one season closer to its
 * current competition's tier center, decrementing seasonsRemaining and
 * clearing divisionConvergence once it reaches 0. Teams with no active
 * convergence (divisionConvergence === null) are returned unchanged — this
 * must NEVER pull every team toward the tier average, only ones that
 * actually swapped competitions, or it would erase the intra-competition
 * strength spread generation deliberately creates.
 */
export function stepAcademyBaseConvergence(
  teams: StoredTeam[],
  competitions: Competition[],
): StoredTeam[] {
  return teams.map((t) => {
    if (!t.divisionConvergence) return t;
    const center = ACADEMY_BASE_CENTER_BY_TIER[tierOf(competitions, t.compId)];
    const step = (center - t.academyBase) / t.divisionConvergence.seasonsRemaining;
    const seasonsRemaining = t.divisionConvergence.seasonsRemaining - 1;
    return {
      ...t,
      academyBase: t.academyBase + step,
      divisionConvergence: seasonsRemaining > 0 ? { seasonsRemaining } : null,
    };
  });
}
