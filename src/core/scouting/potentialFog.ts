import {
  SCOUTING_SPEND_MIN, SCOUTING_SPEND_MAX,
  SCOUT_POT_FOG_HALFWIDTH_MAX, SCOUT_POT_FOG_HALFWIDTH_MIN,
  SCOUT_POT_CLEAR_SEASONS_MAX, SCOUT_POT_CLEAR_SEASONS_MIN,
  SCOUT_POT_FOG_SHIFT_FRACTION, RATING_MIN, RATING_MAX,
} from "../constants.js";
import { clamp } from "../util.js";
import { mulberry32, hashInts } from "../../engine/rng.js";

/** A hash salt distinct from every other mulberry32/hashInts call site. */
const FOG_SALT = 0x5c0f;

export interface PotentialFog {
  /** Low end of the shown estimate band (inclusive). */
  low: number;
  /** High end of the shown estimate band (inclusive). */
  high: number;
  /** True once the estimate has collapsed to the exact value (low === high === truth). */
  known: boolean;
}

/**
 * The user's fogged view of a player's true potential — see the
 * "Scouting fog-of-war on potential" block in constants.ts for the model.
 *
 * `observedSeason` is the season the player was first seen on the user's
 * senior roster (StoredTeam.scoutingObserved[pid]); pass `null` for any
 * player who isn't/wasn't on it (prospects, free agents, academy players,
 * rival clubs' players) — they read as tenure 0, i.e. maximum fog for the
 * current scouting spend.
 *
 * Deterministic per (pid, currentSeason): the band's off-center jitter is
 * seeded, so it doesn't flicker on re-render but does wobble year to year.
 * The band always brackets the true potential.
 */
export function potentialFog(
  potential: number,
  pid: number,
  currentSeason: number,
  observedSeason: number | null,
  scoutingSpend: number,
): PotentialFog {
  const spendFrac = clamp(
    (scoutingSpend - SCOUTING_SPEND_MIN) / (SCOUTING_SPEND_MAX - SCOUTING_SPEND_MIN),
    0, 1,
  );
  const halfWidth0 =
    SCOUT_POT_FOG_HALFWIDTH_MAX + spendFrac * (SCOUT_POT_FOG_HALFWIDTH_MIN - SCOUT_POT_FOG_HALFWIDTH_MAX);
  const clearSeasons =
    SCOUT_POT_CLEAR_SEASONS_MAX + spendFrac * (SCOUT_POT_CLEAR_SEASONS_MIN - SCOUT_POT_CLEAR_SEASONS_MAX);

  const tenure = observedSeason === null ? 0 : Math.max(0, currentSeason - observedSeason);
  const tenureFrac = clamp(clearSeasons > 0 ? tenure / clearSeasons : 1, 0, 1);
  const halfWidth = halfWidth0 * (1 - tenureFrac);

  // Fully scouted: the band has collapsed onto the true value.
  if (tenureFrac >= 1 || halfWidth < 0.5) {
    return { low: potential, high: potential, known: true };
  }

  const rng = mulberry32(hashInts(pid, currentSeason, FOG_SALT));
  const shift = (rng() * 2 - 1) * halfWidth * SCOUT_POT_FOG_SHIFT_FRACTION;
  const rawLow = clamp(Math.round(potential - halfWidth + shift), RATING_MIN, RATING_MAX);
  const rawHigh = clamp(Math.round(potential + halfWidth + shift), RATING_MIN, RATING_MAX);

  // Guarantee the band still brackets the true value after rounding/clamping,
  // and never present a zero-width band as an "estimate".
  const low = Math.min(rawLow, potential);
  const high = Math.max(rawHigh, potential);
  if (low === high) {
    return { low, high, known: true };
  }
  return { low, high, known: false };
}

/**
 * Maintain the user's per-player first-observed-season map: keep the existing
 * season for players still on the senior roster, stamp new arrivals with the
 * current season, and drop players who've left (so a re-signing re-fogs). A
 * pure reducer called at league creation and once per offseason for the
 * user's club only.
 */
export function reconcileScoutingObserved(
  prev: Record<number, number>,
  rosterPids: number[],
  season: number,
): Record<number, number> {
  const next: Record<number, number> = {};
  for (const pid of rosterPids) {
    next[pid] = prev[pid] ?? season;
  }
  return next;
}
