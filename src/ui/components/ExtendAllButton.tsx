/**
 * "Extend all" — one click to re-sign every player on this page whose deal is
 * up, on the standard age-based terms.
 *
 * Deliberately NOT behind a confirm step, unlike the jump-ahead button. The
 * whole point is to remove clicks from a chore, and nothing here is a one-way
 * door: keeping a player you meant to let go costs nothing until the season
 * rolls over (wages are charged at season start, `chargeSeasonStart`), and
 * releasing him afterwards is one click on the same page. The cost is on the
 * label instead of behind a dialog, so the commitment is visible before the
 * press rather than after it.
 */
import { formatWeeklyWage } from "../format.js";

export interface ExtendAllButtonProps {
  /** How many players it would re-sign. Renders nothing at zero. */
  count: number;
  /** Their combined per-season wage bill, shown weekly. */
  totalSalary: number;
  disabled?: boolean;
  onExtendAll: () => void;
}

export function ExtendAllButton({
  count, totalSalary, disabled, onExtendAll,
}: ExtendAllButtonProps) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      className="btn btn-sm btn-success text-nowrap"
      disabled={disabled}
      title="Re-signs each of them for the default length for his age. You can still extend one at a time instead."
      onClick={onExtendAll}
    >
      {count === 1 ? "Extend him" : `Extend all ${count}`} &middot;{" "}
      {formatWeeklyWage(totalSalary)}
    </button>
  );
}
