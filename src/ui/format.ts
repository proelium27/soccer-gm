import { weeklyWage } from "../core/contracts.js";

export const currency = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
});

/** Present a stored per-season salary as the weekly wage the design calls for. */
export function formatWeeklyWage(seasonSalary: number): string {
  return `${currency.format(weeklyWage(seasonSalary))}/wk`;
}
