import {
  BASE_SEASON_BUDGET, HYPE_REVENUE_PER_POINT, HYPE_REVENUE_DAMPING,
  PRIZE_CHAMPION, PRIZE_TOP_5, PRIZE_TOP_10, PRIZE_TOP_5_CUTOFF, PRIZE_TOP_10_CUTOFF,
} from "../constants.js";

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
 * Roll a club's budget forward one season: add this season's revenue,
 * subtract the wage bill and whatever was spent on scouting. Per design,
 * AI clubs never lose money: the base allocation alone exceeds the expenses
 * of any squad they can assemble (invariant tested in budget.test.ts), so
 * their settled budgets only grow. A user hoarding an elite ROSTER_CAP squad
 * can run a deficit — the Finance page projects it.
 */
export function settleSeasonBudget(
  currentBudget: number,
  rank: number,
  hype: number,
  wages: number,
  scoutingSpend: number,
): number {
  const { total } = seasonRevenue(rank, hype);
  return currentBudget + total - wages - scoutingSpend;
}
