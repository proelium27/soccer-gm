import { type AllTimeStatKey } from "../core/frivolities/stats.js";

/** Display labels for the ranked stats, matching the per-season Stat Leaders page's wording. */
export const STAT_LABELS: Record<AllTimeStatKey, string> = {
  goals: "Goals",
  assists: "Assists",
  shots: "Shots",
  shotsOnTarget: "Shots on Target",
  xg: "xG",
  saves: "Saves",
  tackles: "Tackles",
  interceptions: "Interceptions",
  passes: "Passes",
  crosses: "Crosses",
  foulsCommitted: "Fouls",
  minutesPlayed: "Minutes",
  appearances: "Appearances",
  avgRating: "Match Rating",
};

/** Stats that read better with a decimal than as a whole number. */
const DECIMAL_STATS = new Set<AllTimeStatKey>(["xg", "avgRating"]);

export function formatStat(stat: AllTimeStatKey, value: number): string {
  return DECIMAL_STATS.has(stat)
    ? value.toFixed(stat === "avgRating" ? 2 : 1)
    : Math.round(value).toLocaleString();
}
