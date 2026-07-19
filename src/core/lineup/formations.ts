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
] as const;
export type FormationId = (typeof FORMATION_IDS)[number];

/** Each formation is the multiset of position slots to fill (always 11). */
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
