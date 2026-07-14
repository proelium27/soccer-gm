import type { Player, Position } from "../players/types.js";
import { POSITIONS } from "../players/types.js";
import { generatePlayer } from "../players/generate.js";
import { hashInts } from "../../engine/rng.js";
import {
  NUM_TEAMS, NUM_TEAMS_D2, LEAGUE_BASE, TEAM_STRENGTH_SPREAD, DIVISION_2_OFFSET,
  ROSTER_COMPOSITION, INITIAL_AGE_MIN, INITIAL_AGE_MAX,
  CONTRACT_LENGTH_MIN, CONTRACT_LENGTH_MAX,
} from "../constants.js";

const STARTING_SEASON = 1;

export interface LeagueTeam {
  tid: number;
  name: string;
  roster: number[]; // pids
  avgOvr: number;
  /**
   * Fixed generation-time strength base (LEAGUE_BASE + this team's strength
   * target, offset by DIVISION_2_OFFSET for Division 2), carried forward as
   * the permanent anchor for youth intake. Deliberately never derived from
   * the team's *current* roster average — see the long-form comment history
   * in CLAUDE.md's M4 section for why that ratchets OVR upward without bound.
   */
  academyBase: number;
  /** Which division this team belongs to at generation time: 0 = English Division 1, 1 = English Division 2. */
  division: 0 | 1;
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
 * Generate `count` teams' worth of rosters, tid range [tidStart, tidStart+count),
 * evenly-spaced strength targets across [-TEAM_STRENGTH_SPREAD, +TEAM_STRENGTH_SPREAD]
 * minus `strengthOffset`, shuffled (Fisher-Yates) so the strong-to-weak
 * gradient isn't tied to tid/club order within this division, tagged with
 * `division`. Shared by generateLeague (Division 1: tidStart=0, offset=0)
 * and generateTwoDivisionLeague's Division 2 half (tidStart=NUM_TEAMS,
 * offset=DIVISION_2_OFFSET).
 */
function generateDivisionTeams(
  rng: () => number,
  tidStart: number,
  count: number,
  strengthOffset: number,
  division: 0 | 1,
  genSeed: number,
  pidStart: number,
): { teams: LeagueTeam[]; players: Player[]; nextPid: number } {
  const teams: LeagueTeam[] = [];
  const players: Player[] = [];
  let pid = pidStart;

  // Evenly spaced strength targets, then shuffled so the strong-to-weak
  // gradient isn't tied to tid/club order within this division.
  const targets: number[] = [];
  for (let i = 0; i < count; i++) {
    const frac = count > 1 ? i / (count - 1) : 0; // 0..1
    targets.push(TEAM_STRENGTH_SPREAD - frac * (2 * TEAM_STRENGTH_SPREAD) - strengthOffset);
  }
  for (let i = targets.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [targets[i], targets[j]] = [targets[j], targets[i]];
  }

  for (let i = 0; i < count; i++) {
    const tid = tidStart + i;
    const base = LEAGUE_BASE + targets[i];

    const roster: number[] = [];
    let ovrSum = 0;
    for (const pos of POSITIONS as readonly Position[]) {
      for (let j = 0; j < ROSTER_COMPOSITION[pos]; j++) {
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
      division,
    });
  }

  return { teams, players, nextPid: pid };
}

/**
 * Hybrid talent model: each team gets a strength target evenly spaced across
 * [-SPREAD, +SPREAD]; every player is generated around base = LEAGUE_BASE +
 * target, biased by position archetype. Deterministic given the RNG.
 * Produces exactly NUM_TEAMS Division-1 teams — unchanged behavior from
 * before this file supported a second division.
 */
export function generateLeague(rng: () => number, seed = 0): League {
  const genSeed = hashInts(seed, 1);
  const { teams, players } = generateDivisionTeams(rng, 0, NUM_TEAMS, 0, 0, genSeed, 0);
  return { teams, players };
}

/**
 * Generate both divisions in one pass, sharing one rng stream (Division 1
 * first, then Division 2, so a given seed's Division-1 half is byte-for-byte
 * identical to a plain generateLeague call with the same seed). Division 2's
 * strength targets are shifted down by DIVISION_2_OFFSET so its strongest
 * teams land around Division 1's mid-table strength.
 */
export function generateTwoDivisionLeague(rng: () => number, seed = 0): League {
  const genSeed = hashInts(seed, 1);
  const d1 = generateDivisionTeams(rng, 0, NUM_TEAMS, 0, 0, genSeed, 0);
  const d2 = generateDivisionTeams(rng, NUM_TEAMS, NUM_TEAMS_D2, DIVISION_2_OFFSET, 1, genSeed, d1.nextPid);
  return {
    teams: [...d1.teams, ...d2.teams],
    players: [...d1.players, ...d2.players],
  };
}
