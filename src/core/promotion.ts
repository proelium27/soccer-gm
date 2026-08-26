import type { StandingsRow } from "./standings.js";
import type { StoredTeam } from "./teams/clubs.js";
import type { Competition } from "./competitions.js";
import {
  tier1Pairs, competitionOf, academyBaseCenterOf, competitionPromotionSpots,
} from "./competitions.js";
import { ACADEMY_BASE_CONVERGENCE_SEASONS } from "./constants.js";

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
 * For every country, the bottom N of its tier-1 final table swap with the top N
 * of its tier-2 final table, where N is that country's own
 * `competitionPromotionSpots` (3 unless the league was added with a different
 * number on the New League screen). Every table in `tablesByCompId` must
 * already be sorted by computeStandings (points, then GD, then GF, then tid).
 */
export function computeCountrySwaps(
  competitions: Competition[],
  tablesByCompId: Map<number, StandingsRow[]>,
): CompetitionSwap[] {
  return tier1Pairs(competitions).flatMap(({ d1, d2 }) => {
    // Nothing to swap with: a one-division country has no tier 2 to send clubs
    // down to, so it simply has no promotion or relegation.
    if (!d2) return [];
    const d1Table = tablesByCompId.get(d1.id)!;
    const d2Table = tablesByCompId.get(d2.id)!;
    const n = Math.min(
      competitionPromotionSpots(d1, d2), d1Table.length, d2Table.length,
    );
    // `slice(-0)` is `slice(0)` — the WHOLE table — so a league set to no
    // promotion or relegation would relegate every club in its division. The
    // early return is the only thing standing between that setting and a world
    // that turns itself inside out every offseason.
    if (n <= 0) return [];
    return {
      d1CompId: d1.id,
      d2CompId: d2.id,
      promoted: d2Table.slice(0, n).map((r) => r.tid),
      relegated: d1Table.slice(-n).map((r) => r.tid),
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
    const comp = competitionOf(competitions, t.compId);
    const center = academyBaseCenterOf(comp);
    const step = (center - t.academyBase) / t.divisionConvergence.seasonsRemaining;
    const seasonsRemaining = t.divisionConvergence.seasonsRemaining - 1;
    return {
      ...t,
      academyBase: t.academyBase + step,
      divisionConvergence: seasonsRemaining > 0 ? { seasonsRemaining } : null,
    };
  });
}
