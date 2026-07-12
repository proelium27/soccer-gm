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
 * Wages (2026-07-11 rework, replacing the flat 20k-per-ovr placeholder):
 * weekly wage = WAGE_WEEKLY_MIN + WAGE_WEEKLY_COEFF * (ovr - WAGE_OVR_FLOOR)^3,
 * times a deterministic per-signing variation of ±WAGE_VARIATION, rounded to
 * the nearest 100 and stored as a per-season total (weekly × 52). The cubic
 * matches the real Premier League's superstar wage escalation on the
 * post-rebalance ovr scale (65 = average starter … 90+ = rare outlier):
 * ovr 50 ≈ 4.5k/wk, 60 ≈ 22k, 65 ≈ 41k, 70 ≈ 70k, 75 ≈ 109k, 80 ≈ 162k,
 * 85 ≈ 230k, 90 ≈ 314k, 99 ≈ 515k — versus the old formula's near-flat
 * 23k → 34k/wk over that whole range.
 */
export const WAGE_WEEKLY_MIN = 2_000;
export const WAGE_OVR_FLOOR = 40;
export const WAGE_WEEKLY_COEFF = 2.5;
/** Per-signing wage spread: two same-ovr players can differ by up to ±15%. */
export const WAGE_VARIATION = 0.15;
export const CONTRACT_LENGTH_MIN = 1;
export const CONTRACT_LENGTH_MAX = 3;
export const YOUTH_CONTRACT_LENGTH = 2;

/**
 * M6 finance (see docs/finance-design.md): every club gets an equal base
 * allocation each season; the only spread comes from domestic success
 * payouts plus a heavily damped hype→revenue channel, so famous/successful
 * clubs don't snowball. Wages are paid UP FRONT at each season's start
 * (league creation included): the base allocation arrives and the squad's
 * season wages come straight out of it, so in-season cash is genuinely
 * spendable. Players acquired mid-season (transfer buys, free-agent
 * signings during the regular phase) charge their full season salary at
 * acquisition; offseason additions are covered by the next season-start
 * charge.
 *
 * Scale invariant (tested in budget.test.ts): the base allocation alone must
 * exceed the wage bill of WAGE_SAFE_SQUAD on worst-case (+WAGE_VARIATION)
 * deals — a benchmark squad shaped like the strongest AI club observed in
 * 25-season dynasty audits of the cubic wage rework (max AI wage bill ~86M
 * across 3 seeds × 25 seasons × 19 clubs; actual settlement margins never
 * dropped below +32M because big-wage squads reliably earn prize/hype
 * revenue on top). AI clubs never spend on scouting, so the AI invariant
 * excludes it. The pre-rework theoretical ceiling (25 players at 99 ovr) is
 * no longer coverable: only a user deliberately hoarding a ROSTER_CAP squad
 * of elite players can outspend the base (a documented, user-controlled
 * gap — the Finance page projects the shortfall).
 *
 * Calibrated to the real-world market (2025-ish Premier League): the
 * equilibrium average wage bill is ~30M/season, leaving an average club
 * ~65-80M/season for transfers and scouting against valuations where a
 * superstar costs 150M+ and a solid starter 30-50M.
 */
export const BASE_SEASON_BUDGET = 95_000_000;
/**
 * Benchmark "dominant AI squad" the base allocation must out-fund on
 * worst-case wage deals (see the invariant note above): [count, ovr] rows,
 * matching the strongest squad shape AI free agency + progression produced
 * in dynasty audits (a 73-ovr starting XI is beyond equilibrium AI strength).
 */
export const WAGE_SAFE_SQUAD: readonly [count: number, ovr: number][] = [
  [11, 73], [7, 66], [7, 56],
];

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

/* ─────────────────────────────────────────────────────────────────────────
 * AI evaluation core (see docs — "AI General Manager Philosophy")
 *
 * The brain behind evaluation-driven (not rule-scripted) club decisions. A
 * club's strategic direction and how it values any given player both EMERGE
 * from its current state — wealth, fame, squad strength, form, age profile,
 * positional depth — rather than from hand-authored per-club scripts. Two
 * clubs presented with the same player therefore value him differently.
 *
 * Phase 1 (this batch) ships only the scoring functions + tests; nothing in
 * the sim consumes them yet, so these constants change no observable
 * behavior. They're expected to be retuned once AI buying/selling actually
 * runs on top of them.
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * How many of a club's best players (by ovr) define its "squad strength" —
 * roughly a matchday squad (XI + 5-deep bench), so a couple of weak fringe
 * players don't drag a strong club's strength down.
 */
export const AI_SQUAD_STRENGTH_COUNT = 16;

/**
 * Ambition = win-now pressure, a [0,1] blend of four league-normalized
 * signals. Weights sum to 1. Wealth and squad strength dominate (a rich,
 * strong club feels pressure to win now); fame and recent form nudge it.
 */
