import type { Position } from "./players/types.js";

/** League-average base rating; a team's base = LEAGUE_BASE + its strength target. */
export const LEAGUE_BASE = 46;

/** Half-range of per-team strength targets (pre-normalization magnitude). */
export const TEAM_STRENGTH_SPREAD = 7;

/**
 * Composite normalization coefficient: normalized = 0.5 + NORMALIZE_K * z.
 * THE dial for league spread — after z-scoring, raw magnitudes cancel out, so
 * this (with the target distribution shape) governs both single-game favorite
 * odds and end-of-season table spread. Tuned against the M1 validation gates.
 */
export const NORMALIZE_K = 0.08;

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

/** Matchday bench size: the best remaining roster players (by ovr) after the starting XI. */
export const BENCH_SIZE = 7;

/**
 * Hard squad-size limit enforced on player-adding actions (free-agent
 * signings, transfer buys). Set comfortably above ROSTER_COMPOSITION's 25 so
 * clubs have real squad depth, matching typical real-world first-team limits.
 * Youth intake and AI free agency aren't gated by this (AI is trimmed back
 * to ROSTER_COMPOSITION every offseason anyway); it only blocks actions that
 * could otherwise let a roster grow without bound.
 */
export const ROSTER_CAP = 30;

/** In-match injuries (M5): games missed once hurt, uniform between these inclusive bounds. */
export const INJURY_GAMES_MIN = 1;
export const INJURY_GAMES_MAX = 6;

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
  [-8, 3], [-7, 2.7], [-6, 2.2], [-5, 1.7], [-4, 1.3], [-3, 1], [-2, 0.65], [-1, 0.3],
  [0, 0.1], [1, 0], [2, -0.5], [3, -1], [4, -1.75], [5, -2.25], [6, -2.75], [7, -3.25],
  [8, -3.75], [9, -4.25], [10, -4.75],
];

/**
 * Physical ratings (speed, strength, stamina, jumping) read the curve this
 * many years "older". Skill ratings (technical/mental + goalkeeping) read it
 * this many years "younger", and GKs get an extra shift on top of that.
 * Calibrated so each rating group's survival-weighted (retirement-aware)
 * expected lifetime delta is ~0 or slightly negative for every position —
 * a career should average out flat-to-declining, not net growth, or a
 * dynasty's rostered population inflates without bound over decades (a
 * bought-and-verified-empirically failure mode with the previous ±3/-3
 * values, worst for skill-heavy positions like GK/CM/AM/DM).
 */
export const PHYSICAL_AGE_SHIFT = 3;
export const SKILL_AGE_SHIFT = -1.5;
/** Extra "younger" shift applied to every rating group for goalkeepers (mild career-long-keeper edge). */
export const GK_AGE_SHIFT = -0.5;

/** Minutes played is a minor nudge on growth-phase deltas only, not the previous 0.3-1.0x multiplier. */
export const MINUTES_FACTOR_MIN = 0.85;
export const MINUTES_FACTOR_MAX = 1.15;
/** Appearances considered a "full" season of minutes for the minutes nudge. */
export const FULL_SEASON_APPEARANCES = 30;

/** Per-rating noise std dev at age 18 and at age 33+, linearly interpolated by age (variance narrows with age). */
export const PROGRESSION_NOISE_SD_YOUNG = 3.5;
export const PROGRESSION_NOISE_SD_OLD = 1.5;

/**
 * Potential (BBGM-style): a scout's *estimate*, not a growth driver. It plays
 * no part in progressPlayer's math — actual development is driven only by
 * age/rating-group and noise (per the BBGM manual: progression depends on
 * current ratings, age, and coaching, never potential). Potential is instead
 * computed by simulating a player's future career arc forward
 * POTENTIAL_SIM_TRIALS times (same age-curve model, independent noise per
 * trial) and reading off the POTENTIAL_SIM_PERCENTILE of each trial's peak
 * ovr — so on average a player exceeds their listed potential about
 * (1 - POTENTIAL_SIM_PERCENTILE) of the time, matching "most players never
 * reach their potential, but some do and some exceed it."
 */
export const POTENTIAL_SIM_TRIALS = 16;
/** Simulated trajectories run forward (in seasons) up to this age. */
export const POTENTIAL_SIM_MAX_AGE = 40;
export const POTENTIAL_SIM_PERCENTILE = 0.75;

/** Retirement: no chance before this age; probability climbs per year after. */
export const RETIREMENT_START_AGE = 33;
export const RETIREMENT_PROB_PER_YEAR = 0.12;
export const RETIREMENT_BASE_PROB = 0.05;

