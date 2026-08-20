import type { Competition } from "../competitions.js";
import type { StandingsRow } from "../standings.js";
import type { CupTie } from "../cup/types.js";
import type { DomesticCupRound, DomesticCupState } from "./types.js";
import { mulberry32, hashInts } from "../../engine/rng.js";
import { countriesOf } from "../competitions.js";
import {
  DOMESTIC_CUP_MATCHDAYS, DOMESTIC_CUP_PRIZE_BY_ROUNDS_FROM_FINAL,
  COUNTRY_CUP_ADJECTIVE,
} from "../constants.js";

/** rng-stream tag for a domestic cup **draw**, kept clear of the tie-playing stream. */
const DRAW_STREAM = 0x0d0c;
/** rng-stream tag for **playing** a domestic cup round. */
export const DOMESTIC_TIE_STREAM = 0x0d0d;

/** Display name for a country's cup: "England" -> "English Cup". */
export function domesticCupName(country: string): string {
  const adj = COUNTRY_CUP_ADJECTIVE[country];
  return adj ? `${adj} Cup` : `${country} Cup`;
}

/**
 * How many knockout rounds a field of `n` needs — ceil(log2(n)). A field that
 * isn't a power of two spends its first round cutting itself down to one (see
 * prelimTieCount), so the count is the same either way.
 */
export function totalRoundsFor(n: number): number {
  return n < 2 ? 0 : Math.ceil(Math.log2(n));
}

/**
 * Ties in the opening round when the field isn't a power of two: enough to cut
 * `n` clubs down to the next power of two below it. 40 clubs -> 8 ties (16 play,
 * 24 sit out). Zero when `n` is already a power of two, in which case the cup
 * opens with a full round instead of a preliminary one.
 */
export function prelimTieCount(n: number): number {
  const rounds = totalRoundsFor(n);
  if (rounds === 0) return 0;
  // An exact power of two opens with a full round, not a preliminary one — and
  // `n - 2 ** (rounds - 1)` alone would call that full round preliminary.
  if (2 ** rounds === n) return 0;
  return n - 2 ** (rounds - 1);
}

/**
 * Rounds still to be won after winning round `round`, counting the final as 0.
 * The prize table is indexed from the final backwards for exactly this reason:
 * a cup that opens with a preliminary round and one that doesn't must pay the
 * same for a semi-final, whatever round index it happens to carry.
 */
export function roundsFromFinal(cup: DomesticCupState, round: number): number {
  return cup.totalRounds - 1 - round;
}

/** Prize for winning a tie in `round`, before the club's financeScale is applied. */
export function domesticPrizeForRound(cup: DomesticCupState, round: number): number {
  const idx = roundsFromFinal(cup, round);
  return DOMESTIC_CUP_PRIZE_BY_ROUNDS_FROM_FINAL[idx] ?? 0;
}

/**
 * Human label for a round: "Final", "Semi-final", "Quarter-final", "Round of
 * 32", or "Preliminary round" for a first round that only part of the field
 * contests. Derived from how far the round is from the final, never from the
 * round index, so it reads correctly whatever the field size.
 */
export function domesticRoundName(cup: DomesticCupState, round: number): string {
  const remaining = cup.totalRounds - round; // 1 = the final
  if (round === 0 && prelimTieCount(cup.teams.length) > 0) return "Preliminary round";
  if (remaining === 1) return "Final";
  if (remaining === 2) return "Semi-final";
  if (remaining === 3) return "Quarter-final";
  return `Round of ${2 ** remaining}`;
}

/* ── The field ───────────────────────────────────────────────────────────── */

interface Entrant {
  tid: number;
  /** Tier of the competition he played in LAST season (3 = no record at all). */
  lastTier: number;
  /** Finishing position in that table, or the tid when there's no record. */
  lastPos: number;
}

/**
 * Every club in `country`, strongest first, ranked purely from last season's
 * final tables — no OVR anywhere, the same rule the Continental Cup qualifies on.
 *
 * Rank is (the tier a club played in last season, its finishing position there).
 * So a relegated club outranks every club that was already in the second tier,
 * and a promoted one sits at the top of the second-tier block rather than being
 * mixed into the first — which is what we want, because the only thing this
 * ordering decides is who has to enter at the preliminary round.
 *
 * With no tables at all (season 1, or a freshly imported world) every club falls
 * into the same "no record" bucket and is ordered by tid, which for a generated
 * world is tier-1 block then tier-2 block — still the right shape.
 */
