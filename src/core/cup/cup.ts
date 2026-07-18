import type { Competition } from "../competitions.js";
import type { StandingsRow } from "../standings.js";
import type { CupState } from "./types.js";
import { CUP_NAME, CUP_ROUNDS, CUP_ROUND_MATCHDAYS, CUP_TEAMS_PER_LEAGUE, CUP_FINAL_ROUND } from "../constants.js";

/** The fixed bracket size the fixed round schedule (CUP_ROUND_MATCHDAYS) supports: 2^rounds = 16. */
export const CUP_BRACKET_SIZE = 2 ** CUP_ROUNDS;

/**
 * Whether this world can field a Continental Cup at all — i.e. its tier-1
 * leagues supply exactly a full 16-team bracket (4 leagues × 4). England-only
 * legacy saves (one tier-1 league) return false. Used by the UI to decide
 * whether to show the qualification zone / cup page for a given world.
 */
export function worldHasCup(competitions: Competition[]): boolean {
  return competitions.filter((c) => c.tier === 1).length * CUP_TEAMS_PER_LEAGUE === CUP_BRACKET_SIZE;
}

/**
 * Standard single-elimination seed ordering for a bracket of `n` slots
 * (n a power of 2): returns the 1-based seed sitting in each bracket position,
 * built so the top seeds only meet in the final (1 vs n in the first round,
 * etc.). For n=16: [1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11].
 */
export function seedOrder(n: number): number[] {
  let pols = [1, 2];
  while (pols.length < n) {
    const length = pols.length * 2 + 1;
    const out: number[] = [];
    for (const p of pols) {
      out.push(p);
      out.push(length - p);
    }
    pols = out;
  }
  return pols;
}

/**
 * The 16 qualifiers, ranked into seeds 1–16: the top CUP_TEAMS_PER_LEAGUE of
 * each tier-1 table qualify, then all clubs are ordered by finishing rank
 * first (every league champion outranks every runner-up, and so on) and by
 * league points within a rank tier — so the strongest champion is the top
 * seed. OVR never enters; qualification and seeding are both purely by the
 * league table, per design.
 */
export function qualifyCupTeams(
  competitions: Competition[],
  tablesByCompId: Map<number, StandingsRow[]>,
): { seededTids: number[]; seedByTid: Record<number, number> } {
  const quals: { tid: number; rank: number; points: number; gd: number; gf: number }[] = [];
  for (const comp of competitions) {
    if (comp.tier !== 1) continue;
    const table = tablesByCompId.get(comp.id) ?? [];
    for (let i = 0; i < CUP_TEAMS_PER_LEAGUE && i < table.length; i++) {
      const row = table[i];
      quals.push({ tid: row.tid, rank: i + 1, points: row.points, gd: row.gd, gf: row.gf });
    }
  }
  quals.sort(
    (a, b) =>
      a.rank - b.rank ||
      b.points - a.points ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.tid - b.tid,
  );
  const seedByTid: Record<number, number> = {};
  quals.forEach((q, i) => (seedByTid[q.tid] = i + 1));
  return { seededTids: quals.map((q) => q.tid), seedByTid };
}

/**
 * Seed the next season's cup from a completed season's per-competition final
 * tables. Returns null when the world can't field a full power-of-2 bracket
 * of tier-1 qualifiers (e.g. a hypothetical league count whose ×4 isn't a
 * power of 2), in which case no cup runs that season.
 */
export function buildCupState(
  competitions: Competition[],
  tablesByCompId: Map<number, StandingsRow[]>,
  season: number,
): CupState | null {
  const tier1Count = competitions.filter((c) => c.tier === 1).length;
  const needed = tier1Count * CUP_TEAMS_PER_LEAGUE;
  // The round schedule (CUP_ROUND_MATCHDAYS) is fixed to a 16-team, 4-round
  // bracket, so the cup only runs when the world fields exactly that many
  // qualifiers (4 tier-1 leagues × 4). England-only legacy saves (1 tier-1
  // league) therefore get no cup, as intended.
  if (needed !== CUP_BRACKET_SIZE) return null;
  const { seededTids, seedByTid } = qualifyCupTeams(competitions, tablesByCompId);
  if (seededTids.length < needed) return null;
  const teams = seedOrder(needed).map((seed) => seededTids[seed - 1]);
  return { season, name: CUP_NAME, teams, seeds: seedByTid, ties: [], championTid: null };
}

/** How many knockout rounds have already been played (a full round is played atomically). */
export function completedRounds(cup: CupState): number {
  return new Set(cup.ties.map((t) => t.round)).size;
}

/** Winners of a completed round, in bracket order (so they pair up cleanly for the next round). */
export function winnersOfRound(cup: CupState, round: number): number[] {
  return cup.ties.filter((t) => t.round === round).map((t) => t.winner);
}

/** The [home, away] pairings for round `r` — bracket order for R16, else the previous round's winners paired up. */
export function matchupsForRound(cup: CupState, round: number): [number, number][] {
  const teams = round === 0 ? cup.teams : winnersOfRound(cup, round - 1);
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < teams.length; i += 2) pairs.push([teams[i], teams[i + 1]]);
  return pairs;
}

export function isCupComplete(cup: CupState): boolean {
  return cup.championTid !== null;
}

/** The two finalists, known once the semi-finals are complete (empty before then). */
export function cupFinalists(cup: CupState): number[] {
  return winnersOfRound(cup, CUP_FINAL_ROUND - 1);
}

/**
 * The knockout round due to be played at `matchday`, or null if none is (cup
 * complete, or the next round's matchday not yet reached). Rounds are strictly
 * ordered, so this is simply "the next unplayed round, once its matchday has
 * arrived."
 */
export function dueCupRound(cup: CupState, matchday: number): number | null {
  if (isCupComplete(cup)) return null;
  const r = completedRounds(cup);
  if (r >= CUP_ROUNDS) return null;
  return matchday >= CUP_ROUND_MATCHDAYS[r] ? r : null;
}

/** Display name for a round index (0 = Round of 16 … CUP_FINAL_ROUND = Final). */
export function cupRoundName(round: number): string {
  const teamsInRound = 2 ** (CUP_ROUNDS - round);
  switch (teamsInRound) {
    case 2: return "Final";
    case 4: return "Semi-finals";
    case 8: return "Quarter-finals";
    default: return `Round of ${teamsInRound}`;
  }
}
