import type { Position } from "./players/types.js";

/**
 * League-average base rating; a team's base = LEAGUE_BASE + its strength target.
 * Raised 46→54 (2026-07-14), alongside TEAM_STRENGTH_SPREAD and RATING_NOISE_SD
 * below, after a TOTY bug report traced back to fresh-league generation sitting
 * ~7-10 points below every tier the Manual documents (65 avg starter / 75 best-
 * on-a-team / 80-85 league-wide elite / 90+ rare): a from-scratch generated
 * league measured mean starter ovr ~58 (not 65) and a league-wide max of only
 * 73-76 across 500 players (not 80-85+). Calibrated empirically against a
 * standalone generation harness to land starter mean ~65, best-player-per-team
 * ~73-75, and league max in the low-to-mid 80s with 90+ still rare.
 */
export const LEAGUE_BASE = 54;

/**
 * Half-range of per-team strength targets (pre-normalization magnitude).
 * Widened 7→9 alongside the LEAGUE_BASE/RATING_NOISE_SD retune above — a pure
 * LEAGUE_BASE shift alone raises the whole distribution uniformly but can't
 * close the gap between "average starter" and "a team's best player" (both
 * ends of that gap need real spread, not just a higher floor).
 */
export const TEAM_STRENGTH_SPREAD = 9;

/**
 * Division 1 team count, moved up from its previous location further down
 * this file (2026-07-15) so DIVISION_2_OFFSET below can reference it — a
 * plain literal, safe to relocate since nothing it depends on comes later.
 */
export const NUM_TEAMS = 20;

/**
 * Second division (English Division 2): same team count as Division 1, a
 * strength offset subtracted from the per-team target before generation so
 * D2's strongest teams land meaningfully below D1's own — a budget/prize
 * scale reflecting the real financial gap between top-flight and
 * second-tier football.
 *
 * DIVISION_2_OFFSET is derived from a target D1 rank rather than pinned to
 * a literal (2026-07-15 retune): a 30-season dynasty audit found the
 * original "D2's best ≈ D1's average" target (DIVISION_2_OFFSET =
 * TEAM_STRENGTH_SPREAD) eroded further over a long dynasty — D2's strongest
 * team's average roster OVR ended up *exceeding* D1's average team, and
 * Division 2's Team of the Season came within ~2.6 OVR of Division 1's.
 * D1's per-team strength targets are evenly spaced across
 * [-TEAM_STRENGTH_SPREAD, +TEAM_STRENGTH_SPREAD] over NUM_TEAMS clubs (rank
 * 1 = strongest, rank NUM_TEAMS = weakest); DIVISION_2_TARGET_D1_RANK picks
 * which D1 rank D2's own strongest team's target should land at.
 *
 * Retuned again (2026-07-15) from NUM_TEAMS (D1's own weakest team, the
 * formula's ceiling) down to 16: on reflection with the user, D1's weakest
 * team was a stronger target than ever actually intended — the original
 * design spec explicitly wanted Division 2's strongest team meaningfully
 * above D1's bottom, not equal to it — and rank NUM_TEAMS only got picked in
 * the prior pass as an emergency lever while separately fighting the
 * long-dynasty drift problem (Fix 3, src/core/ai/breakoutRefusal.ts) rather
 * than as a considered restatement of the target. Fix 3 itself doesn't care
 * what the generation-time rank is — it fights drift regardless — so this
 * change needs re-verifying via `scripts/divisionAudit.ts` but shouldn't
 * require retuning Fix 3 or DIVISION_2_BUDGET_SCALE.
 */
export const NUM_TEAMS_D2 = 20;
export const DIVISION_2_TARGET_D1_RANK = 16;
export const DIVISION_2_OFFSET =
  ((DIVISION_2_TARGET_D1_RANK - 1) / (NUM_TEAMS - 1)) * 2 * TEAM_STRENGTH_SPREAD;
/**
 * Division 2's money-in scale (2026-07-15 retune): both the income rate
 * (see divisionScale in finance/budget.ts) and, as of the same retune, the
 * budget ceiling itself (see clampBudget) now use this factor, so Division
 * 2 clubs can no longer eventually out-save Division 1 clubs the way a flat
 * MAX_BUDGET previously allowed.
 *
 * Set to 0.6 (unchanged from its pre-retune value), not the user's original
 * 0.4 ask: a dynasty audit found 0.4 produced real AI deficits (as low as
 * -$20M) at the widened DIVISION_2_OFFSET above, and even 0.5 still dipped
 * negative in some seeds. 0.6 was re-verified clean (min budget consistently
 * $6M-$23M+ positive across a 3-seed, 30-season audit) — confirmed with the
 * user that relaxing this back up was preferable to a Division 2 that can't
 * sustain itself. See scripts/divisionAudit.ts and the Second Division
 * section of CLAUDE.md for the full audit history.
 */
