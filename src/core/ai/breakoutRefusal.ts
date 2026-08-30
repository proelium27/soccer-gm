import type { Player } from "../players/types.js";
import type { StoredTeam } from "../teams/clubs.js";
import type { Competition } from "../competitions.js";
import { tierOf } from "../competitions.js";
import { divisionRefusalOvr } from "../constants.js";

/**
 * A player below the top flight refuses to sign a new deal with his current club
 * once he's simply too good to want to keep playing at that level — a flat OVR
 * preference per tier, not a per-club match. The bar falls as the pyramid
 * deepens (see divisionRefusalOvr), so a third-tier player wants out at a lower
 * rating than a second-tier one does, which is what keeps the tiers graded
 * relative to each other rather than all measured against the top flight.
 *
 * Simplified 2026-07-15 from an
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
export function wouldRefuseExtension(
  player: Player, currentTeam: StoredTeam, competitions: Competition[],
): boolean {
  // Each tier has its own bar and tier 1 has none, so this is one comparison
  // rather than a tier test plus a threshold: divisionRefusalOvr returns
  // Infinity for a top-flight club, which no player's ovr can reach.
  return player.ovr >= divisionRefusalOvr(tierOf(competitions, currentTeam.compId));
}
