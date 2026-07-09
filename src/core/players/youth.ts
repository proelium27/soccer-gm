import type { Player, Position } from "./types.js";
import { POSITIONS } from "./types.js";
import { generatePlayer } from "./generate.js";
import {
  YOUTH_AGE, YOUTH_INTAKE_MIN, YOUTH_INTAKE_MAX, YOUTH_BASE_OFFSET,
  YOUTH_CONTRACT_LENGTH,
} from "../constants.js";

/**
 * Generate one club's youth intake for the season: 3-5 raw 16-year-olds,
 * quality anchored to the club's current roster strength (a stand-in for the
 * budget-weighted intake described in the spec, until finances are designed).
 * Assigns fresh pids starting at `nextPid` and returns them alongside the
 * next free pid for the caller to continue from.
 */
export function generateYouthIntake(
  rng: () => number,
  teamAvgOvr: number,
  season: number,
  nextPid: number,
): { players: Player[]; nextPid: number } {
  const count = YOUTH_INTAKE_MIN
    + Math.floor(rng() * (YOUTH_INTAKE_MAX - YOUTH_INTAKE_MIN + 1));
  const base = teamAvgOvr - YOUTH_BASE_OFFSET;

  const players: Player[] = [];
  let pid = nextPid;
  for (let i = 0; i < count; i++) {
    const pos = POSITIONS[Math.floor(rng() * POSITIONS.length)] as Position;
    const p = generatePlayer(rng, pos, base, pid++, YOUTH_AGE, season);
    p.contract.expiresSeason = season + YOUTH_CONTRACT_LENGTH;
    players.push(p);
  }

  return { players, nextPid: pid };
}
