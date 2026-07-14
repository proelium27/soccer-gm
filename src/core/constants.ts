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

/**
 * Emergency call-up floor for the user's own senior roster (offseason.ts's
 * ensureUserRosterSafety): unlike AI, the user's roster is never
 * auto-trimmed OR auto-replenished (free agency/youth intake skip them by
 * design so the user manages manually) — but nothing else automatically
 * refills it either, so an inattentive user's roster can otherwise shrink
 * toward unfieldable purely from contract expiry/retirement over several
 * unmanaged offseasons (a real, empirically observed risk, not
 * hypothetical: a 25-man squad dropped to 13 by season 4 in one seeded
 * multi-season audit with zero manual signings). Fielding fewer than 11
 * crashes the match engine and bricks the save (see CLAUDE.md's known-gaps
 * note), so each offseason the user's best academy prospects are
 * automatically promoted — GK first if the roster has none, then by ovr —
 * until the roster reaches this floor or the academy runs out. This never
 * fires for an attentively-managed roster; it's a backstop, not a normal
 * source of squad growth.
 */
export const ROSTER_SAFETY_FLOOR = 18;

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
 * "Form" noise: one shared gaussian roll per rating group (physical, skill)
 * per player per season, added on top of each rating's independent noise
 * above. Per-rating noise alone averages out across the ~10-14 ratings that
 * feed a weighted-average ovr (central limit theorem), so a season's real
 * ovr movement was almost entirely the deterministic age-curve mean — no
 * player ever had a real breakout or bust year. This shared roll moves every
 * rating in a group together, so it survives the ovr average and produces
 * real season-to-season ovr swings, matching BBGM's approach of layering
 * shared variance on top of per-rating noise. Zero-mean like the per-rating
 * noise, so it doesn't shift long-run league equilibrium, only the spread
 * around it. Deliberately smaller than a first pass (was 5/1): most of a
 * single season's swing should come from the player's persistent
 * `PROGRESSION_BIAS_SD_*` trait below, not a one-off dice roll, and the
 * combined single-season spread is what matters for feel (a young player
 * shouldn't realistically lose 10 ovr in one bad season).
 */
export const PROGRESSION_FORM_SD_YOUNG = 3;
export const PROGRESSION_FORM_SD_OLD = 0.75;

/**
 * Development "personality": a fixed-per-player gaussian bias (derived
 * deterministically from pid, not drawn from the shared rng stream — see
 * `developmentBias` in progression.ts) applied every season on top of the
 * per-season form roll above, but only through peak age (tapers to exactly
 * 0 by `BASE_AGE_CURVE_PEAK` — see `biasSdAt`, not the shared young/old
 * `sdAt` helper). This is what makes some prospects consistent clean
 * developers (every growth-age season trends up) and others consistent
 * busts (every growth-age season trends down). It must taper to zero well
 * before retirement age, not just narrow like the other noise terms: a
 * persistent nonzero contribution surviving into decline years would give a
 * lucky player's expected *lifetime* rating delta a nonzero value over a
 * 15+-season career, reopening the exact unbounded-inflation failure mode
 * `SKILL_AGE_SHIFT`/`GK_AGE_SHIFT` were tuned to close (see their comment) —
 * confirmed empirically the first time this constant was added (tapering to
 * `RETIREMENT_START_AGE` instead of peak age let 90+ players climb to 17.7%
 * of the AI pool by season 25 in a dynasty audit, instead of staying near 0%).
 */
export const PROGRESSION_BIAS_SD_YOUNG = 1.5;

/**
 * Growth resistance: as a player's *current* ovr climbs through this range,
 * the positive part of a season's development (age-curve growth + bias +
 * form roll, combined, before per-rating noise) is scaled down toward
 * `GROWTH_DAMPING_FLOOR` — a big breakout jump should get rarer the closer a
 * player already is to elite, on top of (not instead of) the age curve
 * already slowing growth down. Declines are never damped by this: a bust
 * trending down should decline just as easily whether they're rated 55 or
 * 75 — real resistance to being *good* isn't resistance to getting worse.
 * Purely rating-driven, independent of age, so it also acts as a soft
 * ceiling beneath the hard `RATING_MAX` clamp.
 */
export const GROWTH_DAMPING_START = 65;
export const GROWTH_DAMPING_END = 90;
export const GROWTH_DAMPING_FLOOR = 0.25;

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
 * Wages (2026-07-11 rework, replacing the flat 20k-per-ovr placeholder;
 * rescaled 2026-07-13 alongside the BASE_SEASON_BUDGET cut below — same
 * cubic shape, coefficients scaled by ~BASE_SEASON_BUDGET's 50M/95M ratio so
 * the AI-solvency invariant in budget.test.ts still holds with a comparable
 * margin):
 * weekly wage = WAGE_WEEKLY_MIN + WAGE_WEEKLY_COEFF * (ovr - WAGE_OVR_FLOOR)^3,
 * times a deterministic per-signing variation of ±WAGE_VARIATION, rounded to
 * the nearest 100 and stored as a per-season total (weekly × 52). The cubic
 * matches the real Premier League's superstar wage escalation on the
 * post-rebalance ovr scale (65 = average starter … 90+ = rare outlier):
 * ovr 50 ≈ 2.3k/wk, 60 ≈ 11.4k, 65 ≈ 21.3k, 70 ≈ 36.1k, 75 ≈ 56.7k,
 * 80 ≈ 84.2k, 85 ≈ 119.5k, 90 ≈ 163.5k, 99 ≈ 268k.
 */
export const WAGE_WEEKLY_MIN = 1_000;
export const WAGE_OVR_FLOOR = 40;
export const WAGE_WEEKLY_COEFF = 1.3;
/** Per-signing wage spread: two same-ovr players can differ by up to ±15%. */
export const WAGE_VARIATION = 0.15;
export const CONTRACT_LENGTH_MIN = 1;
export const CONTRACT_LENGTH_MAX = 3;
export const YOUTH_CONTRACT_LENGTH = 2;

/**
 * Academy (holding pool for the user's own youth intake — see clubs.ts's
 * StoredTeam.academyRoster): players there aren't yet competing for senior
 * wages, so they draw a cheap flat weekly stipend instead of the normal
 * OVR-cubic formula (seasonSalaryForOvr) — otherwise a raw 16-year-old could
 * already cost real money before ever playing a match, and clubs would have
 * no wage-based reason to ever promote a prospect out of the academy. Reuses
 * YOUTH_CONTRACT_LENGTH for the academy contract length too.
 */
export const ACADEMY_STIPEND_WEEKLY = 500;
/**
 * Hard ceiling on the academy pool, mirroring ROSTER_CAP's role for the
 * senior roster — bounds how many prospects a player can sign into the
 * academy via Incoming Talent (youth intake itself isn't gated by this, same
 * convention as ROSTER_CAP/youth intake).
 */
export const ACADEMY_ROSTER_CAP = 10;
/** Free agents at or under this age show up on Incoming Talent (prospects) instead of Free Agents. */
export const PROSPECT_AGE_MAX = 21;

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
 * Cut 95M → 50M on 2026-07-13 per user direction (a bottom-table club was
 * banking $163M+ over a few frugal seasons off the old, more generous
 * allocation — the running-balance/compounding design itself was kept
 * as-is, only the per-season inflow was reduced). Wages below were rescaled
 * in tandem to preserve the AI-solvency invariant.
 */
export const BASE_SEASON_BUDGET = 50_000_000;
/**
 * Hard ceiling on a club's running budget balance, added 2026-07-13: since
 * budget compounds season over season by design (never resets to the base
 * allocation), a frugal club could otherwise bank an unbounded amount over a
 * long dynasty (observed reaching $1B+ by season 20 in audits). Applied
 * everywhere a club's budget can increase (season-start/end settlement,
 * transfer-fee receipts) via `clampBudget` in `finance/budget.ts` — a club
 * can still spend below this line freely, it just can't bank above it.
 *
 * Set to $300M (bumped up from an initial $200M same-day) so it clears the
 * top of the transfer-valuation scale rather than sitting right on top of
 * it: `trueTransferValue`'s base curve alone prices a 90-ovr player at
 * ~$201M before age/potential/contract multipliers stack further on top, so
 * a $200M cap would have made the league's most elite players structurally
 * unaffordable for every club, not just rare big-money buys.
 */
export const MAX_BUDGET = 300_000_000;
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
 * make profit from jersey sales contribute TOO much to budget"). Bumped
 * 500k → 750k on 2026-07-13 alongside the BASE_SEASON_BUDGET cut, per user
 * request to make hype revenue a bit more impactful now that the base
 * allocation is smaller (max hype revenue: 20M → 30M).
 */
export const HYPE_REVENUE_PER_POINT = 750_000;
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

/** Most buys / sells any one AI club will make in a single window. */
export const AI_MARKET_MAX_BUYS = 3;
export const AI_MARKET_MAX_SELLS = 3;

/**
 * Cash reserve a club holds back from transfers — it spends only the surplus
 * above `reserveFraction × budget`, so it never blows its whole budget on
 * fees. The fraction scales with frugality: the wealthiest, least cautious
 * clubs keep MIN back and spend freely, the poorest keep MAX (a bigger
 * relative war chest for wages/contingencies). A club can still fund a deal
 * by selling first, since the reserve is measured against its live budget.
 */
export const AI_MARKET_RESERVE_FRACTION_MIN = 0.15;
export const AI_MARKET_RESERVE_FRACTION_MAX = 0.5;

/* ────────────────────────────────────────────────────────────────────────
 * AI GM phase 4: proactive contract renewals. Reuses valueToClub as-is — the
 * only new tuning knob is the margin below, a "is he still worth the money"
 * bar applied the season before a player's contract would otherwise expire.
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * An AI club renews a player entering his contract's final season only if
 * valueToClub(player, ctx) clears his new-terms wage by at least this
 * multiple. >1 requires a real margin, not just break-even — valueToClub
 * already discounts for a club's affordability, so this is a second,
 * smaller safety margin on top, not a duplicate budget check.
 */
export const AI_RENEWAL_MARGIN = 1.1;

/* ────────────────────────────────────────────────────────────────────────
 * AI GM phase 3: inbound offers for the user's players. Reuses the same
 * valueToClub primitive and the AI_MARKET_MIN_SURPLUS / AI_MARKET_FEE_SHARE
 * constants above (a buyer's interest threshold and fee split work
 * identically whether the seller is an AI club or the user) — only the
 * offer-count cap and negotiation-response tuning below are new.
 * ──────────────────────────────────────────────────────────────────────── */

/** Most inbound offers shown for the user's roster in a single window. */
export const INBOUND_OFFERS_MAX = 4;

/* ────────────────────────────────────────────────────────────────────────
 * AI GM phase 5: imperfect/scouting-noised decisions. Every AI valuation
 * (buying, selling, renewing) now runs through perceivedValueToClub instead
 * of the raw valueToClub — a deterministic ± jitter scaled by the club's own
 * frugality (wealth stands in for scouting investment, same as the M6 user-
 * facing valuation noise). Replaces the old flat AI_MARKET_VALUE_JITTER /
 * INBOUND_OFFER_VALUE_JITTER (both 0.04 for every club regardless of wealth).
 * ──────────────────────────────────────────────────────────────────────── */

/** Scouting noise (± fraction of value) for the wealthiest club in the league (frugality 0). */
export const AI_SCOUT_NOISE_MIN = 0.02;
/** Scouting noise (± fraction of value) for the poorest club in the league (frugality 1). */
export const AI_SCOUT_NOISE_MAX = 0.08;

/* ────────────────────────────────────────────────────────────────────────
 * End-of-season awards (Player of the Season, Golden Boot, Team of the
 * Season). Scoring layers explicit per-season goal/assist/defensive-stat
 * weights on top of avgRating (itself already a per-match, position-weighted
 * blend of these same stats via computeMatchRating in matchRating.ts) so a
 * season of end product counts for more than the match-by-match average
 * alone would credit. Weights are season-total analogs of matchRating's
 * per-match weights, scaled down since they're summed over ~30+ appearances
 * instead of one game.
 * ──────────────────────────────────────────────────────────────────────── */

/** Appearances needed in a season to qualify for Player of the Season / Team of the Season (of 38 matchdays). */
export const AWARD_MIN_APPEARANCES = 19;

/** Player of the Season: avgRating plus goals/assists weighted heavier than the match-rating baseline already does. */
export const POTY_GOAL_WEIGHT: Record<"GK" | "DEF" | "MID" | "FWD", number> = {
  FWD: 0.08, MID: 0.1, DEF: 0.14, GK: 0.22,
};
export const POTY_ASSIST_WEIGHT: Record<"GK" | "DEF" | "MID" | "FWD", number> = {
  FWD: 0.05, MID: 0.07, DEF: 0.09, GK: 0.16,
};

/** Team of the Season: avgRating plus every position-relevant season stat, not just goals/assists. */
export const TOTS_GOAL_WEIGHT: Record<"GK" | "DEF" | "MID" | "FWD", number> = {
  FWD: 0.06, MID: 0.08, DEF: 0.11, GK: 0.3,
};
export const TOTS_ASSIST_WEIGHT: Record<"GK" | "DEF" | "MID" | "FWD", number> = {
  FWD: 0.04, MID: 0.055, DEF: 0.07, GK: 0.2,
};
export const TOTS_TACKLE_WEIGHT: Record<"GK" | "DEF" | "MID" | "FWD", number> = {
  FWD: 0.01, MID: 0.02, DEF: 0.03, GK: 0,
};
export const TOTS_INTERCEPTION_WEIGHT = TOTS_TACKLE_WEIGHT;
/** Goalkeepers only. */
export const TOTS_SAVE_WEIGHT = 0.035;
/** Penalty per goal conceded across the season, heaviest for GK/DEF. */
export const TOTS_GOALS_AGAINST_PENALTY: Record<"GK" | "DEF" | "MID" | "FWD", number> = {
  FWD: 0, MID: 0.006, DEF: 0.02, GK: 0.03,
};
