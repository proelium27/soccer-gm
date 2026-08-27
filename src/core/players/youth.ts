import type { Player, Position } from "./types.js";
import { POSITIONS } from "./types.js";
import { generatePlayer } from "./generate.js";
import type { NationalityWeights } from "./nationalities.js";
import {
  YOUTH_AGE, YOUTH_INTAKE_MIN, YOUTH_INTAKE_MAX, YOUTH_BASE_OFFSET,
  YOUTH_CONTRACT_LENGTH, ROSTER_COMPOSITION,
  YOUTH_BASE_FLOOR, YOUTH_BASE_SOFTNESS,
} from "../constants.js";

/**
 * The strength base a club's youth are generated around: its academy anchor
 * dropped by YOUTH_BASE_OFFSET, then eased onto a soft floor so it can never
 * fall far enough below RATING_MIN to clamp a whole intake into rubble. See
 * YOUTH_BASE_FLOOR in constants.ts for the measurements and for why this is a
 * softplus rather than a `Math.max` or a proportional offset.
 *
 * Strictly monotonic in `academyBase` (a weaker academy always yields a weaker
 * base) and identity to within 0.05 once the raw base clears ~20, so clubs that
 * were never underflowing generate exactly what they generated before.
 */
export function youthGenerationBase(academyBase: number): number {
  const raw = academyBase - YOUTH_BASE_OFFSET;
  const x = (raw - YOUTH_BASE_FLOOR) / YOUTH_BASE_SOFTNESS;
  // softplus, guarded: Math.exp overflows past ~709 and the curve is already
  // identity to well under floating-point noise by x = 30.
  if (x > 30) return raw;
  return YOUTH_BASE_FLOOR + YOUTH_BASE_SOFTNESS * Math.log1p(Math.exp(x));
}

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
  nationalities?: NationalityWeights | null,
): { players: Player[]; nextPid: number } {
  const count = YOUTH_INTAKE_MIN
    + Math.floor(rng() * (YOUTH_INTAKE_MAX - YOUTH_INTAKE_MIN + 1));
  const base = youthGenerationBase(academyBase);

  const players: Player[] = [];
  let pid = nextPid;
  for (let i = 0; i < count; i++) {
    const pos = weightedPosition(rng());
    const p = generatePlayer(
      rng, pos, base, pid++, YOUTH_AGE, season, genSeed, homeCountry, nationalities,
    );
    p.contract.expiresSeason = season + YOUTH_CONTRACT_LENGTH;
    players.push(p);
  }

  return { players, nextPid: pid };
}
