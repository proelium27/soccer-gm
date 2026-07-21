import type { Player } from "../players/types.js";
import type { TransferWindowKind } from "./window.js";
import { trueTransferValue } from "../finance/valuation.js";
import { scoutingNoiseSd } from "../finance/scouting.js";
import { gaussian, mulberry32 } from "../../engine/rng.js";
import { windowSeed } from "./negotiation.js";
import { SCOUT_COMMENTARY_GOOD_RATIO, SCOUT_COMMENTARY_BAD_RATIO } from "../constants.js";

export type ScoutCommentary =
  | { tone: "good" }
  | { tone: "bad" }
  | { tone: "counter"; suggested: number };

/**
 * A scout's take on a buyer's live offer, weighed against the player's open
 * market value (trueTransferValue) — the club-agnostic price he'd realistically
 * fetch. We deliberately do NOT benchmark against the player's value to the
 * user's own club: the opening offer is constructed to always clear that
 * reservation (see inboundOfferCandidates), so comparing to it made every
 * offer read as "great deal, take it". Market value is independent of how the
 * offer is built, so the advice actually varies with the offer.
 *
 * The scout's read of that market value is noised by scoutingNoiseSd, same as
 * perceivedTransferValue — better scouting spend means a tighter, more
 * reliable read (a low-spend scout can misjudge and give worse advice).
 * Deterministic per player/window (seeded off windowSeed) so the comment
 * doesn't change on every re-render.
 */
export function scoutCommentary(
  player: Player,
  offerFee: number,
  scoutingSpend: number,
  lid: number,
  season: number,
  window: TransferWindowKind,
): ScoutCommentary {
  const marketValue = trueTransferValue(player, season);
  const noiseSd = scoutingNoiseSd(scoutingSpend);
  const rng = mulberry32(windowSeed(lid, season, window, player.pid, 7));
  const perceived = Math.max(0, marketValue * (1 + gaussian(rng) * noiseSd));

  const ratio = perceived > 0 ? offerFee / perceived : Infinity;

  if (ratio >= SCOUT_COMMENTARY_GOOD_RATIO) return { tone: "good" };
  if (ratio < SCOUT_COMMENTARY_BAD_RATIO) return { tone: "bad" };
  return { tone: "counter", suggested: Math.round(perceived) };
}
