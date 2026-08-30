import type { StandingsRow } from "./standings.js";
import type { StoredTeam } from "./teams/clubs.js";
import type { Competition } from "./competitions.js";
import {
  tier1Pairs, competitionOf, academyBaseCenterOf, effectivePromotionSpots,
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
 *
 * `playoffWinners` (tier-2 compId -> tid) is how a promotion playoff reaches the
 * swap: where a country held one, only the top **N-1** go up on the table and
 * the last place goes to the club that won the playoff. The count is unchanged
 * either way — the playoff decides *who* takes the last place, never how many go
 * up, because every division's size is fixed and one extra club promoted would
 * mean one extra relegated. Absent (a headless caller, a world with no eligible
 * country, a save from before playoffs existed) means the plain top-N slice,
 * which is exactly the old behaviour.
 */
export function computeCountrySwaps(
  competitions: Competition[],
  tablesByCompId: Map<number, StandingsRow[]>,
  playoffWinners?: Map<number, number>,
): CompetitionSwap[] {
  return tier1Pairs(competitions).flatMap(({ d1, d2 }) => {
    // Nothing to swap with: a one-division country has no tier 2 to send clubs
    // down to, so it simply has no promotion or relegation.
    if (!d2) return [];
    const d1Table = tablesByCompId.get(d1.id)!;
    const d2Table = tablesByCompId.get(d2.id)!;
    const n = effectivePromotionSpots(d1, d2, d1Table.length, d2Table.length);
    // `slice(-0)` is `slice(0)` — the WHOLE table — so a league set to no
    // promotion or relegation would relegate every club in its division. The
    // early return is the only thing standing between that setting and a world
    // that turns itself inside out every offseason.
    if (n <= 0) return [];
    // A playoff winner always comes from a position *below* the automatic
    // places (see promotionPlayoffFields), so he can never also be in the top
    // n-1 slice and `promoted` cannot end up holding a club twice.
    const playoffWinner = playoffWinners?.get(d2.id);
    const promoted =
      playoffWinner === undefined
        ? d2Table.slice(0, n).map((r) => r.tid)
        : [...d2Table.slice(0, n - 1).map((r) => r.tid), playoffWinner];
    return {
      d1CompId: d1.id,
      d2CompId: d2.id,
      promoted,
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
