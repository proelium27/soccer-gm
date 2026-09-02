import { useLeague } from "../context/LeagueContext.js";
import { isWatched } from "../../core/watchlist.js";

interface WatchToggleProps {
  pid: number;
  /** His name, so the button can say who it's about for a screen reader. */
  name?: string;
}

/**
 * The star that puts a player on (or takes him off) the `/watchlist`
 * shortlist. Drop it beside any player anywhere in the game.
 *
 * Inline SVG rather than a glyph, per the no-emoji UI convention — and one
 * `<button>` per row, deliberately, rather than a button wrapped in a styling
 * span: the pages that carry this are the dense ones, and the `/transfers`
 * freeze was an uncapped list of exactly that kind of extra element. Every
 * table it sits in caps its rows, so the cost is bounded.
 */
export function WatchToggle({ pid, name }: WatchToggleProps) {
  const { league, toggleWatchedAction, simming } = useLeague();
  if (!league) return null;
  const watched = isWatched(league, pid);
  const who = name ? ` ${name}` : "";
  const label = watched ? `Remove${who} from your watchlist` : `Add${who} to your watchlist`;
  return (
    <button
      type="button"
      className={`watch-star${watched ? " watched" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={watched}
      disabled={simming}
      onClick={() => toggleWatchedAction(pid)}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M8 1.6l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.4l-3.8 2 .7-4.3-3.1-3 4.3-.6z"
          fill={watched ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
