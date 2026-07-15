import {
  BASE_SEASON_BUDGET, MAX_BUDGET, HYPE_REVENUE_PER_POINT, HYPE_REVENUE_DAMPING,
  PRIZE_CHAMPION, PRIZE_TOP_5, PRIZE_TOP_10, PRIZE_TOP_5_CUTOFF, PRIZE_TOP_10_CUTOFF,
  DIVISION_2_BUDGET_SCALE,
} from "../constants.js";

/**
 * Scale factor for a division's money — both income (see seasonRevenue/
 * chargeSeasonStart) and, since the 2026-07-15 retune, the savings ceiling
 * (see clampBudget): 1 for Division 1, DIVISION_2_BUDGET_SCALE for
 * Division 2.
 */
function divisionScale(division: 0 | 1): number {
  return division === 0 ? 1 : DIVISION_2_BUDGET_SCALE;
}

/**
 * Caps a budget at MAX_BUDGET, scaled down for Division 2 by
 * DIVISION_2_BUDGET_SCALE (the same factor that scales Division 2's income
 * — see divisionScale above) — applied everywhere a club's budget can
 * increase, so a Division 2 club can never out-save a Division 1 club no
 * matter how well it's run.
 */
export function clampBudget(budget: number, division: 0 | 1): number {
  return Math.min(budget, MAX_BUDGET * divisionScale(division));
}

export interface SeasonRevenue {
  base: number;
  successPayout: number;
  hypeRevenue: number;
  total: number;
}

/**
 * Prize money for a final league position (1-indexed) within the club's own
 * division, scaled down for Division 2. Three exclusive tiers: the
 * champion's prize, a top-5 prize (2nd-5th), and a top-10 prize (6th-10th);
 * the bottom half of the table gets nothing beyond the base.
 */
export function successPayout(rank: number, division: 0 | 1): number {
  const scale = divisionScale(division);
  if (rank === 1) return PRIZE_CHAMPION * scale;
  if (rank <= PRIZE_TOP_5_CUTOFF) return PRIZE_TOP_5 * scale;
  if (rank <= PRIZE_TOP_10_CUTOFF) return PRIZE_TOP_10 * scale;
  return 0;
}

/**
 * Season income: an equal base share for every club in the division, tiered
 * prize money on top, and a heavily damped hype->revenue channel — all
 * scaled down for Division 2 to reflect the real financial gap between
 * top-flight and second-tier football.
 */
export function seasonRevenue(rank: number, hype: number, division: 0 | 1): SeasonRevenue {
  const scale = divisionScale(division);
  const base = BASE_SEASON_BUDGET * scale;
  const payout = successPayout(rank, division);
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
 * within the club's own division, plus hype revenue), scouting spend out.
 * Wages are NOT charged here — they are paid up front at each season's
 * start (chargeSeasonStart).
 */
export function settleSeasonEnd(
  currentBudget: number,
  rank: number,
  hype: number,
  scoutingSpend: number,
  division: 0 | 1,
): number {
  const { successPayout: payout, hypeRevenue } = seasonRevenue(rank, hype, division);
  return clampBudget(currentBudget + payout + hypeRevenue - scoutingSpend, division);
}

/**
 * Season-start charge, applied when a season begins (league creation and
 * every offseason rollover, on the finalized new-season roster): the base
 * allocation (scaled down for Division 2) arrives and the squad's wages for
 * the season are paid out of it immediately.
 */
export function chargeSeasonStart(currentBudget: number, wages: number, division: 0 | 1): number {
  return clampBudget(currentBudget + BASE_SEASON_BUDGET * divisionScale(division) - wages, division);
}
