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

/** How well a player's natural position covers a given slot. Lower is better. */
export type FitTier = 0 | 1 | 2;

/** 0 = his own position, 1 = a position he can cover, 2 = foreign to him. */
export function fitTier(slot: MatchPosition, pos: MatchPosition): FitTier {
  if (pos === slot) return 0;
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
export function familiarityPenalty(slot: MatchPosition, pos: MatchPosition): number {
  // A keeper stranded outfield, or an outfielder stranded in goal, is a
  // different order of problem from a winger at full-back.
  if ((slot === "GK") !== (pos === "GK")) return POSITION_KEEPER_PENALTY;
  switch (fitTier(slot, pos)) {
    case 0:
      return 0;
    case 1:
      return POSITION_ADJACENT_PENALTY;
    default:
      return POSITION_FOREIGN_PENALTY;
  }
}
