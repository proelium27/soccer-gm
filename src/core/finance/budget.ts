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

/**
 * A club's per-season wage bill: the sum of `player.contract.salary` across
 * the roster. Salaries are flat per-season placeholder amounts
 * (SALARY_PER_OVR × ovr), charged once per season here; the contract UI may
 * present them as weekly figures, but the stored number is the season total.
 */
export function wageBill(roster: number[], playerSalary: Map<number, number>): number {
  return roster.reduce((sum, pid) => sum + (playerSalary.get(pid) ?? 0), 0);
}

/**
 * Roll a club's budget forward one season: add this season's revenue,
 * subtract the wage bill and whatever was spent on scouting. Per design,
 * clubs never lose money: the base allocation alone exceeds the maximum
 * possible expenses (invariant tested in budget.test.ts), so a settled
 * budget only grows.
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
