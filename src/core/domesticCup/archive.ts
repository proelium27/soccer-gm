import type { DomesticCupState } from "./types.js";
import { aggregateDomesticStats } from "./stats.js";

/**
 * Collapse a finished domestic cup for storage: fold its box scores into one
 * stat line per player, then drop the box scores.
 *
 * Same trade the Continental Cup makes at the same point in the offseason, and
 * for the same reason — save size is what freezes the game, and eight domestic
 * cups a season is a lot of box scores to keep forever (39 ties per country per
 * season on a standard world). Nothing displayed is lost: scorelines, winners,
 * the draw and each club's run are all stored separately.
 *
 * Idempotent, and safe on a cup whose box scores are already partly gone.
 */
export function archiveDomesticCup(cup: DomesticCupState): DomesticCupState {
  const statLines = cup.statLines ?? aggregateDomesticStats(cup);
  return {
    ...cup,
    statLines,
    rounds: (cup.rounds ?? []).map((r) => ({
      ...r,
      ties: (r.ties ?? []).map((t) => (t.boxScore === null ? t : { ...t, boxScore: null })),
    })),
  };
}
