import type { Position } from "../players/types.js";

export const FORMATION_IDS = ["4-3-3", "4-4-2", "3-5-2", "5-3-2"] as const;
export type FormationId = (typeof FORMATION_IDS)[number];

/** Each formation is the multiset of position slots to fill (always 11). */
export const FORMATIONS: Record<FormationId, Position[]> = {
  "4-3-3": ["GK", "CB", "CB", "FB", "FB", "DM", "CM", "CM", "W", "W", "ST"],
  "4-4-2": ["GK", "CB", "CB", "FB", "FB", "W", "CM", "CM", "W", "ST", "ST"],
  "3-5-2": ["GK", "CB", "CB", "CB", "FB", "FB", "CM", "CM", "AM", "ST", "ST"],
  "5-3-2": ["GK", "CB", "CB", "CB", "FB", "FB", "DM", "CM", "CM", "ST", "ST"],
};

/** The formation a club plays; defaults to 4-3-3 when unset (every AI team, and the game default). */
export function teamFormation(team: { formation?: FormationId | null }): FormationId {
  return team.formation ?? "4-3-3";
}

/** The slot array for a club's current formation. */
export function teamSlots(team: { formation?: FormationId | null }): Position[] {
  return FORMATIONS[teamFormation(team)];
}
