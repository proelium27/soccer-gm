import {
  BASE_SEASON_BUDGET, MAX_BUDGET, MAX_BUDGET_FLOOR, HYPE_MAX,
  HYPE_REVENUE_PER_POINT, HYPE_REVENUE_DAMPING,
  PRIZE_CHAMPION, PRIZE_TOP_5, PRIZE_TOP_10, PRIZE_TOP_5_CUTOFF, PRIZE_TOP_10_CUTOFF,
  DIVISION_2_BUDGET_SCALE,
} from "../constants.js";

/**
 * Scale factor for a tier's money — both income (see seasonRevenue/
 * chargeSeasonStart) and, since the 2026-07-15 retune, the savings ceiling
 * (see clampBudget): 1 for tier 1, DIVISION_2_BUDGET_SCALE for tier 2.
 */
function tierScale(tier: 1 | 2): number {
  return tier === 1 ? 1 : DIVISION_2_BUDGET_SCALE;
}

/**
 * The savings ceiling for a club, scaled by its fame (hype, 0-100) between
 * MAX_BUDGET_FLOOR (a nobody club) and MAX_BUDGET (a famous, successful one),
 * then scaled down for tier 2. So a big club can bank/spend a bigger war chest
 * than a struggling one — fame → money → stronger squad → more fame — while
 * tier 2 still can't out-save its tier-1 counterparts. Hype is clamped to
 * [0, HYPE_MAX] defensively.
 */
export function budgetCap(tier: 1 | 2, hype: number): number {
  const h = Math.max(0, Math.min(HYPE_MAX, hype)) / HYPE_MAX;
  return (MAX_BUDGET_FLOOR + h * (MAX_BUDGET - MAX_BUDGET_FLOOR)) * tierScale(tier);
}

/**
 * Caps a budget at the club's fame-scaled ceiling (see budgetCap) — applied
 * everywhere a club's budget can increase, so wealth tracks success and a
 * tier 2 club can never out-save a tier 1 club at the same fame level. A club
 * can still spend below the line freely; it just can't bank above it.
 */
export function clampBudget(budget: number, tier: 1 | 2, hype: number): number {
  return Math.min(budget, budgetCap(tier, hype));
}

export interface SeasonRevenue {
  base: number;
  successPayout: number;
  hypeRevenue: number;
  total: number;
}

/**
 * Prize money for a final league position (1-indexed) within the club's own
 * competition, scaled down for tier 2. Three exclusive tiers: the
 * champion's prize, a top-5 prize (2nd-5th), and a top-10 prize (6th-10th);
 * the bottom half of the table gets nothing beyond the base.
 */
export function successPayout(rank: number, tier: 1 | 2): number {
  const scale = tierScale(tier);
  if (rank === 1) return PRIZE_CHAMPION * scale;
  if (rank <= PRIZE_TOP_5_CUTOFF) return PRIZE_TOP_5 * scale;
  if (rank <= PRIZE_TOP_10_CUTOFF) return PRIZE_TOP_10 * scale;
  return 0;
}

/**
 * Season income: an equal base share for every club in the competition,
 * tiered prize money on top, and a heavily damped hype->revenue channel —
 * all scaled down for tier 2 to reflect the real financial gap between
 * top-flight and second-tier football.
 */
export function seasonRevenue(rank: number, hype: number, tier: 1 | 2): SeasonRevenue {
  const scale = tierScale(tier);
  const base = BASE_SEASON_BUDGET * scale;
  const payout = successPayout(rank, tier);
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
  tier: 1 | 2,
): number {
  const { successPayout: payout, hypeRevenue } = seasonRevenue(rank, hype, tier);
  return clampBudget(currentBudget + payout + hypeRevenue - scoutingSpend, tier, hype);
}

/**
 * Season-start charge, applied when a season begins (league creation and
 * every offseason rollover, on the finalized new-season roster): the base
 * allocation (scaled down for tier 2) arrives and the squad's wages for
 * the season are paid out of it immediately.
 */
export function chargeSeasonStart(currentBudget: number, wages: number, tier: 1 | 2, hype: number): number {
  return clampBudget(currentBudget + BASE_SEASON_BUDGET * tierScale(tier) - wages, tier, hype);
}
