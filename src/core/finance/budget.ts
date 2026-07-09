import {
  BASE_SEASON_BUDGET, SUCCESS_PAYOUT_BY_RANK, HYPE_REVENUE_PER_POINT, HYPE_REVENUE_DAMPING,
} from "../constants.js";

export interface SeasonRevenue {
  base: number;
  successPayout: number;
  hypeRevenue: number;
  total: number;
}

/**
 * Season income: an equal base share for every club, a success payout keyed
 * to final domestic rank (1-indexed), and a heavily damped hype→revenue
 * channel (ticket/jersey sales) so fame is a secondary, not primary, source
 * of budget spread.
 */
export function seasonRevenue(rank: number, hype: number): SeasonRevenue {
  const successPayout = SUCCESS_PAYOUT_BY_RANK[rank - 1] ?? 0;
  const hypeRevenue = hype * HYPE_REVENUE_PER_POINT * HYPE_REVENUE_DAMPING;
  return {
    base: BASE_SEASON_BUDGET,
    successPayout,
    hypeRevenue,
    total: BASE_SEASON_BUDGET + successPayout + hypeRevenue,
  };
}

/** Sum of weekly-equivalent salaries for a club's roster (as tracked on `player.contract.salary`). */
export function wageBill(roster: number[], playerSalary: Map<number, number>): number {
  return roster.reduce((sum, pid) => sum + (playerSalary.get(pid) ?? 0), 0);
}

/**
 * Roll a club's budget forward one season: add this season's revenue,
 * subtract the wage bill and whatever was spent on scouting. Can go
 * negative — spending discipline is left to the user/AI logic, not enforced
 * here.
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
