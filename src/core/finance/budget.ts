import {
  BASE_SEASON_BUDGET, MAX_BUDGET, MAX_BUDGET_FLOOR, HYPE_MAX,
  HYPE_REVENUE_PER_POINT, HYPE_REVENUE_DAMPING,
  PRIZE_CHAMPION, PRIZE_TOP_5, PRIZE_TOP_10, PRIZE_TOP_5_CUTOFF, PRIZE_TOP_10_CUTOFF,
  DIVISION_2_BUDGET_SCALE, countryBudgetScale,
} from "../constants.js";
import type { Competition } from "../competitions.js";
import { competitionOf } from "../competitions.js";

/**
 * A competition's money scale — its country's scale times its tier's scale.
 * Both income (seasonRevenue/chargeSeasonStart) and the savings ceiling
 * (budgetCap/clampBudget) are multiplied by this, so a weaker/poorer league
 * (France, Portugal) both earns less and can bank less than the big four, and
 * a tier-2 club less than its tier-1 counterpart. This is THE single scale
 * every finance function takes — call sites pass financeScale(competitions,
 * compId) wherever they used to pass a bare tier.
 */
function tierScale(tier: 1 | 2): number {
  return tier === 1 ? 1 : DIVISION_2_BUDGET_SCALE;
}

export function financeScale(competitions: Competition[], compId: number): number {
  const c = competitionOf(competitions, compId);
  return countryBudgetScale(c.country) * tierScale(c.tier);
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
 * competition, scaled down for tier 2. Three exclusive tiers: the
 * champion's prize, a top-5 prize (2nd-5th), and a top-10 prize (6th-10th);
 * the bottom half of the table gets nothing beyond the base.
 */
export function successPayout(rank: number, scale: number): number {
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
export function seasonRevenue(rank: number, hype: number, scale: number): SeasonRevenue {
  const base = BASE_SEASON_BUDGET * scale;
  const payout = successPayout(rank, scale);
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
): number {
  const { successPayout: payout, hypeRevenue } = seasonRevenue(rank, hype, scale);
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
