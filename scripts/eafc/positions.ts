/**
 * EA FC position -> soccer-gm Position.
 *
 * EA carries up to 27 slot labels; soccer-gm has 8 roles. The squeeze is
 * lossy in exactly one interesting place: EA's wide midfielders (LM/RM) and
 * wingers (LW/RW) both collapse to `W`, because soccer-gm has no wide-midfield
 * role and `W` (speed 20, dribbling 18, crosses 16) is the closer fit for both
 * than `CM` would be.
 */
import type { Position } from "../../src/core/players/types.js";

const POSITION_MAP: Record<string, Position> = {
  GK: "GK", GOALKEEPER: "GK",

  CB: "CB", LCB: "CB", RCB: "CB", SW: "CB",

  LB: "FB", RB: "FB", LWB: "FB", RWB: "FB",

  CDM: "DM", LDM: "DM", RDM: "DM",

  CM: "CM", LCM: "CM", RCM: "CM",

  CAM: "AM", LAM: "AM", RAM: "AM",

  LM: "W", RM: "W", LW: "W", RW: "W", LF: "W", RF: "W",

  ST: "ST", LS: "ST", RS: "ST", CF: "ST",
};

/**
 * Resolve a row's `player_positions` cell to one soccer-gm position.
 *
 * EA lists positions in preference order ("ST, LW, CF"), so the first
 * recognised entry is the player's primary role. Returns null when nothing in
 * the cell is recognised, so the caller can drop the row and report it rather
 * than silently defaulting everyone to CM.
 */
export function mapPosition(raw: string | undefined): Position | null {
  if (!raw) return null;
  for (const part of raw.split(/[,/|]/)) {
    const key = part.trim().toUpperCase();
    if (key in POSITION_MAP) return POSITION_MAP[key];
  }
  return null;
}
