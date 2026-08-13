import type { Player, Position } from "../players/types.js";
import { fitTier } from "../../engine/positionFit.js";
import { ovrAtSlot, secondaryPositions } from "../players/positions.js";

/**
 * Rank a candidate for a slot: 0 = a job he knows, 1 = adjacent, 2 = anything.
 * Lower is better. Shares one adjacency table with the in-match substitution
 * logic (see engine/positionFit) so the XI picker and the bench can't disagree
 * about who can cover where.
 *
 * A secondary position ranks as exact, which is where versatility earns its
 * keep: a genuine utility man is now a first-choice candidate for the slot he
 * doubles at, so he can beat a weaker specialist to it on ovr. Before this,
 * fit was strictly by listed position and a 74-rated winger who really does
 * play full-back always lost that slot to a 66-rated full-back.
 */
function fitRank(slot: Position, candidate: Player): number {
  return fitTier(slot, candidate.pos, secondaryPositions(candidate));
}

/**
 * Best-fit candidate for a slot from an arbitrary pool (e.g. the bench), independent
 * of `selectXI`'s whole-roster greedy fill. Same fit/ovr ordering as selectXI, with an
 * explicit pid tiebreak for determinism (selectXI relies on Set iteration order instead,
 * which is fine there since it only ever compares distinct players one at a time).
 */
export function bestFit(slot: Position, candidates: Player[]): Player | null {
  let best: Player | null = null;
  let bestKey: [number, number, number] | null = null; // [fitRank, -ovrAtSlot, pid]
  for (const p of candidates) {
    const key: [number, number, number] = [fitRank(slot, p), -ovrAtSlot(p, slot), p.pid];
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
    let bestKey: [number, number] | null = null; // [fitRank, -ovrAtSlot]
    for (const pid of available) {
      const p = byPid.get(pid)!;
      const key: [number, number] = [fitRank(slot, p), -ovrAtSlot(p, slot)];
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
