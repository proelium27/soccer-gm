import type { StandingsRow } from "./standings.js";
import type { StoredTeam } from "./teams/clubs.js";
import type { Competition } from "./competitions.js";
import { tier1Pairs, competitionOf, academyBaseCenterOf } from "./competitions.js";
import {
  PROMOTION_RELEGATION_COUNT, ACADEMY_BASE_CONVERGENCE_SEASONS,
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
 * How many clubs actually change division in one country this offseason: the
 * save's chosen count, held to something both tables can supply.
 *
 * The clamp is not just defensiveness. A save picks one count for the whole
 * world, but divisions can be different sizes (see Competition.teamCount), so a
 * world with a 10-club second division and 6-up-6-down would otherwise promote
 * more than half of it — and asking for more clubs than a table holds would
 * swap the two divisions wholesale.
 */
export function promotionSpots(count: number, d1Size: number, d2Size: number): number {
  // A non-finite count would survive the clamp as NaN, and `slice(-NaN)` is
  // `slice(0)` — the whole table again. Treat anything that isn't a number as
  // no swap rather than every swap.
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.min(Math.floor(count), d1Size, d2Size));
}

/**
 * For every country, bottom N of its tier-1 final table swap with top N of its
 * tier-2 final table, where N is the save's promotionRelegationCount (3 by
 * default, chosen on the New League screen and fixed for the save's life).
 * Every table in `tablesByCompId` must already be sorted by computeStandings
 * (points, then GD, then GF, then tid).
 */
export function computeCountrySwaps(
  competitions: Competition[],
  tablesByCompId: Map<number, StandingsRow[]>,
  count: number = PROMOTION_RELEGATION_COUNT,
): CompetitionSwap[] {
  return tier1Pairs(competitions).flatMap(({ d1, d2 }) => {
    // Nothing to swap with: a one-division country has no tier 2 to send clubs
    // down to, so it simply has no promotion or relegation.
    if (!d2) return [];
    const d1Table = tablesByCompId.get(d1.id)!;
    const d2Table = tablesByCompId.get(d2.id)!;
    const n = promotionSpots(count, d1Table.length, d2Table.length);
    // `slice(-0)` is `slice(0)` — the WHOLE table — so a save set to no
    // promotion or relegation would relegate every club in the division. The
    // early return is the only thing standing between that setting and a world
    // that turns itself inside out every offseason.
    if (n === 0) return [];
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
