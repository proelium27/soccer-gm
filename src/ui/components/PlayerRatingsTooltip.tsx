import { useState } from "react";
import type { ReactNode } from "react";
import { SKILL_KEYS } from "../../core/players/types.js";
import type { Player } from "../../core/players/types.js";
import { getRatingColor } from "../utils/ratingColor.js";

const SKILL_LABELS: Record<string, string> = {
  speed: "Speed",
  strength: "Strength",
  stamina: "Stamina",
  jumping: "Jumping",
  shortPass: "Short Pass",
  longPass: "Long Pass",
  crosses: "Crosses",
  dribbling: "Dribbling",
  longShot: "Long Shot",
  finishing: "Finishing",
  tackling: "Tackling",
  interceptions: "Interceptions",
  positioning: "Positioning",
  goalkeeping: "Goalkeeping",
};

/** Wraps player name text; on hover, shows a color-coded breakdown of all attribute ratings. */
export function PlayerRatingsTooltip({ player, children }: { player: Player; children: ReactNode }) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="player-ratings-tooltip-anchor"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="player-ratings-tooltip-panel">
          <div className="player-ratings-tooltip-title">{player.name}</div>
          <div className="player-ratings-tooltip-grid">
            {SKILL_KEYS.map((key) => (
              <div key={key} className="player-ratings-tooltip-row">
                <span className="player-ratings-tooltip-label">{SKILL_LABELS[key]}</span>
                <span
                  className="player-ratings-tooltip-value"
                  style={{ color: getRatingColor(player.ratings[key]) }}
                >
                  {player.ratings[key]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}