/**
 * Free agency / youth contracts: placeholder linear salary until the real
 * contract system lands. Stored as a per-season total; at 20k per ovr point
 * a 75-ovr starter earns ~1.5M/season (~29k/week), in line with real
 * mid-tier wages. Deliberately flat at the top end — superstar wage
 * escalation can come with the contract redesign.
 */
export const SALARY_PER_OVR = 20_000;
export const CONTRACT_LENGTH_MIN = 1;
export const CONTRACT_LENGTH_MAX = 3;
export const YOUTH_CONTRACT_LENGTH = 2;

/**
 * M6 finance (see docs/finance-design.md): every club gets an equal base
 * allocation each season; the only spread comes from domestic success
 * payouts plus a heavily damped hype→revenue channel, so famous/successful
 * clubs don't snowball.
 *
 * Scale invariant (tested in budget.test.ts): the base allocation alone must
 * exceed the maximum possible season expenses (a full roster of 99-ovr
 * salaries plus max scouting spend), so no club can ever lose money — per
 * design, deficits/debt do not exist in this game.
 *
 * Calibrated to the real-world market (2025-ish Premier League), leaving an
 * average club ~55-60M/season to spend — matching real transfer outlays
 * against valuations where a superstar costs 150M+ and a solid starter
 * 30-50M. Note the invariant margin is thin: max expenses are ~69.5M
 * (49.5M ceiling wage bill + 20M max scouting) against this base.
 */
export const BASE_SEASON_BUDGET = 75_000_000;

/**
 * Prize money by final domestic league position, paid on top of the equal
 * base allocation. Three exclusive tiers: winning the league, finishing in
 * the top 5 (2nd-5th), and finishing in the top 10 (6th-10th). Everyone
 * else gets the base allocation only.
 */
export const PRIZE_CHAMPION = 40_000_000;
export const PRIZE_TOP_5 = 20_000_000;
export const PRIZE_TOP_10 = 10_000_000;
/** Last league position included in each prize tier. */
export const PRIZE_TOP_5_CUTOFF = 5;
export const PRIZE_TOP_10_CUTOFF = 10;

/** Hype is tracked on a 0-100 scale. */
export const HYPE_MIN = 0;
export const HYPE_MAX = 100;

/**
 * Hype moves toward a season-performance target (derived from points-per-
 * game and final rank) rather than snapping to it, so a single great/poor
 * season doesn't swing a club's fame instantly.
 */
export const HYPE_SMOOTHING = 0.35;
export const HYPE_INITIAL = 50;

/**
 * Damped hype→revenue channel: revenue per hype point, scaled down hard so
 * this stays a secondary channel behind success payouts (per design: "don't
 * make profit from jersey sales contribute TOO much to budget").
 */
export const HYPE_REVENUE_PER_POINT = 500_000;
export const HYPE_REVENUE_DAMPING = 0.4;

/** Scouting: a single per-season spend slider (0 = no scouts) that lowers valuation noise. */
export const SCOUTING_SPEND_MIN = 0;
export const SCOUTING_SPEND_MAX = 20_000_000;
/** Perceived-valuation noise (std dev, as a fraction of true value) at zero spend and at max spend. */
export const SCOUTING_NOISE_SD_MIN_SPEND = 0.35;
export const SCOUTING_NOISE_SD_MAX_SPEND = 0.05;

/**
 * Transfer valuation formula: a "current ability" base value that climbs
 * steeply with ovr above a floor (replacement-level players are worth
 * little), multiplied by a potential premium (VALUATION_POTENTIAL_*, priced
 * on top rather than blended into ovr — soccer transfer fees pay for
 * resale/ceiling on top of today's ability, not instead of it), an age
 * curve (VALUATION_AGE_CURVE — youth is a premium in soccer's transfer
 * market, not a discount: clubs are buying years of control and resale
 * value), and a bonus for remaining contract length (longer deals are
 * harder/pricier to pry a player out of).
 *
 * Recalibrated 2026-07-11 to the post-rebalance ovr scale (65 = average
 * starter, 70 = good starter, 75 = a team's best player, 80-85 = league-wide
 * elite, 90+ = rare outlier — see the M1 milestone note in CLAUDE.md; the
 * original constants below were tuned against the older, more inflated
 * scale where 65-70 was merely a decent squad player) and pinned to real
 * transfer-market data (2025-ish Premier League, matching the
 * BASE_SEASON_BUDGET calibration note above): an average starter runs
 * 35-45M, a title-contender's best player 65-80M+, and a generational
 * outlier like Haaland tops 200M. Base ("current ability") value with no
 * potential gap, before age/potential/contract multipliers:
 * 65 ~= 35M, 70 ~= 57M, 75 ~= 84M, 80 ~= 117M, 85 ~= 156M, 90 ~= 201M.
 */
