import type { Player, PlayerRatings, SkillKey } from "./types.js";
import { computeOvr } from "./ovr.js";
import { gaussian } from "../../engine/rng.js";
import {
  BASE_AGE_CURVE, BASE_AGE_CURVE_PEAK, PHYSICAL_AGE_SHIFT, SKILL_AGE_SHIFT,
  GK_AGE_SHIFT,
  MINUTES_FACTOR_MIN, MINUTES_FACTOR_MAX, FULL_SEASON_APPEARANCES,
  PROGRESSION_NOISE_SD_YOUNG, PROGRESSION_NOISE_SD_OLD,
  PROGRESSION_FORM_SD_YOUNG, PROGRESSION_FORM_SD_OLD,
  POTENTIAL_SIM_TRIALS, POTENTIAL_SIM_MAX_AGE, POTENTIAL_SIM_PERCENTILE,
  RATING_MIN, RATING_MAX,
  RETIREMENT_START_AGE, RETIREMENT_BASE_PROB, RETIREMENT_PROB_PER_YEAR,
} from "../constants.js";

/** Physical ratings peak earliest and decline first. */
const PHYSICAL_KEYS: readonly SkillKey[] = ["speed", "strength", "stamina", "jumping"];
/** Everything else: technical/mental skills (plus goalkeeping) peak later and decline slower. */
const SKILL_KEYS_GROUP: readonly SkillKey[] = [
  "shortPass", "longPass", "crosses", "dribbling", "longShot", "finishing",
  "tackling", "interceptions", "positioning", "goalkeeping",
];

const clampRating = (x: number): number =>
  Math.round(Math.max(RATING_MIN, Math.min(RATING_MAX, x)));

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

/** Age at the given season, derived from the player's birth season. */
export function ageOf(player: Player, season: number): number {
  return season - player.born;
}

/** Base expected rating delta for an age, read off BASE_AGE_CURVE (keyed by age - peak). */
function baseAgeDelta(effectiveAge: number): number {
  return interpolate(BASE_AGE_CURVE, effectiveAge - BASE_AGE_CURVE_PEAK);
}

/** Linearly interpolate a young/old std dev pair by age (narrows as players age). */
function sdAt(young: number, old: number, age: number): number {
  return young + (old - young) * Math.max(0, Math.min(1, (age - 18) / (RETIREMENT_START_AGE - 18)));
}

/**
 * One season of rating movement: each rating group (physical vs. skill,
 * further shifted for GKs) reads its own expected delta off the base age
 * curve, nudged by `minutesFactor` during growth years only; decline years
 * are age/group-driven alone. Two layers of gaussian noise apply on top:
 * a per-rating roll (narrows with age) plus one shared per-group "form" roll
 * (also narrows with age) added identically to every rating in that group.
 * The per-rating layer alone would mostly cancel out once averaged into a
 * weighted ovr across 10+ ratings, making real breakout/bust seasons
 * statistically near-impossible; the shared form roll survives that
 * averaging and is what actually swings ovr season to season. Shared by real
 * progression and potential's forward simulation so both use the exact same
 * development model. Does not mutate the input.
 */
function stepRatings(
  rng: () => number,
  ratings: PlayerRatings,
  age: number,
  pos: Player["pos"],
  minutesFactor: number,
): PlayerRatings {
  const gkShift = pos === "GK" ? GK_AGE_SHIFT : 0;
  const noiseSd = sdAt(PROGRESSION_NOISE_SD_YOUNG, PROGRESSION_NOISE_SD_OLD, age);
  const formSd = sdAt(PROGRESSION_FORM_SD_YOUNG, PROGRESSION_FORM_SD_OLD, age);
  const next = { ...ratings };
  for (const [group, shift] of [
    [PHYSICAL_KEYS, gkShift + PHYSICAL_AGE_SHIFT],
    [SKILL_KEYS_GROUP, gkShift + SKILL_AGE_SHIFT],
  ] as const) {
    const base = baseAgeDelta(age + shift);
    const mean = base > 0 ? base * minutesFactor : base;
    const formRoll = gaussian(rng) * formSd;
    for (const key of group) {
      next[key] = clampRating(next[key] + mean + formRoll + gaussian(rng) * noiseSd);
    }
  }
  return next;
}

/**
 * Potential (BBGM-style): a scout's *estimate*, not a growth ceiling — it has
 * no influence on progressPlayer. Computed by simulating a player's future
 * career forward POTENTIAL_SIM_TRIALS times using the same age-curve model
 * (assuming average future playing time), tracking the peak ovr reached in
 * each trial, and reading off the POTENTIAL_SIM_PERCENTILE. So on average a
 * player exceeds this number about 25% of the time, matching real careers
 * where most players fall short of their potential but some meet or beat it.
 */
export function estimatePotential(
  rng: () => number,
  ratings: PlayerRatings,
  ovr: number,
  age: number,
  pos: Player["pos"],
  heightCm: number,
): number {
  const peaks: number[] = [];
  for (let trial = 0; trial < POTENTIAL_SIM_TRIALS; trial++) {
    let simRatings = ratings;
    let peak = ovr;
    for (let simAge = age + 1; simAge <= POTENTIAL_SIM_MAX_AGE; simAge++) {
      simRatings = stepRatings(rng, simRatings, simAge, pos, 1);
      const simOvr = computeOvr(pos, simRatings, heightCm);
      if (simOvr > peak) peak = simOvr;
    }
    peaks.push(peak);
  }
  peaks.sort((a, b) => a - b);
  const idx = Math.min(peaks.length - 1, Math.floor(POTENTIAL_SIM_PERCENTILE * peaks.length));
  return peaks[idx];
}

/**
 * Season-end rating movement (see stepRatings) followed by a fresh potential
 * estimate off the new ratings. Does not mutate the input.
 */
export function progressPlayer(
  rng: () => number,
  player: Player,
  season: number,
): Player {
  const age = ageOf(player, season);

  const lastSeasonStats = player.stats.find((s) => s.season === season);
  const appearances = lastSeasonStats?.appearances ?? 0;
  const minutesFactor = MINUTES_FACTOR_MIN
    + (MINUTES_FACTOR_MAX - MINUTES_FACTOR_MIN)
      * Math.max(0, Math.min(1, appearances / FULL_SEASON_APPEARANCES));

  const ratings = stepRatings(rng, player.ratings, age, player.pos, minutesFactor);
  const ovr = computeOvr(player.pos, ratings, player.heightCm);
  const potential = estimatePotential(rng, ratings, ovr, age, player.pos, player.heightCm);

  return {
    ...player,
    ratings,
    ovr,
    potential,
    hist: [...player.hist, { season, ratings, ovr, potential }],
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
