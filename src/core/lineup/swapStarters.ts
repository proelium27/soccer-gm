import type { Player, Position } from "../players/types.js";
import { isValidStarters } from "./resolveXI.js";

/**
 * Resolve a drag-and-drop (or tap-to-swap) gesture on the user's lineup into a
 * new starters array, or null when the gesture is a no-op or would field an
 * illegal XI.
 *
 * Three cases, all handled by the same positional map, because `starters[i]`
 * *is* formation slot `i` (see resolveXI):
 *   bench -> XI   the bench player takes the target's slot, target is benched
 *   XI    -> bench the starter is benched, the bench player takes his slot
 *   XI    -> XI   the two starters trade slots
 *
 * That last case used to be rejected as "same list, nothing to swap", which was
 * true only while match composites bucketed by a player's natural position.
 * They bucket by *slot* now (see rollupComposites / positionFit), so moving a
 * starter from one slot to another is a real tactical change — he is weighted
 * into the new slot's phase and pays the familiarity penalty for playing there.
 *
 * Validity is delegated to `isValidStarters` rather than re-checked here: the
 * keeper rule (an outfielder in the GK slot leaves the keeping composite at a
 * neutral default while still counting as an attacker) has exactly one
 * definition, and a rejected swap must leave the lineup untouched rather than
 * be silently reverted to auto-selection by `resolveXI` on the next render.
 */
export function swapStarters(
  roster: Player[],
  slots: Position[],
  starters: number[],
  draggedPid: number,
  targetPid: number,
): number[] | null {
  if (draggedPid === targetPid) return null;
  // Two bench players: the bench has no slots, so there is nothing to reorder.
  if (!starters.includes(draggedPid) && !starters.includes(targetPid)) return null;
  const next = starters.map((pid) => {
    if (pid === targetPid) return draggedPid;
    if (pid === draggedPid) return targetPid;
    return pid;
  });
  return isValidStarters(roster, slots, next) ? next : null;
}
