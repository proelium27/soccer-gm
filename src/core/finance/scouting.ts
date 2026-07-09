import {
  SCOUTING_SPEND_MAX, SCOUTING_SPEND_MIN, SCOUTING_NOISE_SD_MAX_SPEND, SCOUTING_NOISE_SD_MIN_SPEND,
} from "../constants.js";
import { clamp } from "../util.js";

/**
 * Higher scouting spend linearly lowers the noise (std dev, as a fraction of
 * true value) applied to perceived transfer valuations and recommended-
 * transfer quality. No discrete tiers, per design — just a slider.
 */
export function scoutingNoiseSd(spend: number): number {
  const frac = clamp(
    (spend - SCOUTING_SPEND_MIN) / (SCOUTING_SPEND_MAX - SCOUTING_SPEND_MIN),
    0,
    1,
  );
  return SCOUTING_NOISE_SD_MIN_SPEND + frac * (SCOUTING_NOISE_SD_MAX_SPEND - SCOUTING_NOISE_SD_MIN_SPEND);
}

/** Clamp a proposed scouting spend into the allowed range and the club's budget. */
export function clampScoutingSpend(spend: number, budget: number): number {
  return clamp(spend, SCOUTING_SPEND_MIN, Math.min(SCOUTING_SPEND_MAX, Math.max(budget, 0)));
}
