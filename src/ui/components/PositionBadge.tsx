import type { Player, Position } from "../../core/players/types.js";
import { positionLabel, positionRatings, secondaryPositions } from "../../core/players/positions.js";
import { fitTier } from "../../engine/positionFit.js";

/**
 * A player's position as the UI should name it: his listed position, plus any
 * others he genuinely plays, dimmed so the primary still reads first.
 *
 * Every surface that names a position should go through this rather than
 * printing `p.pos`, so a versatile player reads the same everywhere.
 */
export function PositionBadge({ player }: { player: Player }) {
  const secondary = secondaryPositions(player);
  if (secondary.length === 0) return <>{player.pos}</>;
  return (
    <span
      className="position-badge"
      title={`Plays ${positionLabel(player)}. He can fill any of those without the usual out-of-position penalty.`}
    >
      {player.pos}
      {secondary.map((s) => (
        <span key={s} className="position-badge-secondary">
          {s}
        </span>
      ))}
    </span>
  );
}

/**
 * How a player is fitting the slot he's lined up in, or null when he's in his
 * own position and there is nothing to say.
 *
 * Deliberately also reports the GOOD case. A versatile player standing in a
 * slot that isn't his listed position, with no warning on him, otherwise looks
 * like a missed warning; saying "he plays here too" makes the silence
 * meaningful instead of ambiguous.
 */
export function slotFitNote(
  slot: Position,
  p: Player,
): { tone: "ok" | "warn"; text: string } | null {
  if (slot === p.pos) return null;
  const tier = fitTier(slot, p.pos, secondaryPositions(p));
  if (tier === 0) {
    return { tone: "ok", text: `He's a ${p.pos}, but he plays at ${slot} too, so this costs him nothing.` };
  }
  if (slot === "GK" || p.pos === "GK") {
    return { tone: "warn", text: `You're playing a ${p.pos} at ${slot}. That's not a swap anyone gets away with, and it'll show.` };
  }
  if (tier === 1) {
    return { tone: "warn", text: `He's a ${p.pos} playing at ${slot}. He can cover there, but it's not his job and he'll play a little below his rating.` };
  }
  return { tone: "warn", text: `He's a ${p.pos} playing at ${slot}, which is nothing like his position. Expect him well below his rating.` };
}

/**
 * The per-position rating strip for a player profile: what he'd be rated at his
 * own position and at each one he could cover, best first.
 */
export function PositionStrip({ player }: { player: Player }) {
  const rows = positionRatings(player);
  if (rows.length <= 1) return null;
  return (
    <div className="position-strip">
      {rows.map((r) => (
        <div
          key={r.pos}
          className={
            "position-strip-cell" +
            (r.primary ? " position-strip-cell--primary" : "") +
            (r.secondary ? " position-strip-cell--secondary" : "")
          }
          title={
            r.primary
              ? "His listed position. This is the rating everything else uses."
              : r.secondary
                ? "He plays here too, with no out-of-position penalty."
                : "What he'd be rated here. He can cover this spot, but he'd take an out-of-position penalty on top."
          }
        >
          <span className="position-strip-pos">{r.pos}</span>
          <span className="position-strip-ovr">{r.ovr}</span>
        </div>
      ))}
    </div>
  );
}
