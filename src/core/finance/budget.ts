import {
  BASE_SEASON_BUDGET, MAX_BUDGET, HYPE_REVENUE_PER_POINT, HYPE_REVENUE_DAMPING,
  PRIZE_CHAMPION, PRIZE_TOP_5, PRIZE_TOP_10, PRIZE_TOP_5_CUTOFF, PRIZE_TOP_10_CUTOFF,
} from "../constants.js";

/** Caps a budget at MAX_BUDGET; applied everywhere a club's budget can increase. */
export function clampBudget(budget: number): number {
  return Math.min(budget, MAX_BUDGET);
}

export interface SeasonRevenue {
  base: number;
  successPayout: number;
  hypeRevenue: number;
  total: number;
}

/**
 * Prize money for a final league position (1-indexed). Three exclusive
 * tiers: the champion's prize, a top-5 prize (2nd-5th), and a top-10 prize
 * (6th-10th); the bottom half of the table gets nothing beyond the base.
 */
export function successPayout(rank: number): number {
  if (rank === 1) return PRIZE_CHAMPION;
  if (rank <= PRIZE_TOP_5_CUTOFF) return PRIZE_TOP_5;
  if (rank <= PRIZE_TOP_10_CUTOFF) return PRIZE_TOP_10;
  return 0;
}

/**
 * Season income: an equal base share for every club, tiered prize money on
 * top for the league winner / top 5 / top 10, and a heavily damped
 * hype→revenue channel (ticket/jersey sales) so fame is a secondary, not
 * primary, source of budget spread.
 */
export function seasonRevenue(rank: number, hype: number): SeasonRevenue {
  const payout = successPayout(rank);
  const hypeRevenue = hype * HYPE_REVENUE_PER_POINT * HYPE_REVENUE_DAMPING;
  return {
    base: BASE_SEASON_BUDGET,
    successPayout: payout,
    hypeRevenue,
    total: BASE_SEASON_BUDGET + payout + hypeRevenue,
  };
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
 * plus hype revenue), scouting spend out. Wages are NOT charged here — they
 * are paid up front at each season's start (chargeSeasonStart), so a club's
 * in-season cash is what's genuinely spendable after its squad is paid.
 */
export function settleSeasonEnd(
  currentBudget: number,
  rank: number,
  hype: number,
  scoutingSpend: number,
): number {
  const { successPayout: payout, hypeRevenue } = seasonRevenue(rank, hype);
  return clampBudget(currentBudget + payout + hypeRevenue - scoutingSpend);
}

/**
 * Season-start charge, applied when a season begins (league creation and
 * every offseason rollover, on the finalized new-season roster): the base
 * allocation arrives and the squad's wages for the season are paid out of
 * it immediately. Per design, AI clubs never lose money here: the base
 * allocation alone exceeds the wage bill of any squad they can assemble
 * (invariant tested in budget.test.ts). A user hoarding an elite ROSTER_CAP
 * squad can outspend it — the Finance page projects the shortfall.
 */
export function chargeSeasonStart(currentBudget: number, wages: number): number {
  return clampBudget(currentBudget + BASE_SEASON_BUDGET - wages);
}