export const DIVISION_2_BUDGET_SCALE = 0.6;

/**
 * OVR floor above which a Division 2 player refuses to stay in Division 2
 * (`wouldRefuseExtension`, `src/core/ai/breakoutRefusal.ts`) — simplified
 * 2026-07-15 from a per-club valueToClub/affordability match (find a
 * specific Division 1 club that both values him enough and can afford him)
 * to a flat OVR preference: a "good starter" per the Manual's own 65/70/75
 * scale (`src/ui/pages/Manual.tsx`) just doesn't want to play Division 2
 * football, full stop, regardless of whether any particular Division 1 club
 * happens to want or be able to afford him right now. Starting value; tune
 * via `scripts/divisionAudit.ts` if it turns out too loose (barely reduces
 * the season-30 drift) or too tight (empties Division 2 of anyone decent).
 */
export const DIVISION_2_REFUSAL_OVR_THRESHOLD = 70;

/** Straight automatic swap each offseason: bottom N of D1 <-> top N of D2. */
export const PROMOTION_RELEGATION_COUNT = 3;

/**
 * A promoted/relegated club's academyBase (its generation-time strength
 * anchor and permanent youth-intake anchor) doesn't snap to its new
 * division's band instantly — it moves a fraction of the remaining
 * distance each offseason, over this many seasons, so a promoted club has
 * to earn its way up rather than get an instant strength boost.
 */
export const ACADEMY_BASE_CONVERGENCE_SEASONS = 3;

/** Center strength each tier's academyBase converges toward after a swap. */
export const ACADEMY_BASE_CENTER_BY_TIER: Record<1 | 2, number> = {
  1: LEAGUE_BASE,
  2: LEAGUE_BASE - DIVISION_2_OFFSET,
};

/**
 * Composite normalization coefficient: normalized = 0.5 + NORMALIZE_K * z.
 * THE dial for league spread — after z-scoring, raw magnitudes cancel out, so
 * this (with the target distribution shape) governs both single-game favorite
 * odds and end-of-season table spread. Tuned against the M1 validation gates.
 */
export const NORMALIZE_K = 0.08;

/**
 * Std dev of per-player, per-rating gaussian noise. Widened 6→8 alongside the
 * LEAGUE_BASE/TEAM_STRENGTH_SPREAD retune above, so a real elite (80-85+)
 * outlier tail exists from generation itself instead of only emerging after
 * a decade-plus of progression variance compounding one.
 */
export const RATING_NOISE_SD = 8;

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
 * Team OVR/POT rating (Standings, Roster header): a weighted average across
 * the starting XI and bench, not a straight mean of the whole roster —
 * modeled on how BBGM/Football GM derive team ratings from a top-N,
 * depth-weighted slice of the roster rather than every rostered player.
 * Starters all weigh TEAM_RATING_STARTER_WEIGHT (1); each bench player past
 * them weighs less, decaying geometrically by TEAM_RATING_BENCH_DECAY per
 * depth slot off a TEAM_RATING_BENCH_BASE_WEIGHT starting point, so a strong
 * bench lifts the rating while deep fringe players barely move it.
 */
export const TEAM_RATING_STARTER_WEIGHT = 1;
export const TEAM_RATING_BENCH_BASE_WEIGHT = 0.5;
export const TEAM_RATING_BENCH_DECAY = 0.75;

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

/** Initial league generation: uniform age range for starting rosters. */
export const INITIAL_AGE_MIN = 18;
export const INITIAL_AGE_MAX = 33;

/** Youth intake players are always generated at this age. */
export const YOUTH_AGE = 16;

/** Youth intake: min/max generated players per club per season. */
export const YOUTH_INTAKE_MIN = 3;
export const YOUTH_INTAKE_MAX = 5;