export const VALUATION_OVR_FLOOR = 45;
export const VALUATION_OVR_COEFF = 56_000;
export const VALUATION_OVR_EXPONENT = 2.15;
export const VALUATION_CONTRACT_YEAR_BONUS = 0.08;
export const VALUATION_CONTRACT_YEAR_BONUS_CAP = 0.4;

/**
 * Age's effect on transfer value, as a straight multiplier — [age,
 * multiplier] control points, linearly interpolated, clamped at the ends.
 * Unlike a player's on-field ability curve, transfer value peaks in the
 * late teens and falls off through the late 20s/30s: a young player is an
 * asset (years of control, resale value, room to grow) independent of
 * their potential gap, which is priced separately (VALUATION_POTENTIAL_*).
 */
export const VALUATION_AGE_CURVE: readonly [number, number][] = [
  [16, 1.25], [17, 1.35], [18, 1.40], [19, 1.35], [20, 1.30], [21, 1.20],
  [22, 1.10], [23, 1.00], [27, 1.00], [28, 0.90], [30, 0.75], [32, 0.55],
];

/**
 * Potential premium: soccer transfer fees pay aggressively for ceiling, not
 * just proven ability (a 17-year-old Bellingham went for ~25M on potential
 * alone). Priced as a percentage bump on the base value, per point of
 * (potential - ovr), scaled by an age weight — full weight through
 * VALUATION_POTENTIAL_WEIGHT_PEAK_AGE, linearly decaying to zero by
 * VALUATION_POTENTIAL_WEIGHT_ZERO_AGE (an older player's remaining
 * "potential" isn't worth paying extra for — they won't live in it long).
 * At full weight, VALUATION_POTENTIAL_PCT_PER_POINT * 20 = +70%, i.e. a
 * 20-point gap at peak age roughly matches the Bellingham-style premium.
 */
export const VALUATION_POTENTIAL_PCT_PER_POINT = 0.035;
export const VALUATION_POTENTIAL_WEIGHT_PEAK_AGE = 21;
export const VALUATION_POTENTIAL_WEIGHT_ZERO_AGE = 30;

/**
 * M6 transfer market (phases 3-7, see docs/finance-design.md). A club's
 * hidden reservation price — the fee it will actually accept — is its
 * player's true transfer value times a factor rolled once per transfer
 * window, so probing offers within one window can't reroll the price.
 */
export const RESERVATION_FACTOR_MIN = 0.95;
export const RESERVATION_FACTOR_MAX = 1.2;

/** An offer below this fraction of the reservation price ends talks outright ("way off"). */
export const NEGOTIATION_LOWBALL_FACTOR = 0.6;

/**
 * Counter-offers open this far above the reservation price and the padding
 * decays geometrically each round, so haggling converges on the reservation
 * price but never reveals it exactly.
 */
export const COUNTER_PADDING_START = 0.15;
export const COUNTER_PADDING_DECAY = 0.5;

/** Clubs walk away after this many user offers without an agreement. */
export const NEGOTIATION_MAX_ROUNDS = 5;

/**
 * Recommended Transfers page: 5-10 players of similar overall level to the
 * user's team (relative to the starting XI average ovr) and within budget.
 * The band skews upward — recommendations should mostly be improvements.
 */
export const RECOMMENDED_TRANSFERS_MIN = 5;
export const RECOMMENDED_TRANSFERS_MAX = 10;
export const RECOMMENDED_OVR_BELOW = 2;
export const RECOMMENDED_OVR_ABOVE = 8;
/** If the band holds fewer than the minimum, widen it by this many ovr points and retry. */
export const RECOMMENDED_BAND_WIDEN = 6;
/** Weight of potential headroom (potential - ovr) in the recommendation score. */
export const RECOMMENDED_UPSIDE_WEIGHT = 0.3;
/**
 * Scouting noise (a fraction of value, 0.35 → 0.05 by spend) rescaled into
 * ovr-points of ranking noise: bad scouts shuffle the list by ~3.5 points,
 * great scouts by ~0.5, so spend buys genuinely better targets.
 */
export const RECOMMENDED_NOISE_OVR_SCALE = 10;
/** Keep the list varied: no more than this many recommendations at one position. */
export const RECOMMENDED_MAX_PER_POSITION = 2;

/**
 * One-button contract terms (design: contracts are never negotiated — one
 * "extend"/"sign" button shows the weekly wage and length). Length is
 * deterministic by age so the button can state exactly what it does.
 */
export const EXTENSION_LENGTH_YOUNG = 3;
export const EXTENSION_LENGTH_MID = 2;
export const EXTENSION_LENGTH_OLD = 1;
/** Age cutoffs: below MID → young terms, below OLD → mid terms, else old terms. */
export const EXTENSION_AGE_MID = 30;
export const EXTENSION_AGE_OLD = 33;
