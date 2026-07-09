import type { Player, SkillKey } from "./types.js";
import { computeOvr } from "./ovr.js";
import {
  BASE_AGE_CURVE, BASE_AGE_CURVE_PEAK, PHYSICAL_AGE_SHIFT, SKILL_AGE_SHIFT,
  GK_AGE_SHIFT, POTENTIAL_FACTOR_PER_POINT, POTENTIAL_FACTOR_MIN, POTENTIAL_FACTOR_MAX,
  MINUTES_FACTOR_MIN, MINUTES_FACTOR_MAX, FULL_SEASON_APPEARANCES,
  PROGRESSION_NOISE_SD_YOUNG, PROGRESSION_NOISE_SD_OLD,
  POTENTIAL_HEADROOM_BY_AGE, POTENTIAL_ROLL_MIN, POTENTIAL_ROLL_MAX,
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

/** Standard-normal sample via Box-Muller from the seeded stream. */
function gaussian(rng: () => number): number {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

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

/**
 * Roll (or re-roll) a player's potential from their current ovr and age.
 * Not a fixed ceiling — recalculated every offseason from the *new* ovr, so
 * a breakout season raises it and a stagnant one lowers it. Headroom shrinks
 * toward zero as age advances; GKs get extra effective years (their career
 * arcs run later) via GK_AGE_SHIFT.
 */
export function rollPotential(
  rng: () => number,
  ovr: number,
  age: number,
  pos: Player["pos"],
): number {
  const effectiveAge = pos === "GK" ? age + GK_AGE_SHIFT : age;
  const headroom = interpolate(POTENTIAL_HEADROOM_BY_AGE, effectiveAge);
  const roll = POTENTIAL_ROLL_MIN + rng() * (POTENTIAL_ROLL_MAX - POTENTIAL_ROLL_MIN);
  return Math.min(RATING_MAX, Math.round(ovr + headroom * roll));
}

/**
 * Season-end rating movement, BBGM-style: each rating group (physical vs.
 * skill, further shifted for GKs) reads its own expected delta off the base
 * age curve. During growth years (positive base delta) the delta is scaled
 * by how much headroom potential implies and nudged slightly by minutes
 * played; decline years are age/group-driven only. Independent gaussian
 * noise per rating narrows as players age, producing real busts and late
 * bloomers rather than smooth convergence to potential. Potential is then
 * re-rolled from the new ovr. Does not mutate the input.
 */
export function progressPlayer(
  rng: () => number,
  player: Player,
  season: number,
): Player {
  const age = ageOf(player, season);
  const gkShift = player.pos === "GK" ? GK_AGE_SHIFT : 0;

  const potentialGap = player.potential - player.ovr;
  const potentialFactor = Math.max(
    POTENTIAL_FACTOR_MIN,
    Math.min(POTENTIAL_FACTOR_MAX, 1 + potentialGap * POTENTIAL_FACTOR_PER_POINT),
  );

  const lastSeasonStats = player.stats.find((s) => s.season === season);
  const appearances = lastSeasonStats?.appearances ?? 0;
  const minutesFactor = MINUTES_FACTOR_MIN
    + (MINUTES_FACTOR_MAX - MINUTES_FACTOR_MIN)
      * Math.max(0, Math.min(1, appearances / FULL_SEASON_APPEARANCES));

  const noiseSd = PROGRESSION_NOISE_SD_YOUNG
    + (PROGRESSION_NOISE_SD_OLD - PROGRESSION_NOISE_SD_YOUNG)
      * Math.max(0, Math.min(1, (age - 18) / (RETIREMENT_START_AGE - 18)));

  const ratings = { ...player.ratings };
  for (const [group, shift] of [
    [PHYSICAL_KEYS, gkShift + PHYSICAL_AGE_SHIFT],
    [SKILL_KEYS_GROUP, gkShift + SKILL_AGE_SHIFT],
  ] as const) {
    const base = baseAgeDelta(age + shift);
    const mean = base > 0 ? base * potentialFactor * minutesFactor : base;
    for (const key of group) {
      ratings[key] = clampRating(ratings[key] + mean + gaussian(rng) * noiseSd);
    }
  }

  const ovr = computeOvr(player.pos, ratings, player.heightCm);
  const potential = rollPotential(rng, ovr, age, player.pos);

  return {
    ...player,
    ratings,
    ovr,
    potential,
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
