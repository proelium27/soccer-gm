import type { Player, SkillKey } from "./types.js";
import { SKILL_KEYS } from "./types.js";
import { computeOvr } from "./ovr.js";
import {
  PEAK_AGE, GK_PEAK_AGE, GROWTH_RATE, GROWTH_MIN_MINUTES_FACTOR,
  FULL_SEASON_APPEARANCES, DECLINE_RATE, GK_DECLINE_RATE,
  PROGRESSION_NOISE_SD, RATING_MIN, RATING_MAX,
  RETIREMENT_START_AGE, RETIREMENT_BASE_PROB, RETIREMENT_PROB_PER_YEAR,
} from "../constants.js";

const clampRating = (x: number): number =>
  Math.round(Math.max(RATING_MIN, Math.min(RATING_MAX, x)));

/** Standard-normal sample via Box-Muller from the seeded stream. */
function gaussian(rng: () => number): number {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Age at the given season, derived from the player's birth season. */
export function ageOf(player: Player, season: number): number {
  return season - player.born;
}

/**
 * Season-end rating movement: growth toward potential while young (scaled by
 * minutes played), decline past peak (slower for GKs). Applies a uniform mean
 * delta across every rating plus independent per-rating noise, then
 * recomputes ovr. Does not mutate the input.
 */
export function progressPlayer(
  rng: () => number,
  player: Player,
  season: number,
): Player {
  const age = ageOf(player, season);
  const peak = player.pos === "GK" ? GK_PEAK_AGE : PEAK_AGE;

  const lastSeasonStats = player.stats.find((s) => s.season === season);
  const appearances = lastSeasonStats?.appearances ?? 0;

  let meanDelta: number;
  if (age <= peak) {
    const growthRoom = Math.max(0, player.potential - player.ovr);
    const minutesFactor = Math.max(
      GROWTH_MIN_MINUTES_FACTOR,
      Math.min(1, appearances / FULL_SEASON_APPEARANCES),
    );
    meanDelta = growthRoom * GROWTH_RATE * minutesFactor;
  } else {
    const yearsPastPeak = age - peak;
    const rate = player.pos === "GK" ? GK_DECLINE_RATE : DECLINE_RATE;
    meanDelta = -rate * yearsPastPeak;
  }

  const ratings = { ...player.ratings };
  for (const key of SKILL_KEYS as readonly SkillKey[]) {
    ratings[key] = clampRating(
      ratings[key] + meanDelta + gaussian(rng) * PROGRESSION_NOISE_SD,
    );
  }

  const ovr = computeOvr(player.pos, ratings, player.heightCm);

  return {
    ...player,
    ratings,
    ovr,
    hist: [...player.hist, { season, ratings, ovr }],
  };
}

/** Retirement probability: 0 below RETIREMENT_START_AGE, climbing per year after. */
export function retirementProbability(age: number): number {
  if (age < RETIREMENT_START_AGE) return 0;
  return Math.min(
    0.95,
    RETIREMENT_BASE_PROB + (age - RETIREMENT_START_AGE) * RETIREMENT_PROB_PER_YEAR,
  );
}

/** Roll whether a player retires at the end of the given season. */
export function rollRetirement(
  rng: () => number,
  player: Player,
  season: number,
): boolean {
  return rng() < retirementProbability(ageOf(player, season));
}
