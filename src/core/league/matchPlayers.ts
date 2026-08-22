import type { Player, Position } from "../players/types.js";
import type { MatchPlayer } from "../../engine/attribution.js";
import { secondaryPositions } from "../players/positions.js";

/**
 * `slot` is the formation slot this player is filling. Starters get it from
 * their club's shape; bench players carry their own position until they come
 * on, at which point they inherit the slot of the man they replace.
 */
export function toMatchPlayer(p: Player, slot: Position = p.pos): MatchPlayer {
  return {
    pid: p.pid,
    pos: p.pos,
    slot,
    secondary: secondaryPositions(p),
    ovr: p.ovr,
    shooting: (p.ratings.finishing + p.ratings.longShot) / 2,
    dribbling: p.ratings.dribbling,
    tackling: p.ratings.tackling,
    keeping: p.ratings.goalkeeping,
    positioning: p.ratings.positioning,
    heading: p.ratings.jumping,
    stamina: p.ratings.stamina,
    interceptions: p.ratings.interceptions,
    passing: (p.ratings.shortPass + p.ratings.longPass) / 2,
  };
}

/**
 * Convert players to MatchPlayers, optionally flagging those the user wants to
 * give more minutes (StoredTeam.moreMinutes) so the sub logic favors bringing
 * them on. `boostPids` is only ever non-empty for the user's own bench.
 *
 * `slots` aligns with `players` positionally (an XI in formation order); omit it
 * for a bench, whose players each default to their own position.
 */
export function toMatchPlayers(
  players: Player[],
  boostPids?: Set<number>,
  slots?: Position[],
): MatchPlayer[] {
  return players.map((p, i) => {
    const mp = toMatchPlayer(p, slots?.[i] ?? p.pos);
    if (boostPids?.has(p.pid)) mp.minutesBoost = true;
    return mp;
  });
}
