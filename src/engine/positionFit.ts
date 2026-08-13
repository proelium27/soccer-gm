import type { MatchPosition } from "./attribution.js";
import {
  POSITION_ADJACENT_PENALTY,
  POSITION_FOREIGN_PENALTY,
  POSITION_KEEPER_PENALTY,
} from "./constants.js";

/**
 * Positions that can cover for each other when a natural fit is unavailable.
 * A full-back covers at wing-back or centre-back; a striker does not cover at
 * centre-back. Deliberately NOT symmetric in spirit (though it happens to be
 * here): it reads as "who can do this job passably", not "who is nearby".
 *
 * This lives in the engine rather than core/lineup because both the XI picker
 * (core) and the in-match substitution logic (engine) need the same table, and
 * the engine never imports from core.
 */
export const ADJACENCY: Record<MatchPosition, MatchPosition[]> = {
  GK: [],
  CB: ["DM", "FB"],
  FB: ["W", "CB", "DM"],
  DM: ["CM", "CB"],
  CM: ["DM", "AM"],
  AM: ["CM", "W"],
  W: ["AM", "FB", "ST"],
  ST: ["W", "AM"],
};

/**
 * The slots a player of a given position can cover — the REVERSE of ADJACENCY.
 *
 * The distinction is easy to miss and matters: `ADJACENCY[X]` lists positions
 * whose players can fill slot X, so asking "where else can this player play"
 * means scanning for him in every other position's list, not reading his own.
 * The table is not symmetric, so the two really do differ — a defensive mid can
 * cover at full-back, but a full-back cannot cover in defensive midfield; a
 * winger can play up front, but a striker is not thereby an attacking mid.
 *
 * Derived from ADJACENCY at module load rather than written out, so the pair
 * cannot drift apart when the adjacency table is edited.
 */
export const COVERABLE: Record<MatchPosition, MatchPosition[]> = (() => {
  const out = {} as Record<MatchPosition, MatchPosition[]>;
  const slots = Object.keys(ADJACENCY) as MatchPosition[];
  for (const pos of slots) out[pos] = [];
  for (const slot of slots) {
    for (const pos of ADJACENCY[slot]) out[pos].push(slot);
  }
  return out;
})();

/** How well a player's natural position covers a given slot. Lower is better. */
export type FitTier = 0 | 1 | 2;

/**
 * 0 = a job he knows, 1 = a position he can cover, 2 = foreign to him.
 *
 * `secondary` is the list of other positions he genuinely plays (derived from
 * his attributes — see core/players/positions.ts). A secondary counts as an
 * exact fit, which is the whole point of the feature: a real utility player
 * costs his side nothing for filling in, where a specialist pushed into the
 * same slot does. It is passed in rather than derived here because computing it
 * needs the per-position OVR model, which lives in core — and the engine never
 * imports from core.
 */
export function fitTier(
  slot: MatchPosition,
  pos: MatchPosition,
  secondary: readonly MatchPosition[] = [],
): FitTier {
  if (pos === slot) return 0;
  if (secondary.includes(slot)) return 0;
  if (ADJACENCY[slot].includes(pos)) return 1;
  return 2;
}

/**
 * The rating-point cost of playing `pos` in `slot`, on the same 0-100 scale as
 * a player's raw skills (so it reads directly against the OVR scale: roughly,
 * a foreign-position penalty turns a good starter into a below-average one).
 *
 * Expressed as points rather than a multiplier on purpose. Composite qualities
 * cluster around 0.5-0.7, so a "mild-sounding" 0.9x is really a ~15-point hit;
 * points stay interpretable and tune predictably.
 *
 * Used in two places that must agree, or the sim contradicts itself: the
 * composite rollup (how well the XI actually plays) and the substitution
 * decision (whether bringing this man on for that slot is worth it).
 */
export function familiarityPenalty(
  slot: MatchPosition,
  pos: MatchPosition,
  secondary: readonly MatchPosition[] = [],
): number {
  // A keeper stranded outfield, or an outfielder stranded in goal, is a
  // different order of problem from a winger at full-back. Checked ahead of
  // `secondary` so no derivation can ever hand out a free pass into goal —
  // keepers have no COVERABLE entry, so this is belt-and-braces.
  if ((slot === "GK") !== (pos === "GK")) return POSITION_KEEPER_PENALTY;
  switch (fitTier(slot, pos, secondary)) {
    case 0:
      return 0;
    case 1:
      return POSITION_ADJACENT_PENALTY;
    default:
      return POSITION_FOREIGN_PENALTY;
  }
}