/**
 * Youth are raw: generated `base` this many points below the club's fixed
 * academyBase anchor. Raised 20→25 (2026-07-15) after a root-cause dynasty
 * audit found the whole league's rostered OVR climbing ~4-5 points over a
 * generation's worth of turnover (~20-25 seasons) even with progression's
 * per-player age-curve constants themselves net-flat-to-declining over a
 * realistic career: `generatePlayer`'s rating rolls don't depend on age at
 * all, so a 16-year-old was generated at the *same* quality distribution as
 * a mature adult and then still got 8-10 more years of normal age-curve
 * growth on top before reaching maturity — every generation of rookies
 * entered stronger than intended and grew further, so the league's average
 * crept up purely from turnover as older (correctly-generated, at the old
 * standard) players retired and were replaced. Empirically swept
 * (isolated single-division sim: generation + progression + retirement +
 * youth intake + roster trimming, no transfers) to find the offset that
 * holds a 40-season final mean flat against the season-1 generation mean —
 * 20 overshot to +4.5, 30 undershot to -4, 25 landed within ~0.3.
 *
 * Re-swept 25→34 (2026-07-15, same day) after PROGRESSION_FORM_SD_YOUNG/OLD
 * and PROGRESSION_BIAS_SD_YOUNG were widened for more dramatic season-to-season
 * swings — wider variance interacting with growthDamping's asymmetry (only
 * the positive side is damped) and the RATING_MAX clamp shifted the
 * equilibrium this offset needs to hit, so it needed re-verifying rather
 * than assuming the old value still held. Re-swept the same way: 25
 * (previous value) now overshot to +8.5, 30 to +2, 35 undershot to -1.2,
 * 34 landed within ~0.2.
 */
export const YOUTH_BASE_OFFSET = 34;

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
 * noise, so it doesn't shift long-run league equilibrium on its own — though
 * combined with `growthDamping` (which only suppresses the positive side),
 * widening this does pull the equilibrium down slightly, since a wider
 * negative tail passes through undamped while a wider positive tail gets
 * cut; re-verified via dynasty audit and `YOUTH_BASE_OFFSET` retuned
 * alongside this change to hold the league flat regardless.
 *
 * Raised 3→6 (young) / 0.75→2 (old), 2026-07-15, per explicit user request
 * for more dramatic season-to-season swings ("more +5, -5") — a prior pass
 * had deliberately tightened this from an original 5/1 specifically because
 * a young player losing 10 ovr in one season felt too extreme at the time.
 * Swept empirically (age 20/22/26/30 samples) to a value where a ±5 swing
 * is a regular, noticeable occurrence rather than a rare tail event (~28-36%
 * of young players see one in a given season, was ~5-16%), while ≥10
 * swings stay a minority outcome (2-4%, not routine) rather than common.
 */
export const PROGRESSION_FORM_SD_YOUNG = 6;
export const PROGRESSION_FORM_SD_OLD = 2;

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
 *
 * Raised 1.5→3, 2026-07-15, alongside PROGRESSION_FORM_SD_* above — same
 * "more dramatic swings" request.
 */
export const PROGRESSION_BIAS_SD_YOUNG = 3;

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
 *
 * `GROWTH_DAMPING_END`/`GROWTH_DAMPING_FLOOR` retuned 90→80 / 0.25→0.02
 * (2026-07-15), same day as the `PROGRESSION_FORM_SD_*`/`PROGRESSION_BIAS_SD_YOUNG`
 * widening above — bigger swings alone pushed Division 1's 80+ OVR
 * population from ~15-20 (the user's explicit target) up to 60-80 (12-16%
 * of the pool). A wider swing distribution needs the elite end throttled
 * harder to land the same target population, not just a proportional bump.
 * Swept empirically against a 30-season × 3-seed dynasty audit (real
 * `simThrough`/`simOffseason`, Division 1's ~500 players): 0.25 (unchanged)
 * gave 61-78, 0.05 gave 39-56, 0.02 with `GROWTH_DAMPING_END` also pulled in
 * from 90→80 landed **8-16** — back in the intended range. Re-verified via a
 * 100-season audit that Division 1's own mean still holds flat (61-64.5
 * throughout, no further compounding drift from tightening this).
 */
export const GROWTH_DAMPING_START = 65;
export const GROWTH_DAMPING_END = 80;
export const GROWTH_DAMPING_FLOOR = 0.02;

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
 *
 * Raised 50M → 110M on 2026-07-14 alongside the LEAGUE_BASE/TEAM_STRENGTH_SPREAD/
 * RATING_NOISE_SD generation retune above: that retune raises league-wide OVR
 * (and thus wages, which scale cubically with ovr), so the old 50M base broke
 * AI solvency outright (a 20-season × 3-seed dynasty audit under the new
 * generation numbers hit a -26M AI budget and a 79M+ single-club wage bill,
 * both impossible under the old squad-strength assumptions WAGE_SAFE_SQUAD
 * below was benchmarked against). MAX_BUDGET's existing cap already bounds
 * long-run compounding independently of this value, so raising it doesn't
 * reopen the accumulation problem the 2026-07-13 cut was solving.
 */
