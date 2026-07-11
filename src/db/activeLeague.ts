const ACTIVE_LID_KEY = "soccer-gm:activeLid";

/** Get the lid of the league the user was last in, if any. */
export function getActiveLid(): number | null {
  const raw = localStorage.getItem(ACTIVE_LID_KEY);
  if (raw === null) return null;
  const lid = Number(raw);
  return Number.isFinite(lid) ? lid : null;
}

/** Remember which league is active so the app resumes it on next load. */
export function setActiveLid(lid: number): void {
  localStorage.setItem(ACTIVE_LID_KEY, String(lid));
}

/** Forget the active league (e.g. when returning to the league picker). */
export function clearActiveLid(): void {
  localStorage.removeItem(ACTIVE_LID_KEY);
}
