import type { Player } from "../players/types.js";
import type { StoredTeam } from "../teams/clubs.js";
import { DIVISION_2_REFUSAL_OVR_THRESHOLD } from "../constants.js";

/**
 * A Division 2 player refuses to sign a new deal with his current club once
 * he's simply too good to want to keep playing Division 2 football — a flat
 * OVR preference, not a per-club match. Simplified 2026-07-15 from an
 * earlier version that required finding one specific Division 1 club that
 * both valued him above his own club's reservation and could afford him:
 * that version was realistic in theory (a poor Division 2 club genuinely
 * can't compete for a star), but in practice it depended on which specific
 * clubs happened to have cash/need that window, was expensive to compute
 * (a full per-club valueToClub sweep), and needed `teams`/`contexts` at
 * every call site just to answer what's fundamentally a question about the
 * player himself. This version is deterministic and self-contained — no
 * club context needed — so a good player wants out of Division 2 the moment
 * he's good enough, independent of any specific buyer's situation that
 * window.
 */
export function wouldRefuseExtension(player: Player, currentTeam: StoredTeam): boolean {
  return currentTeam.division === 1 && player.ovr >= DIVISION_2_REFUSAL_OVR_THRESHOLD;
}
