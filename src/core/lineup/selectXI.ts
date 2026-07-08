import type { Player, Position } from "../players/types.js";

/** Positions that can cover for each other when a natural fit is unavailable. */
const ADJACENCY: Record<Position, Position[]> = {
  GK: [],
  CB: ["DM", "FB"],
  FB: ["W", "CB", "DM"],
  DM: ["CM", "CB"],
  CM: ["DM", "AM"],
  AM: ["CM", "W"],
  W: ["AM", "FB", "ST"],
  ST: ["W", "AM"],
};

/** Rank a candidate for a slot: 0 = exact, 1 = adjacent, 2 = anything. Lower is better. */
function fitRank(slot: Position, candidate: Position): number {
  if (candidate === slot) return 0;
  if (ADJACENCY[slot].includes(candidate)) return 1;
  return 2;
}

/**
 * Greedily fill each slot with the best available player: prefer exact position,
 * then adjacent, then anyone; break ties by higher ovr. Deterministic.
 */
export function selectXI(roster: Player[], slots: Position[]): Player[] {
  const available = new Set(roster.map((p) => p.pid));
  const byPid = new Map(roster.map((p) => [p.pid, p]));
  const xi: Player[] = [];

  for (const slot of slots) {
    let best: Player | null = null;
    let bestKey: [number, number] | null = null; // [fitRank, -ovr]
    for (const pid of available) {
      const p = byPid.get(pid)!;
      const key: [number, number] = [fitRank(slot, p.pos), -p.ovr];
      if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
        best = p;
        bestKey = key;
      }
    }
    if (best) {
      xi.push(best);
      available.delete(best.pid);
    }
  }
  return xi;
}
