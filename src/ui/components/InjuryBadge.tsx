import type { Player } from "../../core/players/types.js";

/**
 * A small red medical-cross badge shown next to an injured player's name.
 * Injured players are automatically sidelined during the sim (they're filtered
 * out of the XI in league/composites.ts), so this is how a manager finds out
 * why a regular is quietly missing matches. Inline SVG, not an emoji, per the
 * UI convention. Renders nothing when the player isn't hurt.
 */
export function InjuryBadge({ player }: { player: Player }) {
  if (!player.injury) return null;
  const { type, gamesRemaining } = player.injury;
  const games = `${gamesRemaining} ${gamesRemaining === 1 ? "match" : "matches"}`;
  return (
    <span
      className="injury-badge"
      title={`Injured: ${type}, out about ${games}. He sits out on his own until he's fit.`}
      aria-label={`Injured: ${type}, out about ${games}`}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M4 0h2v4h4v2H6v4H4V6H0V4h4z" fill="currentColor" />
      </svg>
    </span>
  );
}
