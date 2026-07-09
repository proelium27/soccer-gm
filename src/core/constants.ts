import type { Position } from "./players/types.js";

/** League-average base rating; a team's base = LEAGUE_BASE + its strength target. */
export const LEAGUE_BASE = 52;

/** Half-range of per-team strength targets (pre-normalization magnitude). */
export const TEAM_STRENGTH_SPREAD = 12;

/**
 * Composite normalization coefficient: normalized = 0.5 + NORMALIZE_K * z.
 * THE dial for league spread — after z-scoring, raw magnitudes cancel out, so
 * this (with the target distribution shape) governs both single-game favorite
 * odds and end-of-season table spread. Tuned against the M1 validation gates.
 */
export const NORMALIZE_K = 0.07;

/** Std dev of per-player, per-rating gaussian noise. */
export const RATING_NOISE_SD = 6;

/** Absolute-low pool for position-exclusive stats (independent of base). */
export const ABS_LOW_MIN = 5;
export const ABS_LOW_MAX = 20;

/** Ratings are clamped to this inclusive range. */
export const RATING_MIN = 1;
export const RATING_MAX = 99;

/** Players generated per team, by position (sums to 25). */
export const ROSTER_COMPOSITION: Record<Position, number> = {
  GK: 3, CB: 4, FB: 4, DM: 2, CM: 4, AM: 2, W: 3, ST: 3,
};

/** Generation-offset tier → additive offset (Table A). */
export const TIER_OFFSET = { star: 18, H: 10, M: 2, L: -12, VL: -25 } as const;

export const NUM_TEAMS = 20;

/** Initial league generation: uniform age range for starting rosters. */
export const INITIAL_AGE_MIN = 18;
export const INITIAL_AGE_MAX = 33;

/** Youth intake players are always generated at this age. */
export const YOUTH_AGE = 16;

/** Youth intake: min/max generated players per club per season. */
export const YOUTH_INTAKE_MIN = 3;
export const YOUTH_INTAKE_MAX = 5;

/** Youth are raw: generated `base` this many points below the club's current average OVR. */
export const YOUTH_BASE_OFFSET = 20;

/**
 * BBGM-style progression (see src/core/players/progression.ts for the full
 * model). Base age curve is defined around a canonical peak of ~26
 * ("25-27: around peak" per design brief); PHYSICAL and SKILL rating groups
 * each shift the age they read from that curve so physical ratings peak
 * earlier and decline first, while skill ratings peak later and decline
 * slower. GKs get an additional shift on top (peak later still, career-long
 * keepers).
 */
export const BASE_AGE_CURVE_PEAK = 26;
/** [age - peak, expected mean rating delta] control points; linearly interpolated between. */
export const BASE_AGE_CURVE: readonly [number, number][] = [
  [-8, 9], [-7, 8], [-6, 6.5], [-5, 5], [-4, 4], [-3, 3], [-2, 2], [-1, 1],
  [0, 0.3], [1, 0], [2, -1], [3, -2], [4, -3.5], [5, -4.5], [6, -5.5], [7, -6.5],
  [8, -7.5], [9, -8.5], [10, -9.5],
];

/** Physical ratings (speed, strength, stamina, jumping) read the curve this many years "older". */
export const PHYSICAL_AGE_SHIFT = 3;
/** Skill ratings (technical/mental + goalkeeping) read the curve this many years "younger". */
export const SKILL_AGE_SHIFT = -3;
/** Extra "younger" shift applied to every rating group for goalkeepers (career-long keepers). */
export const GK_AGE_SHIFT = -3;

/** Growth-phase (positive base delta) amplification from potential headroom, per rating point of (potential - ovr). */
export const POTENTIAL_FACTOR_PER_POINT = 0.09;
export const POTENTIAL_FACTOR_MIN = 0.4;
export const POTENTIAL_FACTOR_MAX = 2.2;

/** Minutes played is a minor nudge on growth-phase deltas only, not the previous 0.3-1.0x multiplier. */
export const MINUTES_FACTOR_MIN = 0.85;
export const MINUTES_FACTOR_MAX = 1.15;
/** Appearances considered a "full" season of minutes for the minutes nudge. */
export const FULL_SEASON_APPEARANCES = 30;

/** Per-rating noise std dev at age 18 and at age 33+, linearly interpolated by age (variance narrows with age). */
export const PROGRESSION_NOISE_SD_YOUNG = 5;
export const PROGRESSION_NOISE_SD_OLD = 2;

/**
 * Potential headroom-by-age: expected additional room above current ovr,
 * before random spread is applied. Recalculated every offseason from the
 * player's *new* ovr, so potential moves with performance rather than being
 * fixed at birth. Also used to roll a player's initial potential at
 * generation, keyed by age (GKs get GK_AGE_SHIFT applied first).
 */
export const POTENTIAL_HEADROOM_BY_AGE: readonly [number, number][] = [
  [16, 11], [18, 9], [20, 7], [22, 5], [24, 3.5], [26, 2], [28, 1.3], [30, 0.7], [33, 0.3],
];
/** Potential headroom roll is headroom * uniform(POTENTIAL_ROLL_MIN, POTENTIAL_ROLL_MAX). */
export const POTENTIAL_ROLL_MIN = 0.4;
export const POTENTIAL_ROLL_MAX = 1.4;

/**
 * Soft ceiling for rolled potential. At or below the knee the roll is used as-is;
 * above it the excess is compressed asymptotically toward RATING_MAX so elite
 * players spread across the high 90s instead of all pinning to exactly 99 at the
 * hard clamp. With these values a rolled potential of 99 needs a raw projection
 * of ~107 (i.e. an ovr already near the ceiling), making 99 practically
 * unreachable rather than a routine clamp result.
 */
export const POTENTIAL_SOFT_CAP_KNEE = 90;
export const POTENTIAL_SOFT_CAP_SCALE = 6;

/** Retirement: no chance before this age; probability climbs per year after. */
export const RETIREMENT_START_AGE = 33;
export const RETIREMENT_PROB_PER_YEAR = 0.12;
export const RETIREMENT_BASE_PROB = 0.05;

/** Free agency / youth contracts: placeholder salary formula until finances are designed. */
export const SALARY_PER_OVR = 1000;
export const CONTRACT_LENGTH_MIN = 1;
export const CONTRACT_LENGTH_MAX = 3;
export const YOUTH_CONTRACT_LENGTH = 2;
