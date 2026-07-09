/**
 * Maps matchdays (1–38) to calendar months for a typical European football
 * season (August → May).
 */

/** The first matchday after the January transfer window opens. */
export const TRANSFER_DEADLINE_MATCHDAY = 22;

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