export function domesticCupField(
  country: string,
  competitions: Competition[],
  teams: { tid: number; compId: number }[],
  tablesByCompId: Map<number, StandingsRow[]>,
): number[] {
  const compIds = new Set(competitions.filter((c) => c.country === country).map((c) => c.id));
  const tierOfComp = new Map(competitions.map((c) => [c.id, c.tier as number]));

  // Where each club finished last season, across every competition in the world
  // (a club can have been in the other tier, and imported/new clubs in none).
  const last = new Map<number, { tier: number; pos: number }>();
  for (const [compId, table] of tablesByCompId) {
    const tier = tierOfComp.get(compId) ?? 3;
    table.forEach((row, i) => last.set(row.tid, { tier, pos: i + 1 }));
  }

  const entrants: Entrant[] = teams
    .filter((t) => compIds.has(t.compId))
    .map((t) => {
      const l = last.get(t.tid);
      return { tid: t.tid, lastTier: l?.tier ?? 3, lastPos: l?.pos ?? t.tid };
    });

  entrants.sort((a, b) => a.lastTier - b.lastTier || a.lastPos - b.lastPos || a.tid - b.tid);
  return entrants.map((e) => e.tid);
}

/* ── Draw ────────────────────────────────────────────────────────────────── */

/**
 * Pair up a set of clubs at random: the open draw. Every survivor goes back in
 * the hat each round and the club drawn first hosts, so there is no seeding, no
 * bracket to publish in advance, and nothing stopping the two best clubs in the
 * country meeting in round one.
 *
 * Runs on a caller-supplied seeded stream, never the shared league rng.
 */
export function drawPairings(
  tids: number[],
  rng: () => number,
): { home: number; away: number }[] {
  const pool = [...tids];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const pairings: { home: number; away: number }[] = [];
  for (let i = 0; i + 1 < pool.length; i += 2) {
    pairings.push({ home: pool[i], away: pool[i + 1] });
  }
  return pairings;
}

/** The draw stream for one round of one country's cup. Deterministic, save-independent. */
function drawRng(season: number, compId: number, round: number): () => number {
  return mulberry32(hashInts(season, compId, round, DRAW_STREAM));
}

/**
 * Build one round: draw `entrants` into ties, with `byes` recorded alongside.
 * `tieCount` caps how many ties are drawn — used only by the preliminary round,
 * where the field is trimmed to a power of two and everyone else waits.
 */
function makeRound(
  season: number,
  compId: number,
  round: number,
  matchday: number,
  entrants: number[],
  tieCount: number,
): DomesticCupRound {
  const playing = entrants.slice(entrants.length - tieCount * 2);
  const byes = entrants.slice(0, entrants.length - tieCount * 2);
  return {
    round,
    matchday,
    pairings: drawPairings(playing, drawRng(season, compId, round)),
    ties: [],
    byes,
  };
}

/**
 * Build one country's cup for `season` and draw its opening round.
 *
 * Only the first round is drawn here — the rest can't be, because the draw is
 * open: round r+1 is drawn from round r's winners as it finishes (see
 * advanceDomesticCup). Returns null when the country can't field a cup (fewer
 * than two clubs, or more rounds than there are matchdays for).
 */
export function buildDomesticCup(
  country: string,
  competitions: Competition[],
  teams: { tid: number; compId: number }[],
  tablesByCompId: Map<number, StandingsRow[]>,
  season: number,
): DomesticCupState | null {
  const field = domesticCupField(country, competitions, teams, tablesByCompId);
  const totalRounds = totalRoundsFor(field.length);
  if (totalRounds === 0 || totalRounds > DOMESTIC_CUP_MATCHDAYS.length) return null;

  // The final always lands on the last matchday in the table, whatever the
  // field size — a smaller cup starts later rather than finishing earlier.
  const matchdays = DOMESTIC_CUP_MATCHDAYS.slice(-totalRounds);
  const tier1 = competitions.find((c) => c.country === country && c.tier === 1);
  const compId = tier1?.id ?? competitions.find((c) => c.country === country)!.id;

  const prelim = prelimTieCount(field.length);
  const firstRoundTies = prelim > 0 ? prelim : field.length / 2;

  return {
    season,
    country,
    name: domesticCupName(country),
    // Strongest first. makeRound draws the TAIL of the list into the round and
    // gives the head byes, so ordering it this way is what puts the lowest
    // finishers into the preliminary round and the best clubs in later.
    teams: field,
    rounds: [makeRound(season, compId, 0, matchdays[0], field, firstRoundTies)],
    totalRounds,
    championTid: null,
    statLines: null,
  };
}

