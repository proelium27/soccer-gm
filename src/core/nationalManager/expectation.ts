/**
 * What a federation expects, and how big a job a country is.
 *
 * **The club board's central problem does not exist here, and that is worth
 * stating rather than leaving implicit.** `core/manager/expectation.ts` goes to
 * some trouble to build a club's standing out of things a transfer window
 * cannot touch, because squad quality is the one variable a club manager fully
 * controls — grade them on it and tearing the team down lowers the bar with it.
 * A national manager controls nothing of the sort: they cannot sign, sell,
 * release or develop a single player, and who is born in their country is
 * decided by the world. So the strength of the nation's players is a safe,
 * honest and completely un-gameable bar, and it is the one used.
 *
 * The one thing the user *can* do is name a weak squad, so expectation is read
 * off `IntlPowerSnapshot` — which `buildPowerSnapshot` computes from each
 * nation's **best available** eleven via `selectSquad`, not from whoever was
 * actually called up. Reading the named squad's own `rating` instead would hand
 * the user a lever to lower their own bar, which is precisely the trap the club
 * side exists to avoid. Do not "simplify" this to `squad.rating`.
 *
 * Pure and rng-free.
 */
import type { IntlPowerSnapshot } from "../international/types.js";
import { confederationOf } from "../international/confederations.js";

export interface NationExpectation {
  nation: string;
  /** The nation's confederation, or null if it somehow has none. */
  confederation: string | null;
  /** Where it ranks among the nations being compared, 1 = strongest. */
  rank: number;
  /** How many nations were ranked. */
  nations: number;
  /** Best-available squad rating, the number the rank is read off. */
  rating: number;
  /**
   * How big a job this is, [0,1], from its rank rather than its raw rating: 1
   * for the strongest nation in the world, 0 for the weakest. Rank rather than
   * rating because the ratings bunch up in the middle, and "are you a top-ten
   * nation" is the question both offers and demands actually ask.
   */
  prestige: number;
  /**
   * How much this federation demands, [0,1]. Equal to prestige — unlike a club,
   * where the board's demands blend the club's standing with its league's, a
   * nation has no league to sit inside. Brazil's federation expects to win
   * because Brazil's players are the best, and that is the whole story.
   */
  demand: number;
}

/**
 * Rank every nation in `snapshot`, strongest first.
 *
 * Returns an empty map for a missing or empty snapshot — a save whose world is
 * too small to field international football has nothing to rank, and callers
 * treat "no expectation" as "nothing to judge".
 */
export function nationExpectations(
  snapshot: IntlPowerSnapshot | null | undefined,
): Map<string, NationExpectation> {
  const out = new Map<string, NationExpectation>();
  const ranks = snapshot?.ranks ?? [];
  const n = ranks.length;
  if (n === 0) return out;

  // The snapshot is already strongest-first (buildSquads sorts it), but sorting
  // again costs nothing and means a hand-built or migrated snapshot can't quietly
  // invert every expectation in the game.
  const sorted = [...ranks].sort((a, b) => b.rating - a.rating || a.nation.localeCompare(b.nation));
  sorted.forEach((row, i) => {
    const rank = i + 1;
    const prestige = n > 1 ? (n - rank) / (n - 1) : 1;
    out.set(row.nation, {
      nation: row.nation,
      confederation: confederationOf(row.nation),
      rank,
      nations: n,
      rating: row.rating,
      prestige,
      demand: prestige,
    });
  });
  return out;
}

/**
 * Where a nation was expected to finish *within one campaign's field*, and how
 * big that field is.
 *
 * A campaign is not the whole world: a confederation cup is contested by one
 * confederation, and a World Cup by whoever qualified. Ranking the field's
 * members against each other — by their world snapshot ratings, so the ordering
 * still comes from the un-gameable source — is what makes "you were the third
 * best team here and you went out in the group" a statement about this
 * tournament rather than about the planet.
 *
 * A nation missing from the snapshot (newly eligible, or a snapshot that
 * predates it) sorts last on a rating of 0 rather than being dropped, so the
 * field size stays honest.
 */
export function fieldExpectation(
  field: string[],
  nation: string,
  snapshot: IntlPowerSnapshot | null | undefined,
): { rank: number; nations: number } | null {
  if (!field.includes(nation)) return null;
  const ratings = new Map((snapshot?.ranks ?? []).map((r) => [r.nation, r.rating]));
  const sorted = [...field].sort(
    (a, b) => (ratings.get(b) ?? 0) - (ratings.get(a) ?? 0) || a.localeCompare(b),
  );
  return { rank: sorted.indexOf(nation) + 1, nations: sorted.length };
}
