import type { Player, Position } from "../players/types.js";
import { POSITIONS } from "../players/types.js";
import { generatePlayer } from "../players/generate.js";
import { hashInts } from "../../engine/rng.js";
import {
  NUM_TEAMS, LEAGUE_BASE, TEAM_STRENGTH_SPREAD, ROSTER_COMPOSITION,
  INITIAL_AGE_MIN, INITIAL_AGE_MAX, CONTRACT_LENGTH_MIN, CONTRACT_LENGTH_MAX,
} from "../constants.js";

const STARTING_SEASON = 1;

export interface LeagueTeam {
  tid: number;
  name: string;
  roster: number[]; // pids
  avgOvr: number;
  /**
   * Fixed generation-time strength base (LEAGUE_BASE + this team's strength
   * target), carried forward as the permanent anchor for youth intake.
   * Deliberately never derived from the team's *current* roster average —
   * youth intake used to anchor off the live roster average, which let any
   * random upward drift compound every season (new blood generated relative
   * to an already-inflated average, forever), causing unbounded league-wide
   * OVR inflation over a multi-decade dynasty (measured empirically: 90%+ of
   * AI-rostered players at 80+ ovr within ~40 seasons).
   */
  academyBase: number;
  /**
   * User-chosen starting XI (11 pids), or null/undefined to auto-select via
   * selectXI. Not set during generation; simThrough carries it over from
   * StoredTeam.starters so leagueMatchData can respect it.
   */
  starters?: number[] | null;
}

export interface League {
  teams: LeagueTeam[];
  players: Player[];
}

/**
 * Hybrid talent model: teams get strength targets evenly spaced across
 * [-SPREAD, +SPREAD], shuffled randomly across clubs so no club is always
 * strong or always weak; every player is generated around base =
 * LEAGUE_BASE + target, biased by position archetype. Deterministic given
 * the RNG.
 */
export function generateLeague(rng: () => number, seed = 0): League {
  const teams: LeagueTeam[] = [];
  const players: Player[] = [];
  let pid = 0;
  // Caller-supplied seed (not drawn from `rng`) so nationality/name
  // generation varies across different games without perturbing the
  // ratings/potential stream consumed per player (see generatePlayer's
  // `genSeed` param).
  const genSeed = hashInts(seed, 1);

  // Evenly spaced strength targets, then shuffled (Fisher-Yates) so the
  // strong-to-weak gradient isn't tied to tid/club order.
  const targets: number[] = [];
  for (let tid = 0; tid < NUM_TEAMS; tid++) {
    const frac = tid / (NUM_TEAMS - 1); // 0..1
    targets.push(TEAM_STRENGTH_SPREAD - frac * (2 * TEAM_STRENGTH_SPREAD));
  }
  for (let i = targets.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [targets[i], targets[j]] = [targets[j], targets[i]];
  }

  for (let tid = 0; tid < NUM_TEAMS; tid++) {
    const base = LEAGUE_BASE + targets[tid];

    const roster: number[] = [];
    let ovrSum = 0;
    for (const pos of POSITIONS as readonly Position[]) {
      for (let i = 0; i < ROSTER_COMPOSITION[pos]; i++) {
        const age = INITIAL_AGE_MIN
          + Math.floor(rng() * (INITIAL_AGE_MAX - INITIAL_AGE_MIN + 1));
        const p = generatePlayer(rng, pos, base, pid++, age, STARTING_SEASON, genSeed);
        const length = CONTRACT_LENGTH_MIN
          + Math.floor(rng() * (CONTRACT_LENGTH_MAX - CONTRACT_LENGTH_MIN + 1));
        p.contract.expiresSeason = STARTING_SEASON + length;
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
      academyBase: base,
    });
  }

  return { teams, players };
}
