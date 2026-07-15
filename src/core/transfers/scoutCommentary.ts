import type { Player } from "../players/types.js";
import type { ClubContext } from "../ai/clubContext.js";
import type { TransferWindowKind } from "./window.js";
import { valueToClub } from "../ai/evaluate.js";
import { scoutingNoiseSd } from "../finance/scouting.js";
import { gaussian, mulberry32 } from "../../engine/rng.js";
import { windowSeed } from "./negotiation.js";
import { SCOUT_COMMENTARY_GOOD_RATIO, SCOUT_COMMENTARY_BAD_RATIO } from "../constants.js";

export type ScoutCommentary =
  | { tone: "good" }
  | { tone: "bad" }
  | { tone: "counter"; suggested: number };

/**
 * A scout's take on a buyer's live offer, weighed against the player's value
 * to the user's own club (the same reservation floor inboundOffers.ts uses).
 * The scout's read is noised by scoutingNoiseSd, same as perceivedTransferValue
 * — better scouting spend means a tighter, more reliable read. Deterministic
 * per player/window (seeded off windowSeed) so the comment doesn't change on
 * every re-render.
 */
export function scoutCommentary(
  player: Player,
  offerFee: number,
  userCtx: ClubContext,
  scoutingSpend: number,
  lid: number,
  season: number,
  window: TransferWindowKind,
): ScoutCommentary {
  const trueValuation = valueToClub(player, userCtx);
  const noiseSd = scoutingNoiseSd(scoutingSpend);
  const rng = mulberry32(windowSeed(lid, season, window, player.pid, 7));
  const perceived = Math.max(0, trueValuation * (1 + gaussian(rng) * noiseSd));

  const ratio = perceived > 0 ? offerFee / perceived : Infinity;

  if (ratio >= SCOUT_COMMENTARY_GOOD_RATIO) return { tone: "good" };
  if (ratio < SCOUT_COMMENTARY_BAD_RATIO) return { tone: "bad" };
  return { tone: "counter", suggested: Math.round(perceived) };
}
