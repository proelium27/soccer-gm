import type { Player, Position } from "./types.js";
import { POSITIONS } from "./types.js";
import { generatePlayer } from "./generate.js";
import {
  YOUTH_AGE, YOUTH_INTAKE_MIN, YOUTH_INTAKE_MAX, YOUTH_BASE_OFFSET,
  YOUTH_CONTRACT_LENGTH, ROSTER_COMPOSITION,
} from "../constants.js";

/**
 * Cumulative distribution over positions, weighted by ROSTER_COMPOSITION.
 * A uniform draw overproduced low-slot positions (AM/DM keep only 2 per
 * squad vs 4 for CB/FB/CM): each offseason the surplus — including good ones
 * no club had a free slot for — drained into free agency, so the FA list
 * filled with a wall of the same couple of positions while CB/FB slowly ran
 * short over long dynasties. Weighting intake by how many of each position a
 * roster actually wants keeps the pipeline matched to demand. Precomputed
 * once so the pick below is still a single rng() draw (RNG-stream count
 * unchanged; only the position it maps to moves).
 */
const POSITION_CDF: { pos: Position; cum: number }[] = (() => {
  const total = POSITIONS.reduce((s, p) => s + ROSTER_COMPOSITION[p], 0);
  let running = 0;
  return POSITIONS.map((pos) => {
    running += ROSTER_COMPOSITION[pos] / total;
    return { pos, cum: running };
  });
})();

/** Draw a position weighted by ROSTER_COMPOSITION, consuming one rng() draw. */
function weightedPosition(r: number): Position {
  for (const { pos, cum } of POSITION_CDF) {
    if (r < cum) return pos;
  }
  return POSITION_CDF[POSITION_CDF.length - 1].pos; // fp guard on the last bin
}

/**
 * Generate one club's youth intake for the season: 3-5 raw 16-year-olds,
 * quality anchored to the club's fixed generation-time academy strength (a
 * stand-in for the budget-weighted intake described in the spec, until
 * finances are designed) — NOT the club's current roster average, which
 * would let any random upward drift in the roster compound into every future
 * intake and inflate the league without bound over a long dynasty.
 * Assigns fresh pids starting at `nextPid` and returns them alongside the
 * next free pid for the caller to continue from.
 */
export function generateYouthIntake(
  rng: () => number,
  academyBase: number,
  season: number,
  nextPid: number,
  genSeed = 0,
  homeCountry?: string,
): { players: Player[]; nextPid: number } {
  const count = YOUTH_INTAKE_MIN
    + Math.floor(rng() * (YOUTH_INTAKE_MAX - YOUTH_INTAKE_MIN + 1));
  const base = academyBase - YOUTH_BASE_OFFSET;

  const players: Player[] = [];
  let pid = nextPid;
  for (let i = 0; i < count; i++) {
    const pos = weightedPosition(rng());
    const p = generatePlayer(rng, pos, base, pid++, YOUTH_AGE, season, genSeed, homeCountry);
    p.contract.expiresSeason = season + YOUTH_CONTRACT_LENGTH;
    players.push(p);
  }

  return { players, nextPid: pid };
}
