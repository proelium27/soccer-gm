import type { Player } from "../players/types.js";
import type { MatchPlayer } from "../../engine/attribution.js";

export function toMatchPlayer(p: Player): MatchPlayer {
  return {
    pid: p.pid,
    pos: p.pos,
    ovr: p.ovr,
    shooting: (p.ratings.finishing + p.ratings.longShot) / 2,
    dribbling: p.ratings.dribbling,
    tackling: p.ratings.tackling,
    keeping: p.ratings.goalkeeping,
    positioning: p.ratings.positioning,
    heading: p.ratings.jumping,
    stamina: p.ratings.stamina,
    interceptions: p.ratings.interceptions,
  };
}

/**
 * Convert players to MatchPlayers, optionally flagging those the user wants to
 * give more minutes (StoredTeam.moreMinutes) so the sub logic favors bringing
 * them on. `boostPids` is only ever non-empty for the user's own bench.
 */
export function toMatchPlayers(players: Player[], boostPids?: Set<number>): MatchPlayer[] {
  return players.map((p) => {
    const mp = toMatchPlayer(p);
    if (boostPids?.has(p.pid)) mp.minutesBoost = true;
    return mp;
  });
}
