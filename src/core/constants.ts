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

/** Age at which ratings peak; GKs peak later and decline slower. */
export const PEAK_AGE = 27;
export const GK_PEAK_AGE = 30;

/** Growth-phase tuning: fraction of remaining (potential - ovr) gap closed per season. */
export const GROWTH_RATE = 0.22;
/** Minimum fraction of a normal season's minutes needed to realize full growth. */
export const GROWTH_MIN_MINUTES_FACTOR = 0.3;
/** Appearances considered a "full" season of minutes for progression purposes. */
export const FULL_SEASON_APPEARANCES = 30;

/** Decline-phase tuning: per-year-past-peak rating loss, outfield vs. GK. */
export const DECLINE_RATE = 1.1;
export const GK_DECLINE_RATE = 0.6;

/** Std dev of season-to-season rating noise (growth or decline). */
export const PROGRESSION_NOISE_SD = 2.5;

/** Retirement: no chance before this age; probability climbs per year after. */
export const RETIREMENT_START_AGE = 33;
export const RETIREMENT_PROB_PER_YEAR = 0.12;
export const RETIREMENT_BASE_PROB = 0.05;

/** Free agency / youth contracts: placeholder salary formula until finances are designed. */
export const SALARY_PER_OVR = 1000;
export const CONTRACT_LENGTH_MIN = 1;
export const CONTRACT_LENGTH_MAX = 3;
export const YOUTH_CONTRACT_LENGTH = 2;
