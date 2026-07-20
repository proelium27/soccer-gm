import type { Competition } from "../competitions.js";
import type { StandingsRow } from "../standings.js";
import type { CupState, CupPlayIn, CupTie } from "./types.js";
import {
  CUP_NAME, CUP_ROUNDS, CUP_ROUND_MATCHDAYS, CUP_FINAL_ROUND,
  CUP_STRONG_LEAGUE_SLOTS, CUP_WEAK_LEAGUE_SLOTS, CUP_PLAYIN_MATCHDAY,
  countryStrengthOffset,
} from "../constants.js";

/** The fixed bracket size the fixed round schedule (CUP_ROUND_MATCHDAYS) supports: 2^rounds = 16. */
export const CUP_BRACKET_SIZE = 2 ** CUP_ROUNDS;

/** How many cup slots a tier-1 league gets: the big four send 4, weaker leagues (France/Portugal) send only their champion. */
export function cupSlotsFor(comp: Competition): number {
  return countryStrengthOffset(comp.country) > 0 ? CUP_WEAK_LEAGUE_SLOTS : CUP_STRONG_LEAGUE_SLOTS;
}

/**
 * The structural plan for a world's cup, or null if it can't field one: the
 * tier-1 leagues split into "strong" (4 slots) and "weak" (1 slot), the total
 * qualifier count, and how many of the 16 bracket places are decided by a
 * preliminary play-in (total − 16). The play-in needs 2 participants per place,
 * drawn from the weak champions plus the weakest strong qualifiers, so a valid
 * world needs enough strong qualifiers to fill the 14 = 16 − playInTies byes
 * and enough play-in slots for every weak champion.
 */
export interface CupPlan {
  strong: Competition[];
  weak: Competition[];
  total: number;
  playInTies: number; // bracket places decided by the play-in (0 = no play-in)
}

export function cupPlan(competitions: Competition[]): CupPlan | null {
  const tier1 = competitions.filter((c) => c.tier === 1);
  const strong = tier1.filter((c) => countryStrengthOffset(c.country) === 0);
  const weak = tier1.filter((c) => countryStrengthOffset(c.country) > 0);
  const total = strong.length * CUP_STRONG_LEAGUE_SLOTS + weak.length * CUP_WEAK_LEAGUE_SLOTS;
  const playInTies = total - CUP_BRACKET_SIZE;
  const playInParticipants = 2 * playInTies;
  const validPlayIn =
    playInTies >= 0 &&
    playInParticipants <= total &&
    CUP_BRACKET_SIZE - playInTies >= 0 && // enough byes
    weak.length <= playInParticipants; // every weak champion fits in the play-in
  if (total < CUP_BRACKET_SIZE || !validPlayIn) return null;
  return { strong, weak, total, playInTies };
}

/**
 * Whether this world can field a Continental Cup — its tier-1 leagues supply a
 * workable 16-team bracket (possibly via a play-in). England-only legacy saves
 * (one tier-1 league) return false. Used by the UI to decide whether to show
 * the qualification zone / cup page for a given world.
 */
