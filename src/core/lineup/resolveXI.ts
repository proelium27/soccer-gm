import type { Player, Position } from "../players/types.js";
import { selectXI } from "./selectXI.js";

/**
 * Use a team's manually-set starters if present and still fully valid (all
 * pids still exist on the given roster); otherwise fall back to the
 * auto-selected best XI. Manual starters can go stale after a release, sale,
 * or injury, so any mismatch silently reverts to auto-selection rather than
 * fielding fewer than 11.
 */
export function resolveXI(
  roster: Player[],
  slots: Position[],
  starters: number[] | null | undefined,
): Player[] {
  if (starters && starters.length === slots.length) {
    const byPid = new Map(roster.map((p) => [p.pid, p]));
    const xi = starters.map((pid) => byPid.get(pid)).filter((p): p is Player => p !== undefined);
    if (xi.length === slots.length) return xi;
  }
  return selectXI(roster, slots);
}
