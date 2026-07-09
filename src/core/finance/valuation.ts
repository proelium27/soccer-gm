import type { Player } from "../players/types.js";
import { scoutingNoiseSd } from "./scouting.js";
import { gaussian } from "../../engine/rng.js";
import {
  VALUATION_OVR_FLOOR, VALUATION_OVR_COEFF, VALUATION_OVR_EXPONENT, VALUATION_AGE_PEAK,
  VALUATION_AGE_FALLOFF_YOUNG, VALUATION_AGE_FALLOFF_OLD,
  VALUATION_CONTRACT_YEAR_BONUS, VALUATION_CONTRACT_YEAR_BONUS_CAP,
} from "../constants.js";

/**
 * True transfer value: replacement-level players (at/below the ovr floor)
 * are worth ~nothing; value climbs steeply above that. Scaled by an age
 * curve peaking at VALUATION_AGE_PEAK (young players with headroom fall off
 * slowly, aging players fall off fast) and a bonus for remaining contract
 * length (harder to prise a player out of a long deal), capped so a 20-year
 * deal doesn't dominate the formula.
 */
export function trueTransferValue(player: Player, season: number): number {
  const ovrAboveFloor = Math.max(0, player.ovr - VALUATION_OVR_FLOOR);
  const base = VALUATION_OVR_COEFF * ovrAboveFloor ** VALUATION_OVR_EXPONENT;

  const age = season - player.born;
  const ageDelta = age - VALUATION_AGE_PEAK;
  const falloff = ageDelta >= 0 ? VALUATION_AGE_FALLOFF_OLD : VALUATION_AGE_FALLOFF_YOUNG;
  const ageMultiplier = Math.max(0.1, 1 - falloff * Math.abs(ageDelta));

  const yearsRemaining = Math.max(0, player.contract.expiresSeason - season);
  const contractMultiplier = 1 + Math.min(
    VALUATION_CONTRACT_YEAR_BONUS_CAP,
    VALUATION_CONTRACT_YEAR_BONUS * yearsRemaining,
  );

  return base * ageMultiplier * contractMultiplier;
}

/**
 * The value a scouting department reports to the user: the true value with
 * gaussian noise applied, scaled down by scouting spend (better scouts =
 * tighter estimate). Can be used as the baseline for offers in negotiation.
 */
export function perceivedTransferValue(
  rng: () => number,
  player: Player,
  season: number,
  scoutingSpend: number,
): number {
  const trueValue = trueTransferValue(player, season);
  const noiseSd = scoutingNoiseSd(scoutingSpend);
  const noisy = trueValue * (1 + gaussian(rng) * noiseSd);
  return Math.max(0, Math.round(noisy));
}
