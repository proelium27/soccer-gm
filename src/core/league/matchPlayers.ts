import type { Player } from "../players/types.js";
import type { MatchPlayer } from "../../engine/attribution.js";

export function toMatchPlayer(p: Player): MatchPlayer {
  return {
    pid: p.pid,
    pos: p.pos,
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

export function toMatchPlayers(players: Player[]): MatchPlayer[] {
  return players.map(toMatchPlayer);
}
