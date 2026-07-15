import type { Player } from "../players/types.js";
import type { StoredTeam } from "../teams/clubs.js";
import type { ClubContext } from "./clubContext.js";
import { valueToClub } from "./evaluate.js";
import { buyerSpendable } from "../transfers/inboundOffers.js";
import { AI_MARKET_MIN_SURPLUS } from "../constants.js";

/**
 * A Division 2 player refuses to sign a new deal with his current club once
 * he'd already be a viable transfer target for some Division 1 club —
 * mirroring real feeder-league drama (a breakout player forcing a move by
 * refusing terms) rather than staying wherever he happens to be forever.
 *
 * Reuses the exact bar Phase 2 (AI↔AI market) and Phase 3 (inbound offers)
 * already use for "would this club actually want to buy him": his value to
 * some Division 1 club must clear his value to his own club by
 * AI_MARKET_MIN_SURPLUS, AND that Division 1 club must be able to afford
 * him without dipping into its cash reserve (buyerSpendable). This is
 * deterministic (no jitter) — it's checked from independent call sites (AI
 * renewals, the user's Extend button, transfer-listing checks) that must
 * all agree on the same answer without a shared RNG seed.
 */
export function wouldRefuseExtension(
  player: Player,
  currentTeam: StoredTeam,
  teams: StoredTeam[],
  contexts: Map<number, ClubContext>,
): boolean {
  if (currentTeam.division !== 1) return false;

  const currentCtx = contexts.get(currentTeam.tid);
  if (!currentCtx) return false;
  const reservation = valueToClub(player, currentCtx);
  // A player worth nothing to his own club has no real leverage to refuse
  // with — without this guard, a zero reservation makes the surplus check
  // below (value < reservation * (1 + margin)) trivially pass for every
  // club, since 0 < 0 is false.
  if (reservation <= 0) return false;

  for (const club of teams) {
    if (club.division !== 0) continue;
    const ctx = contexts.get(club.tid);
    if (!ctx) continue;

    const value = valueToClub(player, ctx);
    if (value < reservation * (1 + AI_MARKET_MIN_SURPLUS)) continue;
    if (buyerSpendable(club, ctx, 0) < reservation) continue;

    return true;
  }

  return false;
}
