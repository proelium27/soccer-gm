import type { Player } from "../players/types.js";
import { scoutingNoiseSd } from "./scouting.js";
import { gaussian } from "../../engine/rng.js";
import {
  VALUATION_OVR_FLOOR, VALUATION_OVR_COEFF, VALUATION_OVR_EXPONENT, VALUATION_AGE_CURVE,
  VALUATION_CONTRACT_YEAR_BONUS, VALUATION_CONTRACT_YEAR_BONUS_CAP,
  VALUATION_POTENTIAL_PCT_PER_POINT, VALUATION_POTENTIAL_WEIGHT_PEAK_AGE,
  VALUATION_POTENTIAL_WEIGHT_ZERO_AGE,
} from "../constants.js";

/** Piecewise-linear interpolation over sorted [x, y] control points, clamped at the ends. */
function interpolate(table: readonly (readonly [number, number])[], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i];
    const [x1, y1] = table[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return last[1];
}

/**
 * How much weight a player's age gives to their (potential - ovr) gap: full
 * weight up to VALUATION_POTENTIAL_WEIGHT_PEAK_AGE, decaying linearly to
 * zero by VALUATION_POTENTIAL_WEIGHT_ZERO_AGE.
 */
function potentialGapWeight(age: number): number {
  if (age <= VALUATION_POTENTIAL_WEIGHT_PEAK_AGE) return 1;
  const span = VALUATION_POTENTIAL_WEIGHT_ZERO_AGE - VALUATION_POTENTIAL_WEIGHT_PEAK_AGE;
  const decay = (age - VALUATION_POTENTIAL_WEIGHT_PEAK_AGE) / span;
  return Math.max(0, 1 - decay);
}

/**
 * True transfer value: replacement-level players (at/below the ovr floor)
 * are worth ~nothing; the base "current ability" value climbs steeply above
 * that. On top of the base, the market prices in a potential premium (a
 * percentage bump per point of (potential - ovr), age-weighted — see
 * VALUATION_POTENTIAL_PCT_PER_POINT) and an age curve (VALUATION_AGE_CURVE
 * — youth is a premium here, not a discount: clubs are buying years of
 * control and resale value), plus a bonus for remaining contract length
 * (harder to prise a player out of a long deal), capped so a 20-year deal
 * doesn't dominate the formula.
 */
export function trueTransferValue(player: Player, season: number): number {
  const age = season - player.born;

  const ovrAboveFloor = Math.max(0, player.ovr - VALUATION_OVR_FLOOR);
  const base = VALUATION_OVR_COEFF * ovrAboveFloor ** VALUATION_OVR_EXPONENT;

  const potentialGap = Math.max(0, player.potential - player.ovr);
  const potentialMultiplier =
    1 + VALUATION_POTENTIAL_PCT_PER_POINT * potentialGapWeight(age) * potentialGap;

  const ageMultiplier = interpolate(VALUATION_AGE_CURVE, age);

  const yearsRemaining = Math.max(0, player.contract.expiresSeason - season);
  const contractMultiplier = 1 + Math.min(
    VALUATION_CONTRACT_YEAR_BONUS_CAP,
    VALUATION_CONTRACT_YEAR_BONUS * yearsRemaining,
  );

  return base * potentialMultiplier * ageMultiplier * contractMultiplier;
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
