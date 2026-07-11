import type { Player, Position } from "../players/types.js";
import { selectXI } from "./selectXI.js";

/**
 * A manual starters array is valid for `slots` iff it has the right length,
 * no duplicate pids, every pid still resolves on the roster, and goalkeepers
 * sit exactly in GK slots. The GK rule matters because the composite rollup
 * buckets by player position, not slot: an outfielder "in goal" would leave
 * the keeping composite at its neutral default while still counting as an
 * attacker, silently corrupting the match sim.
 */
export function isValidStarters(
  roster: Player[],
  slots: Position[],
  starters: number[] | null | undefined,
): starters is number[] {
  if (!starters || starters.length !== slots.length) return false;
  if (new Set(starters).size !== starters.length) return false;
  const byPid = new Map(roster.map((p) => [p.pid, p]));
  return starters.every((pid, i) => {
    const p = byPid.get(pid);
    if (!p) return false;
    return (slots[i] === "GK") === (p.pos === "GK");
  });
}

/**
 * Use a team's manually-set starters if present and still fully valid
 * (per isValidStarters); otherwise fall back to the auto-selected best XI.
 * Manual starters can go stale after a release, sale, or injury, so any
 * mismatch silently reverts to auto-selection rather than fielding fewer
 * than 11.
 */
export function resolveXI(
  roster: Player[],
  slots: Position[],
  starters: number[] | null | undefined,
): Player[] {
  if (isValidStarters(roster, slots, starters)) {
    const byPid = new Map(roster.map((p) => [p.pid, p]));
    return starters.map((pid) => byPid.get(pid)!);
  }
  return selectXI(roster, slots);
}
