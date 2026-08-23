/**
 * Maps matchdays (1–38) to calendar months for a typical European football
 * season (August → May).
 */

/**
 * Deadline day: the last matchday of the mid-season (winter) transfer
 * window. The window closes once this matchday is played; "Sim to Transfer
 * Deadline" stops just before it, so the user lands on deadline day with the
 * window still open.
 */
export const SEASON_MATCHDAYS = 38;

/**
 * The most clubs a division can hold. A double round robin of n clubs needs
 * 2(n-1) matchdays, and the season is a fixed SEASON_MATCHDAYS grid that the
 * transfer windows, both continental competitions and the month mapping are all
 * pinned to — matchdayToMonth throws outside it. So 20 clubs (38 matchdays) is
 * the ceiling, and a smaller division spreads its rounds across the same grid
 * rather than finishing early (see buildCompetitionSchedule).
 */
export const MAX_DIVISION_TEAMS = SEASON_MATCHDAYS / 2 + 1;

/** The fewest clubs worth calling a division. Must be even, like every count. */
export const MIN_DIVISION_TEAMS = 8;

export const TRANSFER_DEADLINE_MATCHDAY = 22;

/** The winter window opens once matchday 17 is played (mid-December). */
export const WINTER_WINDOW_OPEN_MATCHDAY = 18;

/**
 * The summer window spans the whole offseason phase and stays open through
 * this matchday (August), mirroring the real early-September close.
 */
export const SUMMER_WINDOW_CLOSE_MATCHDAY = 4;

/**
 * Each entry defines [firstMatchday, lastMatchday, monthName].
 * Ranges are inclusive on both ends.
 */
const MONTH_RANGES: readonly [number, number, string][] = [
  [1, 4, "August"],
  [5, 8, "September"],
  [9, 13, "October"],
  [14, 17, "November"],
  [18, 21, "December"],
  [22, 25, "January"],
  [26, 29, "February"],
  [30, 33, "March"],
  [34, 36, "April"],
  [37, 38, "May"],
];

/** Return the month name for a given matchday (1–38). */
export function matchdayToMonth(matchday: number): string {
  for (const [first, last, month] of MONTH_RANGES) {
    if (matchday >= first && matchday <= last) return month;
  }
  throw new Error(`matchday out of range: ${matchday}`);
}

/** Return the last matchday that falls within the same month as the given matchday. */
export function lastMatchdayOfMonth(currentMatchday: number): number {
  for (const [first, last] of MONTH_RANGES) {
    if (currentMatchday >= first && currentMatchday <= last) return last;
  }
  throw new Error(`matchday out of range: ${currentMatchday}`);
}
