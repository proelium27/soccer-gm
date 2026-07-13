import { weeklyWage } from "../core/contracts.js";

export const currency = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
});

/** Present a stored per-season salary as the weekly wage the design calls for. */
export function formatWeeklyWage(seasonSalary: number): string {
  return `${currency.format(weeklyWage(seasonSalary))}/wk`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Internally seasons are a 1-based counter; display them as real years starting 2026. */
export const SEASON_START_YEAR = 2026;
export function seasonYear(season: number): number {
  return SEASON_START_YEAR + season - 1;
}