export const BASE_SEASON_BUDGET = 110_000_000;
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
 * in dynasty audits. Retuned 2026-07-14 alongside the generation retune above
 * (an 80-ovr starting XI is beyond equilibrium AI strength under the new,
 * higher-ceiling generation numbers — the prior [73, 66, 56] benchmark was
 * calibrated to the old, lower OVR distribution).
 */
export const WAGE_SAFE_SQUAD: readonly [count: number, ovr: number][] = [
  [11, 80], [7, 74], [7, 65],
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
/**
 * Default per-season spend a new club starts with, and that the slider
 * resets to each offseason. Resetting to SCOUTING_SPEND_MIN (0) silently
 * maxed out valuation noise for anyone who didn't re-raise it every
 * season; 25% of max buys a modest noise reduction out of the box
 * without committing much budget on the user's behalf.
 */
export const SCOUTING_SPEND_DEFAULT = SCOUTING_SPEND_MAX * 0.25;
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
 * Incoming Offers scout commentary: the scout's read on a buyer's offer
 * relative to the player's (scouting-noised) value to the user's own club.
 * At/above GOOD_RATIO the offer clears our valuation outright ("take it");
 * below BAD_RATIO it's dismissed as a lowball; in between, the scout
 * suggests countering up to the perceived valuation.
 */
export const SCOUT_COMMENTARY_GOOD_RATIO = 0.95;
export const SCOUT_COMMENTARY_BAD_RATIO = 0.6;

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
/** The user's own extend UI lets them pick any length in this range instead of the age default. */
export const EXTENSION_LENGTH_USER_MIN = 1;
export const EXTENSION_LENGTH_USER_MAX = 4;

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

/**
 * Award scoring is otherwise built entirely from in-match performance stats (avgRating +
 * goals/assists/tackles/etc), with no sense of how good the player actually is — a mediocre
 * player on a struggling team can rack up huge tackle/interception counts just from facing more
 * attacks, and out-score a genuinely elite player who had a quieter statistical season. This term
 * pulls awards back toward "best players" rather than "best statlines" by adding
 * `(ovr - AWARD_OVR_BASELINE) * AWARD_OVR_WEIGHT` to both formulas. Baseline is the Manual's
 * "average starter" line; weight is tuned so a modest ovr gap (~10) is worth meaningfully less
 * than a strong stat season and can still be edged out by one, while a large gap (~25+) can't be
 * fully offset by stats alone.
 *
 * Retuned 0.15 → 0.06 on 2026-07-14, in the same PR as the LEAGUE_BASE/TEAM_STRENGTH_SPREAD/
 * RATING_NOISE_SD generation retune above: 0.15 was picked when the league still generated a
 * 7-10-point-short OVR distribution (max ~73-76), so it never got exercised against real elite
 * (80-90) players. Once generation was fixed to actually reach that range, the math didn't hold:
 * a 90-ovr player's bonus at 0.15 is (90-65)*0.15 = 3.75, worth ~47 goals at FWD's 0.08
 * POTY_GOAL_WEIGHT — far beyond a realistic season's output (the M3 §8 gate pins top scorers at
 * 18-32 goals) — making awards a near-pure ovr leaderboard for any real elite player, the opposite
 * of "a big statistical season can still edge out" the term was meant to allow. At 0.06, the same
 * 25-ovr gap is worth 1.5, ~18-19 goals equivalent — close to a realistic season's floor rather
 * than dwarfing it.
 */
export const AWARD_OVR_BASELINE = 65;
export const AWARD_OVR_WEIGHT = 0.06;

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

/* ────────────────────────────────────────────────────────────────────────
 * News Feed accomplishments
 * ──────────────────────────────────────────────────────────────────────── */

/** Minimum single-match rating (see engine/matchRating.ts) to qualify as a matchday's "standout performance" news item. At most one per matchday, league-wide. */
export const NEWS_STANDOUT_RATING_FLOOR = 8.0;

/** Goal-milestone news items fire every time a player's season or career goal total crosses a multiple of this. */
export const NEWS_GOAL_MILESTONE_STEP = 10;