export function worldHasCup(competitions: Competition[]): boolean {
  return cupPlan(competitions) !== null;
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

interface Qualifier { tid: number; rank: number; points: number; gd: number; gf: number; }

/** Seed order: finishing rank first (every champion outranks every runner-up), then points, GD, GF, tid. */
function seedSort(a: Qualifier, b: Qualifier): number {
  return a.rank - b.rank || b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.tid - b.tid;
}

/**
 * The strong-league qualifiers (top-4 of each big-four table) in seed order,
 * and the weak-league champions in strength order. OVR never enters —
 * qualification and seeding are purely by the league table, per design. When a
 * world has no weak leagues the second array is empty and the first is the full
 * bracket (the pre-weak-league behaviour).
 */
export function qualifyCupTeams(
  competitions: Competition[],
  tablesByCompId: Map<number, StandingsRow[]>,
): { strongSeeded: number[]; weakChampions: number[] } {
  const plan = cupPlan(competitions);
  const collect = (comps: Competition[], slots: number): number[] => {
    const out: Qualifier[] = [];
    for (const comp of comps) {
      const table = tablesByCompId.get(comp.id) ?? [];
      for (let i = 0; i < slots && i < table.length; i++) {
        const row = table[i];
        out.push({ tid: row.tid, rank: i + 1, points: row.points, gd: row.gd, gf: row.gf });
      }
    }
    return out.sort(seedSort).map((q) => q.tid);
  };
  const strong = plan ? plan.strong : competitions.filter((c) => c.tier === 1);
  const weak = plan ? plan.weak : [];
  return {
    strongSeeded: collect(strong, CUP_STRONG_LEAGUE_SLOTS),
    weakChampions: collect(weak, CUP_WEAK_LEAGUE_SLOTS),
  };
}

/**
 * Seed the next season's cup from a completed season's per-competition final
 * tables. Returns null when the world can't field a bracket (see cupPlan) —
 * e.g. England-only legacy saves — in which case no cup runs that season.
 *
 * With weak leagues in play the 14 strongest big-four qualifiers take byes
 * straight into the round of 16; the last two bracket places (-1 in `teams`
 * until then) are decided by a preliminary play-in between the two weak-league
 * champions and the two weakest big-four qualifiers.
 */
export function buildCupState(
  competitions: Competition[],
  tablesByCompId: Map<number, StandingsRow[]>,
  season: number,
): CupState | null {
  const plan = cupPlan(competitions);
  if (!plan) return null;
  const { strongSeeded, weakChampions } = qualifyCupTeams(competitions, tablesByCompId);
  if (strongSeeded.length + weakChampions.length < plan.total) return null;

  const seedByTid: Record<number, number> = {};
  const order = seedOrder(CUP_BRACKET_SIZE); // the seed sitting at each bracket position

  if (plan.playInTies === 0) {
    // No weak leagues: a straight 16-team bracket from the strong qualifiers.
    const seeded = strongSeeded.slice(0, CUP_BRACKET_SIZE);
    seeded.forEach((tid, i) => (seedByTid[tid] = i + 1));
    const teams = order.map((seed) => seeded[seed - 1]);
    return { season, name: CUP_NAME, teams, seeds: seedByTid, playIn: null, ties: [], championTid: null };
  }

  const byesCount = CUP_BRACKET_SIZE - plan.playInTies; // 14
  const byes = strongSeeded.slice(0, byesCount);
  const playInStrong = strongSeeded.slice(byesCount); // the weakest strong qualifiers (2)
  byes.forEach((tid, i) => (seedByTid[tid] = i + 1)); // seeds 1..14
  playInStrong.forEach((tid, i) => (seedByTid[tid] = byesCount + 1 + i)); // 15, 16
  weakChampions.forEach((tid, i) => (seedByTid[tid] = byesCount + 1 + playInStrong.length + i)); // 17, 18

  // Byes take their bracket positions; the top two seeds' would-be opponents
  // (bracket seeds 15, 16) are -1 until the play-in resolves.
  const teams = order.map((seed) => (seed <= byesCount ? byes[seed - 1] : -1));
  const slots: number[] = [];
  for (let s = byesCount + 1; s <= CUP_BRACKET_SIZE; s++) slots.push(order.indexOf(s));

  // Each play-in tie: a weakest-strong qualifier vs a weak-league champion; its
  // winner fills bracket slot slots[i]. The stronger play-in team feeds the
  // higher bracket seed.
  const playInTeams: number[] = [];
  for (let i = 0; i < plan.playInTies; i++) playInTeams.push(playInStrong[i], weakChampions[i]);

  const playIn: CupPlayIn = { teams: playInTeams, slots, matchday: CUP_PLAYIN_MATCHDAY, ties: [] };
  return { season, name: CUP_NAME, teams, seeds: seedByTid, playIn, ties: [], championTid: null };
}

/** Whether the preliminary play-in is due to be played at `matchday` (and not already played). */
export function playInDue(cup: CupState, matchday: number): boolean {
  return cup.playIn !== null && cup.playIn.ties.length === 0 && matchday >= cup.playIn.matchday;
}

/** Whether a play-in exists and still needs playing — the round of 16 must wait until it fills the bracket. */
export function playInPending(cup: CupState): boolean {
  return cup.playIn !== null && cup.playIn.ties.length === 0;
}

/** Fill the bracket's two play-in slots with the tie winners and record the completed play-in ties. */
export function applyPlayIn(cup: CupState, ties: CupTie[]): CupState {
  if (!cup.playIn) return cup;
  const teams = [...cup.teams];
  cup.playIn.slots.forEach((slot, i) => { if (ties[i]) teams[slot] = ties[i].winner; });
  return { ...cup, teams, playIn: { ...cup.playIn, ties } };
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
  // The round of 16 can't start until the play-in has filled the last two
  // bracket places, so hold everything while the play-in is still pending.
  if (playInPending(cup)) return null;
  const r = completedRounds(cup);
  if (r >= CUP_ROUNDS) return null;
  return matchday >= CUP_ROUND_MATCHDAYS[r] ? r : null;
}

/**
 * One club's run in a single cup: the furthest round it appeared in and whether
 * it won that round's tie (so a caller can distinguish champion / runner-up /
 * eliminated-at-round). Null if the club didn't qualify for this cup.
 */
export function clubCupRun(cup: CupState, tid: number): { round: number; wonRound: boolean } | null {
  if (!cup.teams.includes(tid)) return null;
  let round = -1;
  let wonRound = false;
  for (const tie of cup.ties) {
    if ((tie.home === tid || tie.away === tid) && tie.round > round) {
      round = tie.round;
      wonRound = tie.winner === tid;
    }
  }
  if (round < 0) return null; // qualified but no tie played yet (in-progress cup)
  return { round, wonRound };
}

/** Display name for a round index (-1 = Play-in, 0 = Round of 16 … CUP_FINAL_ROUND = Final). */
export function cupRoundName(round: number): string {
  if (round < 0) return "Play-in Round";
  const teamsInRound = 2 ** (CUP_ROUNDS - round);
  switch (teamsInRound) {
    case 2: return "Final";
    case 4: return "Semi-finals";
    case 8: return "Quarter-finals";
    default: return `Round of ${teamsInRound}`;
  }
}
