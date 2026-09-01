/**
 * "Jump ahead N seasons" — the control that hands your club to the AI for a
 * while and gives it back later.
 *
 * It confirms in place before it runs. Not because the sim is fragile, but
 * because this is the one button in the game you cannot take back by clicking
 * something else: several seasons of your club's life happen without you, and
 * the squad you get back is not the one you left. A jump you meant to be three
 * seasons and typed as thirteen is a dynasty you don't recognise.
 *
 * On a spectator save the mechanic is identical and the warning is not: there
 * is no club being handed over and nothing of yours to lose, only years of
 * world history passing at speed. `spectating` swaps the copy for that reading
 * rather than the control, because the button really is doing the same thing.
 */
import { useState } from "react";
import { MAX_JUMP_SEASONS } from "../../core/autopilot.js";
import { seasonYear } from "../format.js";

interface JumpSeasonsFormProps {
  /** The season the league is currently in. */
  season: number;
  disabled?: boolean;
  onJump: (seasons: number) => void;
  /** Nobody manages a club in this save, so nothing is being handed over. */
  spectating?: boolean;
}

/** Rough wall-clock per season, measured on the 320-club world (~10s of matches, ~7s of offseason). */
const SECONDS_PER_SEASON = 18;

function durationHint(seasons: number): string {
  const total = seasons * SECONDS_PER_SEASON;
  if (total < 90) return "about a minute";
  return `roughly ${Math.round(total / 60)} minutes`;
}

export function JumpSeasonsForm({ season, disabled, onJump, spectating }: JumpSeasonsFormProps) {
  const [raw, setRaw] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const text = raw ?? "5";
  const value = text.trim() === "" ? NaN : Number(text);
  const valid = Number.isInteger(value) && value >= 1 && value <= MAX_JUMP_SEASONS;

  if (confirming && valid) {
    return (
      <div>
        <p className="mb-2">
          {spectating ? (
            <>
              The world plays {value} more {value === 1 ? "season" : "seasons"} without stopping.
              Every match, transfer window, cup and offseason, and you pick it back up in{" "}
              {seasonYear(season + value)}.
            </>
          ) : (
            <>
              The AI will run your club for {value} {value === 1 ? "season" : "seasons"} — it picks the
              team, buys and sells, renews contracts and trims the squad, and your club can be bought
              from and relegated like any other. Your lineup, transfer listings and any talks you have
              open are cleared. You take over again in {seasonYear(season + value)}.
            </>
          )}
        </p>
        <p className="text-muted small mb-3">
          This takes {durationHint(value)} to play out and there's no way back to{" "}
          {seasonYear(season)} afterwards, short of a save you exported earlier.
        </p>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-warning"
            disabled={disabled}
            onClick={() => {
              setConfirming(false);
              setRaw(null);
              onJump(value);
            }}
          >
            {spectating ? "Play it out" : "Hand the club over"}
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* No "Jump ahead" label here: the card heading above already says it,
          and repeating it read as a stutter on the Dashboard. */}
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <span>Play</span>
        <input
          type="number"
          className={`form-control ${valid ? "" : "is-invalid"}`}
          style={{ width: "5.5rem" }}
          min={1}
          max={MAX_JUMP_SEASONS}
          step={1}
          value={text}
          disabled={disabled}
          aria-label="Seasons to jump"
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (valid && !disabled) setConfirming(true);
            }
          }}
        />
        <span>{value === 1 ? "season" : "seasons"}</span>
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled || !valid}
          onClick={() => setConfirming(true)}
        >
          Jump
        </button>
      </div>
      <div className={`small mt-1 ${valid ? "text-muted" : "text-danger"}`}>
        {valid
          ? spectating
            ? `The world plays on to ${seasonYear(season + value)} without stopping.`
            : `The AI runs your club until ${seasonYear(season + value)}, then hands it back.`
          : `Pick a number of seasons between 1 and ${MAX_JUMP_SEASONS}.`}
      </div>
    </div>
  );
}
