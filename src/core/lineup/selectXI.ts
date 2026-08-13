import type { Player, Position } from "../players/types.js";
import { fitTier } from "../../engine/positionFit.js";

/**
 * Rank a candidate for a slot: 0 = exact, 1 = adjacent, 2 = anything. Lower is
 * better. Shares one adjacency table with the in-match substitution logic (see
 * engine/positionFit) so the XI picker and the bench can't disagree about who
 * can cover where.
 */
function fitRank(slot: Position, candidate: Position): number {
  return fitTier(slot, candidate);
}

/**
 * Best-fit candidate for a slot from an arbitrary pool (e.g. the bench), independent
 * of `selectXI`'s whole-roster greedy fill. Same fit/ovr ordering as selectXI, with an
 * explicit pid tiebreak for determinism (selectXI relies on Set iteration order instead,
 * which is fine there since it only ever compares distinct players one at a time).
 */
export function bestFit(slot: Position, candidates: Player[]): Player | null {
  let best: Player | null = null;
  let bestKey: [number, number, number] | null = null; // [fitRank, -ovr, pid]
  for (const p of candidates) {
    const key: [number, number, number] = [fitRank(slot, p.pos), -p.ovr, p.pid];
    const better =
      !bestKey ||
      key[0] < bestKey[0] ||
      (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])));
    if (better) {
      best = p;
      bestKey = key;
    }
  }
  return best;
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
