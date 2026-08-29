import {
  BASE_SEASON_BUDGET, MAX_BUDGET, MAX_BUDGET_FLOOR, HYPE_MAX,
  HYPE_REVENUE_PER_POINT, HYPE_REVENUE_DAMPING,
  PRIZE_CHAMPION, PRIZE_TOP_5, PRIZE_TOP_10, PRIZE_TOP_5_CUTOFF, PRIZE_TOP_10_CUTOFF,
  DIVISION_2_BUDGET_SCALE, NUM_TEAMS,
  difficultyProfile, type Difficulty,
} from "../constants.js";
import type { Competition } from "../competitions.js";
import { competitionOf, competitionBudgetScale } from "../competitions.js";

/**
 * A competition's money scale — its country's scale times its tier's scale.
 * Both income (seasonRevenue/chargeSeasonStart) and the savings ceiling
 * (budgetCap/clampBudget) are multiplied by this, so a weaker/poorer league
 * (France, Portugal, Belgium, Turkey) both earns less and can bank less than the big four, and
 * a tier-2 club less than its tier-1 counterpart. This is THE single scale
 * every finance function takes — call sites pass financeScale(competitions,
 * compId) wherever they used to pass a bare tier.
 */
function tierScale(tier: 1 | 2): number {
  return tier === 1 ? 1 : DIVISION_2_BUDGET_SCALE;
}

export function financeScale(competitions: Competition[], compId: number): number {
  const c = competitionOf(competitions, compId);
  return competitionBudgetScale(c) * tierScale(c.tier);
}

/**
 * A club's money scale with the save's difficulty folded in — the ONE seam
 * difficulty uses for finance. Identical to `financeScale` for every AI club;
 * the user's club additionally takes `budgetScale` from his difficulty profile
 * (see the DIFFICULTIES block in constants.ts).
 *
 * Every site where the USER's budget can increase must call this rather than
 * `financeScale`, and it matters that this scales the savings ceiling as well
 * as income: `clampBudget` destroys anything banked above `budgetCap`, so an
 * easier level that raised income but not the ceiling would hand a big club a
 * bonus and then silently delete it.
 *
 * Wages are deliberately NOT scaled (they're country-independent already), so
 * a hard level's squeeze reads as a real income-vs-wage-bill gap rather than a
 * uniform shrinking of the whole economy — the user has to sell his way out.
 */
export function financeScaleFor(
  competitions: Competition[],
  compId: number,
  tid: number,
  userTid: number,
  difficulty: Difficulty | undefined,
): number {
  const base = financeScale(competitions, compId);
  return tid === userTid ? base * difficultyProfile(difficulty).budgetScale : base;
}

/**
 * The savings ceiling for a club, scaled by its fame (hype, 0-100) between
 * MAX_BUDGET_FLOOR (a nobody club) and MAX_BUDGET (a famous, successful one),
 * then by its competition's money scale. So a big club can bank/spend a bigger
 * war chest than a struggling one — fame → money → stronger squad → more fame —
 * while a poorer/lower league can never out-save a richer one at the same fame.
 * Hype is clamped to [0, HYPE_MAX] defensively.
 */
export function budgetCap(scale: number, hype: number): number {
  const h = Math.max(0, Math.min(HYPE_MAX, hype)) / HYPE_MAX;
  return (MAX_BUDGET_FLOOR + h * (MAX_BUDGET - MAX_BUDGET_FLOOR)) * scale;
}

/**
 * Caps a budget at the club's fame-scaled ceiling (see budgetCap) — applied
 * everywhere a club's budget can increase, so wealth tracks success and a
 * poorer/lower league can never out-save a richer one at the same fame level.
 * A club can still spend below the line freely; it just can't bank above it.
 */
export function clampBudget(budget: number, scale: number, hype: number): number {
  return Math.min(budget, budgetCap(scale, hype));
}

export interface SeasonRevenue {
  base: number;
  successPayout: number;
  hypeRevenue: number;
  total: number;
}