/** Build every country's cup for `season`, skipping any country that can't field one. */
export function buildDomesticCups(
  competitions: Competition[],
  teams: { tid: number; compId: number }[],
  tablesByCompId: Map<number, StandingsRow[]>,
  season: number,
): DomesticCupState[] {
  return countriesOf(competitions)
    .map((country) => buildDomesticCup(country, competitions, teams, tablesByCompId, season))
    .filter((c): c is DomesticCupState => c !== null);
}

/* ── Progress ────────────────────────────────────────────────────────────── */

/** The round currently awaiting play, or null when the cup is finished. */
export function pendingRound(cup: DomesticCupState): DomesticCupRound | null {
  const last = cup.rounds[cup.rounds.length - 1];
  return last && last.ties.length === 0 ? last : null;
}

/** Whether this cup has a round due to be played on `matchday`. */
export function domesticRoundDue(cup: DomesticCupState, matchday: number): boolean {
  const round = pendingRound(cup);
  return round !== null && matchday >= round.matchday;
}

/** Every club still involved in the round awaiting play (both sides of every tie, plus byes). */
export function clubsInPendingRound(cup: DomesticCupState): number[] {
  const round = pendingRound(cup);
  if (!round) return [];
  return [...round.pairings.flatMap((p) => [p.home, p.away]), ...round.byes];
}

/** The two clubs contesting the final, once it has been drawn. Empty otherwise. */
export function domesticFinalists(cup: DomesticCupState): number[] {
  const round = pendingRound(cup);
  if (!round || round.round !== cup.totalRounds - 1) return [];
  return round.pairings.flatMap((p) => [p.home, p.away]);
}

/**
 * Record a played round's ties and set up what follows: draw the next round from
 * the winners plus anyone who had a bye, or — if that was the final — crown the
 * champion.
 */
export function advanceDomesticCup(
  cup: DomesticCupState,
  competitions: Competition[],
  ties: CupTie[],
): DomesticCupState {
  const current = pendingRound(cup);
  if (!current) return cup;

  const played: DomesticCupRound = { ...current, ties };
  const rounds = [...cup.rounds.slice(0, -1), played];
  const winners = [...played.byes, ...ties.map((t) => t.winner)];

  if (played.round === cup.totalRounds - 1) {
    return { ...cup, rounds, championTid: ties[0]?.winner ?? null };
  }

  const matchdays = DOMESTIC_CUP_MATCHDAYS.slice(-cup.totalRounds);
  const nextRound = played.round + 1;
  const tier1 = competitions.find((c) => c.country === cup.country && c.tier === 1);
  const compId = tier1?.id ?? competitions.find((c) => c.country === cup.country)?.id ?? 0;
  return {
    ...cup,
    rounds: [
      ...rounds,
      makeRound(cup.season, compId, nextRound, matchdays[nextRound], winners, winners.length / 2),
    ],
  };
}

/* ── Reading a finished (or in-progress) cup ─────────────────────────────── */

/**
 * How far a club went: the index of the last round it appeared in, or null if
 * it never entered. A bye counts as appearing — a club that sat out the
 * preliminary round and lost the round of 32 went out in the round of 32.
 */
export function clubDomesticRun(cup: DomesticCupState, tid: number): number | null {
  let furthest: number | null = null;
  for (const r of cup.rounds) {
    const involved = r.byes.includes(tid)
      || r.pairings.some((p) => p.home === tid || p.away === tid);
    if (involved) furthest = r.round;
  }
  return furthest;
}

/** A short label for how far a club went ("Winners", "Semi-final", …), or null. */
export function clubDomesticRunLabel(cup: DomesticCupState, tid: number): string | null {
  const run = clubDomesticRun(cup, tid);
  if (run === null) return null;
  if (cup.championTid === tid) return "Winners";
  return domesticRoundName(cup, run);
}
