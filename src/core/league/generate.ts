import type { Player, Position } from "../players/types.js";
import { POSITIONS } from "../players/types.js";
import { generatePlayer } from "../players/generate.js";
import {
  NUM_TEAMS, LEAGUE_BASE, TEAM_STRENGTH_SPREAD, ROSTER_COMPOSITION,
} from "../constants.js";

export interface LeagueTeam {
  tid: number;
  name: string;
  roster: number[]; // pids
  avgOvr: number;
}

export interface League {
  teams: LeagueTeam[];
  players: Player[];
}

/**
 * Hybrid talent model: each team gets a strength target evenly spaced across
 * [-SPREAD, +SPREAD]; every player is generated around base = LEAGUE_BASE +
 * target, biased by position archetype. Deterministic given the RNG.
 */
export function generateLeague(rng: () => number): League {
  const teams: LeagueTeam[] = [];
  const players: Player[] = [];
  let pid = 0;

  for (let tid = 0; tid < NUM_TEAMS; tid++) {
    // Evenly spaced target: strongest at tid 0, weakest at the end.
    const frac = tid / (NUM_TEAMS - 1); // 0..1
    const target = TEAM_STRENGTH_SPREAD - frac * (2 * TEAM_STRENGTH_SPREAD);
    const base = LEAGUE_BASE + target;

    const roster: number[] = [];
    let ovrSum = 0;
    for (const pos of POSITIONS as readonly Position[]) {
      for (let i = 0; i < ROSTER_COMPOSITION[pos]; i++) {
        const p = generatePlayer(rng, pos, base, pid++);
        players.push(p);
        roster.push(p.pid);
        ovrSum += p.ovr;
      }
    }
    teams.push({
      tid,
      name: `Team ${tid + 1}`,
      roster,
      avgOvr: ovrSum / roster.length,
    });
  }

  return { teams, players };
}
