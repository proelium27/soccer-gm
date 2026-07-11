import type { Player } from "../players/types.js";
import { scoutingNoiseSd } from "./scouting.js";
import { gaussian } from "../../engine/rng.js";
import {
  VALUATION_OVR_FLOOR, VALUATION_OVR_COEFF, VALUATION_OVR_EXPONENT, VALUATION_AGE_PEAK,
  VALUATION_AGE_FALLOFF_YOUNG, VALUATION_AGE_FALLOFF_OLD,
  VALUATION_CONTRACT_YEAR_BONUS, VALUATION_CONTRACT_YEAR_BONUS_CAP,
  VALUATION_POTENTIAL_WEIGHT_MAX, VALUATION_POTENTIAL_WEIGHT_PEAK_AGE,
  VALUATION_POTENTIAL_WEIGHT_ZERO_AGE,
} from "../constants.js";

/**
 * How much of a player's (potential - ovr) gap the market pays for, given
 * their age: full weight up to VALUATION_POTENTIAL_WEIGHT_PEAK_AGE, decaying
 * linearly to zero by VALUATION_POTENTIAL_WEIGHT_ZERO_AGE.
 */
function potentialGapWeight(age: number): number {
  if (age <= VALUATION_POTENTIAL_WEIGHT_PEAK_AGE) return VALUATION_POTENTIAL_WEIGHT_MAX;
  const span = VALUATION_POTENTIAL_WEIGHT_ZERO_AGE - VALUATION_POTENTIAL_WEIGHT_PEAK_AGE;
  const decay = (age - VALUATION_POTENTIAL_WEIGHT_PEAK_AGE) / span;
  return Math.max(0, VALUATION_POTENTIAL_WEIGHT_MAX * (1 - decay));
}

/**
 * True transfer value: replacement-level players (at/below the rating floor)
 * are worth ~nothing; value climbs steeply above that. The priced "rating"
 * blends current ovr with an age-weighted share of the (potential - ovr)
 * gap, so a young high-potential prospect is worth real money even at a
 * modest current ovr — clubs are buying the ceiling, not just today's stats.
 * Scaled by an age curve peaking at VALUATION_AGE_PEAK (separate from the
 * potential weighting above: this reflects remaining years of service at
 * whatever level the player plays at, not ceiling) and a bonus for
 * remaining contract length (harder to prise a player out of a long deal),
 * capped so a 20-year deal doesn't dominate the formula.
 */
export function trueTransferValue(player: Player, season: number): number {
  const age = season - player.born;

  const potentialGap = Math.max(0, player.potential - player.ovr);
  const effectiveRating = player.ovr + potentialGapWeight(age) * potentialGap;
  const ratingAboveFloor = Math.max(0, effectiveRating - VALUATION_OVR_FLOOR);
  const base = VALUATION_OVR_COEFF * ratingAboveFloor ** VALUATION_OVR_EXPONENT;

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
