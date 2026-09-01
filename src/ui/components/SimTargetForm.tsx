import { useEffect, useState } from "react";
import {
  maxValue, minValue, simTargetHint, targetMatchday, type SimTargetMode,
} from "../simTarget.js";

interface SimTargetFormProps {
  /** Matchday the league is standing on (the next one to be played). */
  current: number;
  /** Last matchday of the season (the sim can't be asked to go past it). */
  last: number;
  disabled?: boolean;
  /** Sim through this matchday. */
  onSim: (matchday: number) => void;
  /** Menu variant: stacks tighter and drops the "Sim" wording to fit a dropdown. */
  compact?: boolean;
  /**
   * Take the hint ("Plays matchdays 1-4...") and render it yourself.
   *
   * The Dashboard puts it on the card's heading line, beside "Simulation", so
   * the select, the number and the Sim button can share one row with the sim
   * buttons instead of being pushed into a column of their own. Supplying this
   * suppresses the copy this component would otherwise draw under the
   * controls, so the hint is never in two places at once.
   */
  onHintChange?: (hint: string, valid: boolean) => void;
}

/** Default target: about a month of football, clamped to the run-in. */
function defaultValue(mode: SimTargetMode, current: number, last: number): number {
  const wanted = mode === "to" ? current + 3 : 4;
  return Math.min(wanted, maxValue(mode, current, last));
}

/**
 * "Sim to matchday N" / "sim N matchdays" — replaces the old fixed
 * "end of month" and "transfer deadline" jumps, which were the only two
 * distances you could pick.
 *
 * The entered number is left uncontrolled-by-default (`null` = untouched) so
 * the suggestion tracks the calendar as the season moves, and it resets after
 * each sim rather than leaving a now-past matchday sitting in the box.
 */
export function SimTargetForm({
  current, last, disabled, onSim, compact, onHintChange,
}: SimTargetFormProps) {
  const [mode, setMode] = useState<SimTargetMode>("to");
  const [raw, setRaw] = useState<string | null>(null);

  const fallback = defaultValue(mode, current, last);
  const text = raw ?? String(fallback);
  const value = text.trim() === "" ? NaN : Number(text);
  const lo = minValue(mode, current);
  const hi = maxValue(mode, current, last);
  const valid = Number.isInteger(value) && value >= lo && value <= hi;
  const hint = simTargetHint(mode, value, current, last);

  // Reported rather than lifted: the mode and the number are this component's
  // own business, and hoisting them into two dashboards to place one line of
  // text would put the same state in three places.
  useEffect(() => {
    onHintChange?.(hint, valid);
  }, [hint, valid, onHintChange]);

  function submit() {
    if (!valid || disabled) return;
    onSim(targetMatchday(mode, value, current));
    setRaw(null);
  }

  return (
    // A dropdown menu is only 10rem wide by default, which wraps the hint into a
    // narrow column; the menu grows to fit this instead.
    <div className={compact ? "px-3 py-2" : ""} style={compact ? { minWidth: "18rem" } : undefined}>
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <select
          // Full-size controls inline on the Dashboard so this row lines up
          // with the green sim buttons beside it; small ones in the menu.
          className={`form-select w-auto ${compact ? "form-select-sm" : ""}`}
          value={mode}
          disabled={disabled}
          aria-label="How far to sim"
          onChange={(e) => {
            setMode(e.target.value as SimTargetMode);
            setRaw(null);
          }}
        >
          <option value="to">Sim to matchday</option>
          <option value="forward">Sim this many matchdays</option>
        </select>
        <input
          type="number"
          className={`form-control ${compact ? "form-control-sm" : ""} ${valid ? "" : "is-invalid"}`}
          style={{ width: "5.5rem" }}
          min={lo}
          max={hi}
          step={1}
          value={text}
          disabled={disabled}
          aria-label={mode === "to" ? "Target matchday" : "Number of matchdays"}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          className={compact ? "btn btn-sm btn-primary" : "btn btn-primary"}
          // Inside a Dropdown, this is the one control that should close the menu.
          data-dropdown-close={compact ? "" : undefined}
          disabled={disabled || !valid}
          onClick={submit}
        >
          Sim
        </button>
      </div>
      {/* Only when nobody upstream asked to place it. The Dashboard puts it on
          the card's heading line so the controls can share one row with the
          sim buttons; a dropdown has no heading line, so it keeps it here. */}
      {!onHintChange && (
        <div className={`small mt-1 ${valid ? "text-muted" : "text-danger"}`}>{hint}</div>
      )}
    </div>
  );
}
