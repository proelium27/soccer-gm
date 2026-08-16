import type { Player } from "../../core/players/types.js";
import { isSuspended, matchesLabel } from "../../core/suspensions.js";
import { SUSPENSION_YELLOW_THRESHOLD } from "../../core/constants.js";

/**
 * Why a player is missing, in the manager's words. Kept next to the badge so
 * the roster tooltip, the pitch chip and the dashboard list can't drift apart.
 */
export function suspensionText(player: Player): string | null {
  if (!isSuspended(player)) return null;
  const { matchesRemaining, reason } = player.suspension!;
  const cause =
    reason === "yellow cards"
      ? `${SUSPENSION_YELLOW_THRESHOLD} yellow cards`
      : reason === "second yellow"
        ? "a second yellow"
        : "a red card";
  return `Suspended for ${cause}, out of the next ${matchesLabel(matchesRemaining)}`;
}

/**
 * The red card shown beside a banned player's name — the disciplinary twin of
 * InjuryBadge, and there for the same reason: a suspended player is filtered
 * out of the XI during the sim (core/suspensions.ts), so without this a regular
 * just quietly stops appearing. Inline SVG rather than an emoji, per the UI
 * convention. Renders nothing when he's available.
 */
export function SuspensionBadge({ player }: { player: Player }) {
  const text = suspensionText(player);
  if (!text) return null;
  return (
    <span
      className="suspension-badge"
      title={`${text}. He's still eligible for cup ties.`}
      aria-label={text}
    >
      <svg width="8" height="10" viewBox="0 0 8 10" aria-hidden="true">
        <rect x="0" y="0" width="8" height="10" rx="1.5" fill="currentColor" />
      </svg>
    </span>
  );
}