export const AI_AMBITION_W_STRENGTH = 0.35;
export const AI_AMBITION_W_WEALTH = 0.3;
export const AI_AMBITION_W_FAME = 0.2;
export const AI_AMBITION_W_FORM = 0.15;

/** Direction-label thresholds on the ambition axis (labels are for UI/tests, not math). */
export const AI_AMBITION_HIGH = 0.62;
export const AI_AMBITION_LOW = 0.34;
/** A squad this young (mean age) reads as "rebuilding" rather than "relegation battle" when ambition is low. */
export const AI_YOUNG_SQUAD_AGE = 24.5;

/**
 * Positional-need multiplier. Below target depth (ROSTER_COMPOSITION) scales
 * value up (scarcity); above it scales value down (surplus). Separately, a
 * player who clearly upgrades the club's best at that position is worth more,
 * a clear downgrade less. Product is clamped to [MIN, MAX].
 */
export const AI_NEED_SCARCITY = 0.7;
export const AI_NEED_SURPLUS = 0.6;
export const AI_NEED_UPGRADE_SLOPE = 0.03;
export const AI_NEED_UPGRADE_MIN = 0.5;
export const AI_NEED_UPGRADE_MAX = 1.5;
export const AI_NEED_MIN = 0.35;
export const AI_NEED_MAX = 1.8;

/**
 * Timeline multiplier: how age fits the club's ambition. Win-now clubs (high
 * ambition) pay a premium for prime-age readiness and discount teenage
 * projects; developer clubs (low ambition) do the reverse. The two "neutral"
 * references keep a typical mid-20s player near a 1.0 multiplier.
 */
export const AI_TIMELINE_STRENGTH = 0.35;
export const AI_PRIME_NEUTRAL = 0.5;
export const AI_YOUTH_NEUTRAL = 0.35;

/**
 * Affordability multiplier. A deal (fee proxy + first-year wage) costing more
 * than AI_AFFORD_FREE_FRACTION of the club's budget starts to be penalized,
 * steeper the more frugal (poorer) the club — encoding "big clubs absorb
 * mistakes, small clubs can't." Rich clubs (frugality ~0) barely feel it.
 */
export const AI_AFFORD_FREE_FRACTION = 0.35;
export const AI_AFFORD_SLOPE = 1.5;
/** Budget floor for the ratio so a near-broke club doesn't divide by ~0. */
export const AI_AFFORD_BUDGET_FLOOR = 5_000_000;

/* ─────────────────────────────────────────────────────────────────────────
 * AI↔AI transfer market (phase 2 of the AI GM effort — see CLAUDE.md)
 *
 * Evaluation-driven trading between AI clubs (the user is excluded — inbound
 * offers for the user's players are phase 3). Runs once per window: the
 * summer window during the offseason, the winter window when the sim first
 * crosses matchday WINTER_WINDOW_OPEN_MATCHDAY.
 *
 * The whole thing keys off the phase-1 valueToClub: a player's "keep value"
 * to his current club is the club's reservation price; a player moves when
 * another club values him MORE than his own club does (and can afford him).
 * Surplus, sell-at-peak, and needs-based buying all emerge from that single
 * comparison rather than from scripted rules.
 * ──────────────────────────────────────────────────────────────────────── */

/** A player isn't worth an AI club's time to trade below this market value. */
export const AI_MARKET_MIN_VALUE = 1_000_000;

/**
 * A club only shops a player it values at no more than this multiple of his
 * open-market value — i.e. players it doesn't rate above the cash they'd
 * fetch (surplus, aging, replaceable). This keeps clubs from auctioning off
 * a genuinely irreplaceable core player just because a rich rival bids.
 */
export const AI_MARKET_AVAILABILITY = 1.05;

/**
 * A buyer bothers only when its valueToClub for the player clears the
 * seller's reservation (the seller's own keep-value) by at least this margin
 * — the player must be meaningfully more useful to the buyer than the seller.
 */
export const AI_MARKET_MIN_SURPLUS = 0.15;

/**
 * The fee lands this fraction of the way from the seller's reservation up to
 * the buyer's valuation — both sides share the surplus. 0.5 = split it evenly.
 */
export const AI_MARKET_FEE_SHARE = 0.5;

/**
 * Deterministic ± jitter on a buyer's valuation (fraction of value), a first
 * taste of imperfect/scouted decisions: two clubs don't price a player
 * identically, and the "best" deal isn't always the one that executes.
 */
export const AI_MARKET_VALUE_JITTER = 0.04;

/** Most buys / sells any one AI club will make in a single window. */
export const AI_MARKET_MAX_BUYS = 3;
export const AI_MARKET_MAX_SELLS = 3;