/**
 * Prize money for a final league position (1-indexed) within the club's own
 * competition, scaled down for tier 2. Three exclusive tiers: the champion's
 * prize, a top-quarter prize, and a top-half prize; the bottom half of the
 * table gets nothing beyond the base.
 *
 * **The cutoffs are a FRACTION of the division, not fixed ranks, and that is a
 * correctness requirement once divisions differ in size (2026-08-29).** They
 * shipped as a flat 5th and 10th, which is the same thing while every league
 * fields 20 clubs and stops being so the moment one doesn't: at fixed ranks a
 * 12-club league pays 10 of its 12 clubs and a 10-club second division pays
 * *every single one*, so mean prize per club runs £8.5M at 20 clubs against
 * £17.0M at 10 — a smaller league is simply richer, per club, for no footballing
 * reason. That lands straight on the documented tripwire that a weaker-but-richer
 * league climbs the ladder over a dynasty, and it did: on the coefficient audit's
 * seed 1, Scotland (12 clubs, generated second-weakest in the world) finished 20
 * seasons with the HIGHEST tier-1 mean OVR of any country, above Germany.
 *
 * The fractions are derived from the shipped constants rather than written
 * separately, so a 20-club division is byte-identical to before (0.25 → 5,
 * 0.5 → 10) and the four big leagues are untouched. `divisionSize` therefore
 * defaults to `NUM_TEAMS`, which is what every pre-existing caller meant.
 *
 * The residual is the champion's prize: it is a lump that does not divide, so a
 * small league still pays marginally more per club (£9.2M at 12 against £8.5M at
 * 20, down from £14.2M). That is deliberate — winning a title is worth the same
 * wherever you win it — and it is ~18% of the distortion the flat cutoffs had.
 */
export function successPayout(rank: number, scale: number, divisionSize = NUM_TEAMS): number {
  if (rank === 1) return PRIZE_CHAMPION * scale;
  const size = Number.isFinite(divisionSize) && divisionSize > 0 ? divisionSize : NUM_TEAMS;
  if (rank <= Math.round((PRIZE_TOP_5_CUTOFF / NUM_TEAMS) * size)) return PRIZE_TOP_5 * scale;
  if (rank <= Math.round((PRIZE_TOP_10_CUTOFF / NUM_TEAMS) * size)) return PRIZE_TOP_10 * scale;
  return 0;
}

/**
 * Season income: an equal base share for every club in the competition,
 * tiered prize money on top, and a heavily damped hype->revenue channel —
 * all scaled down for tier 2 to reflect the real financial gap between
 * top-flight and second-tier football.
 */
export function seasonRevenue(
  rank: number, hype: number, scale: number, divisionSize = NUM_TEAMS,
): SeasonRevenue {
  const base = BASE_SEASON_BUDGET * scale;
  const payout = successPayout(rank, scale, divisionSize);
  const hypeRevenue = hype * HYPE_REVENUE_PER_POINT * HYPE_REVENUE_DAMPING * scale;
  return { base, successPayout: payout, hypeRevenue, total: base + payout + hypeRevenue };
}

/**
 * A club's per-season wage bill: the sum of `player.contract.salary` across
 * the roster (per-season totals set at signing by `seasonSalaryForOvr`),
 * charged once per season here; the contract UI presents them as weekly
 * figures, but the stored number is the season total.
 */
export function wageBill(roster: number[], playerSalary: Map<number, number>): number {
  return roster.reduce((sum, pid) => sum + (playerSalary.get(pid) ?? 0), 0);
}

/**
 * Season-end settlement: performance money in (success payout by final rank
 * within the club's own competition, plus hype revenue), scouting spend out.
 * Wages are NOT charged here — they are paid up front at each season's
 * start (chargeSeasonStart).
 */
export function settleSeasonEnd(
  currentBudget: number,
  rank: number,
  hype: number,
  scoutingSpend: number,
  scale: number,
  divisionSize = NUM_TEAMS,
): number {
  const { successPayout: payout, hypeRevenue } = seasonRevenue(rank, hype, scale, divisionSize);
  return clampBudget(currentBudget + payout + hypeRevenue - scoutingSpend, scale, hype);
}

/**
 * Season-start charge, applied when a season begins (league creation and
 * every offseason rollover, on the finalized new-season roster): the base
 * allocation (scaled down for tier 2) arrives and the squad's wages for
 * the season are paid out of it immediately.
 */
export function chargeSeasonStart(currentBudget: number, wages: number, scale: number, hype: number): number {
  return clampBudget(currentBudget + BASE_SEASON_BUDGET * scale - wages, scale, hype);
}
