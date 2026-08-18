import { matchdayToMonth, TRANSFER_DEADLINE_MATCHDAY } from "../core/calendar.js";

/**
 * The two ways a player thinks about "sim forward a bit": either they have a
 * matchday in mind (deadline day, the last game before a cup tie) or they just
 * want a chunk of games. Both land on the same thing — a target matchday — so
 * the sim engine only ever sees `{ matchday }`.
 */
export type SimTargetMode = "to" | "forward";

/** Turn an entered number into the matchday to sim through. */
export function targetMatchday(mode: SimTargetMode, value: number, current: number): number {
  // "forward 1" means play the matchday you're standing on, not the next one.
  return mode === "to" ? value : current + value - 1;
}

/** The lowest number the input accepts for each mode (matchday vs count). */
export function minValue(mode: SimTargetMode, current: number): number {
  return mode === "to" ? current : 1;
}

/** The highest number the input accepts for each mode. */
export function maxValue(mode: SimTargetMode, current: number, last: number): number {
  return mode === "to" ? last : last - current + 1;
}

/**
 * The sentence under the input: how many matchdays this plays, where it lands,
 * and — since this control replaced the old "sim to transfer deadline" button —
 * what it does to the winter window.
 */
export function simTargetHint(
  mode: SimTargetMode,
  value: number,
  current: number,
  last: number,
): string {
  const lo = minValue(mode, current);
  const hi = maxValue(mode, current, last);
  if (!Number.isInteger(value) || value < lo || value > hi) {
    return mode === "to"
      ? `Pick a matchday between ${lo} and ${hi}.`
      : `Pick a number between ${lo} and ${hi}.`;
  }

  const target = targetMatchday(mode, value, current);
  const count = target - current + 1;
  const span = count === 1 ? `matchday ${target}` : `matchdays ${current}-${target}`;
  let hint = `Plays ${span} (${count} ${count === 1 ? "matchday" : "matchdays"}), ending in ${matchdayToMonth(target)}.`;

  // Deadline day is the one matchday with a consequence beyond the results,
  // so say so rather than making the player remember matchday 22.
  if (current <= TRANSFER_DEADLINE_MATCHDAY) {
    if (target >= TRANSFER_DEADLINE_MATCHDAY) {
      hint += ` Plays through deadline day (matchday ${TRANSFER_DEADLINE_MATCHDAY}), shutting the winter window.`;
    } else if (target === TRANSFER_DEADLINE_MATCHDAY - 1) {
      hint += " Leaves you on deadline day with the winter window still open.";
    }
  }
  return hint;
}
