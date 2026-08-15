import type { Player, Position } from "../players/types.js";
import { selectXI } from "./selectXI.js";

export const FORMATION_IDS = [
  "4-3-3",
  "4-4-2",
  "3-5-2",
  "5-3-2",
  "4-2-3-1",
  "4-5-1",
  "3-4-3",
  "5-4-1",
  "4-3-1-2",
  "4-4-1-1",
  "4-3-2-1",
  "4-2-2-2",
  "3-4-2-1",
  "3-5-1-1",
  "5-2-3",
  "5-2-1-2",
] as const;
export type FormationId = (typeof FORMATION_IDS)[number];

/**
 * Each formation is the multiset of position slots to fill (always 11).
 *
 * Every shape here must be a *distinct multiset* (a test pins this). The sim
 * buckets composites by slot and knows nothing about where on the pitch a slot
 * is drawn, so two shapes with the same slots are the same team to the engine:
 * 4-1-4-1 is GK/CB2/FB2/DM/CM2/W2/ST, i.e. exactly 4-3-3, and 4-2-4 is exactly
 * 4-4-2. Adding those would only add ties for chooseBestFormation to break.
 *
 * That also means the back-3 vs back-5 distinction can't be the wing-backs'
 * height (there's no such axis) — it's carried by the midfield band instead:
 * 3-4-3 fields two CMs where 5-2-3 fields two DMs, so the "five" really does
 * defend more. Same for 3-5-2 (CM2 + AM) against 5-2-1-2 (DM2 + AM).
 *
 * Order is load-bearing: chooseBestFormation breaks ties by this order, so
 * 4-3-3 must stay first (it's the default) and new shapes are appended.
 */
export const FORMATIONS: Record<FormationId, Position[]> = {
  "4-3-3": ["GK", "CB", "CB", "FB", "FB", "DM", "CM", "CM", "W", "W", "ST"],
  "4-4-2": ["GK", "CB", "CB", "FB", "FB", "W", "CM", "CM", "W", "ST", "ST"],
  "3-5-2": ["GK", "CB", "CB", "CB", "FB", "FB", "CM", "CM", "AM", "ST", "ST"],
  "5-3-2": ["GK", "CB", "CB", "CB", "FB", "FB", "DM", "CM", "CM", "ST", "ST"],
  "4-2-3-1": ["GK", "CB", "CB", "FB", "FB", "DM", "DM", "W", "AM", "W", "ST"],
  "4-5-1": ["GK", "CB", "CB", "FB", "FB", "CM", "CM", "CM", "W", "W", "ST"],
  "3-4-3": ["GK", "CB", "CB", "CB", "FB", "FB", "CM", "CM", "W", "W", "ST"],
  "5-4-1": ["GK", "CB", "CB", "CB", "FB", "FB", "DM", "CM", "W", "W", "ST"],
  "4-3-1-2": ["GK", "CB", "CB", "FB", "FB", "DM", "CM", "CM", "AM", "ST", "ST"],
  "4-4-1-1": ["GK", "CB", "CB", "FB", "FB", "W", "CM", "CM", "W", "AM", "ST"],
  "4-3-2-1": ["GK", "CB", "CB", "FB", "FB", "DM", "CM", "CM", "AM", "AM", "ST"],
  "4-2-2-2": ["GK", "CB", "CB", "FB", "FB", "DM", "DM", "AM", "AM", "ST", "ST"],
  "3-4-2-1": ["GK", "CB", "CB", "CB", "FB", "FB", "CM", "CM", "AM", "AM", "ST"],
  "3-5-1-1": ["GK", "CB", "CB", "CB", "FB", "FB", "DM", "CM", "CM", "AM", "ST"],
  "5-2-3": ["GK", "CB", "CB", "CB", "FB", "FB", "DM", "DM", "W", "W", "ST"],
  "5-2-1-2": ["GK", "CB", "CB", "CB", "FB", "FB", "DM", "DM", "AM", "ST", "ST"],
};

/** The formation a club plays; defaults to 4-3-3 when unset (every AI team, and the game default). */
export function teamFormation(team: { formation?: FormationId | null }): FormationId {
  return team.formation ?? "4-3-3";
}

/** The slot array for a club's current formation. */
export function teamSlots(team: { formation?: FormationId | null }): Position[] {
  return FORMATIONS[teamFormation(team)];
}

/**
 * The formation whose auto-picked XI (via selectXI) has the highest combined
 * OVR for this roster — i.e. the shape that lets a club field its strongest
 * eleven. Used to pick every AI club's formation from its current squad. When
 * a roster has 11 or fewer players every formation fields the same set, so all
 * tie and the first (4-3-3) wins; the choice only bites once a roster is deep
 * enough that different shapes start different players (e.g. a squad rich in
 * strikers scores higher in a two-striker shape). Deterministic: ties break by
 * FORMATION_IDS order.
 */
export function chooseBestFormation(roster: Player[]): FormationId {
  let best: FormationId = "4-3-3";
  let bestScore = -Infinity;
  for (const id of FORMATION_IDS) {
    const xi = selectXI(roster, FORMATIONS[id]);
    const score = xi.reduce((sum, p) => sum + p.ovr, 0);
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}
