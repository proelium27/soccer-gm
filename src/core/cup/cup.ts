import type { Competition } from "../competitions.js";
import type { StandingsRow } from "../standings.js";
import type { CupState, CupPlayoff, CupTie } from "./types.js";
import { hashInts } from "../../engine/rng.js";
import {
  CUP_NAME, CUP_ROUNDS, CUP_ROUND_MATCHDAYS,
  CUP_STRONG_LEAGUE_SLOTS, CUP_WEAK_LEAGUE_SLOTS,
  CUP_KO_SIZE, CUP_KO_ROUND_MATCHDAYS, CUP_KO_LEG_MATCHDAYS, CUP_KO_PRIZE_WIN_BY_ROUND, CUP_PRIZE_WIN_BY_ROUND,
  CUP_LP_DIRECT_QF, CUP_LP_PLAYOFF_TEAMS, CUP_PLAYOFF_MATCHDAY,
  countryStrengthOffset,
} from "../constants.js";
import {
  drawLeaguePhase, leaguePhaseTable, splitLeaguePhase, leaguePhaseComplete,
} from "./leaguePhase.js";

/** Legacy straight-bracket size (2^CUP_ROUNDS = 16), used only by pre-Swiss saves. */
export const CUP_BRACKET_SIZE = 2 ** CUP_ROUNDS;

/** Furthest-stage sentinels for clubCupRun on a Swiss cup (KO rounds are 0 = QF … up). */
export const CUP_STAGE_PLAYOFF = -1;
export const CUP_STAGE_LEAGUE_PHASE = -2;

/* ── Format helpers ──────────────────────────────────────────────────────────
 * A cup is "Swiss" (all new saves) when it carries a league phase; otherwise
 * it's a legacy straight bracket kept alive only to finish an old mid-season
 * save. The knockout accessors below return the right schedule/prizes for each. */

export function isSwissCup(cup: CupState): boolean {
  return !!cup.leaguePhase;
}

/** Number of knockout rounds: 3 (QF→Final) for Swiss, 4 (R16→Final) for legacy. */
export function koRoundsOf(cup: CupState): number {
  return isSwissCup(cup) ? CUP_KO_ROUND_MATCHDAYS.length : CUP_ROUNDS;
}

/** League matchdays for each knockout round, by cup format (the last/only leg of each round). */
export function koRoundMatchdays(cup: CupState): readonly number[] {
  return isSwissCup(cup) ? CUP_KO_ROUND_MATCHDAYS : CUP_ROUND_MATCHDAYS;
}

/**
 * The league matchday(s) each knockout round is played on, indexed by round
 * then by leg. A two-legged Swiss cup's QF/SF have two matchdays each (leg 1,
 * leg 2) and its final one; every other cup (single-leg Swiss, legacy) has one
 * matchday per round. Whether a round is two-legged is read off the leg count
 * here, so this table is the single source of truth for the knockout calendar.
 */
export function koLegMatchdays(cup: CupState): readonly (readonly number[])[] {
  if (isSwissCup(cup) && cup.twoLegged) return CUP_KO_LEG_MATCHDAYS;
  return koRoundMatchdays(cup).map((md) => [md]);
}

/** Whether knockout round `r` is played over two legs (only two-legged Swiss QF/SF). */
export function isTwoLeggedRound(cup: CupState, round: number): boolean {
  return koLegMatchdays(cup)[round]?.length === 2;
}

/** Per-win knockout prizes, by cup format. */
export function koPrizeByRound(cup: CupState): readonly number[] {
  return isSwissCup(cup) ? CUP_KO_PRIZE_WIN_BY_ROUND : CUP_PRIZE_WIN_BY_ROUND;
}

/** Round index of the final for this cup (the round the user's sim halts before). */
export function koFinalRound(cup: CupState): number {
  return koRoundsOf(cup) - 1;
}

/* ── Qualification ───────────────────────────────────────────────────────────
 * Strong (big-four) leagues send their top CUP_STRONG_LEAGUE_SLOTS; weak
 * (France/Portugal) leagues send their top CUP_WEAK_LEAGUE_SLOTS. The combined
 * field opens the Swiss league phase. Everything is seeded purely by the league
 * tables — OVR never enters. */

/** The Swiss cup's structural plan for a world, or null if it can't field one. */
export interface CupPlan {
  strong: Competition[];
  weak: Competition[];
  total: number; // league-phase field size
}

/**
 * The Swiss cup plan for a world: which tier-1 leagues are strong/weak and the
 * resulting field size. Valid only when the field can seed the whole structure —
 * enough clubs for the top-4 + eight-team playoff, an even split into the draw's
 * pots, and enough per pot for the games each club plays. England-only legacy
 * worlds (one tier-1 league) and other undersized worlds return null (no cup).
 */
export function cupPlan(competitions: Competition[]): CupPlan | null {
  const tier1 = competitions.filter((c) => c.tier === 1);
  const strong = tier1.filter((c) => countryStrengthOffset(c.country) === 0);
  const weak = tier1.filter((c) => countryStrengthOffset(c.country) > 0);
  const total = strong.length * CUP_STRONG_LEAGUE_SLOTS + weak.length * CUP_WEAK_LEAGUE_SLOTS;
  const minField = CUP_LP_DIRECT_QF + CUP_LP_PLAYOFF_TEAMS; // 12: fill four QF + the playoff
  if (total < minField) return null;
  return { strong, weak, total };
}

/**
 * Whether this world can field a Continental Cup. Used by the UI to decide
 * whether to show the qualification zone / cup page for a given world.
 */
export function worldHasCup(competitions: Competition[]): boolean {
  return cupPlan(competitions) !== null;
}

/** How many league-phase places a tier-1 competition earns: strong leagues 4, weak leagues 2. */
export function cupSlotsForCompetition(comp: Competition): number {
  return countryStrengthOffset(comp.country) > 0 ? CUP_WEAK_LEAGUE_SLOTS : CUP_STRONG_LEAGUE_SLOTS;
}

/**
 * Standard single-elimination seed ordering for a bracket of `n` slots
 * (n a power of 2): returns the 1-based seed sitting in each bracket position,
 * built so the top seeds only meet in the final. For n=8: [1,8,4,5,2,7,3,6].
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
 * The league-phase field in seed order (strongest first), and a tid → compId map
 * for the draw's same-league constraint. Strong leagues contribute their top
 * CUP_STRONG_LEAGUE_SLOTS, weak leagues their top CUP_WEAK_LEAGUE_SLOTS.
 */
export function qualifyCupTeams(
  competitions: Competition[],
  tablesByCompId: Map<number, StandingsRow[]>,
): { field: number[]; compOf: Map<number, number> } {
  const plan = cupPlan(competitions);
  const compOf = new Map<number, number>();
  const collect = (comps: Competition[], slots: number): Qualifier[] => {
    const out: Qualifier[] = [];
    for (const comp of comps) {
      const table = tablesByCompId.get(comp.id) ?? [];
      for (let i = 0; i < slots && i < table.length; i++) {
        const row = table[i];
        compOf.set(row.tid, comp.id);
        out.push({ tid: row.tid, rank: i + 1, points: row.points, gd: row.gd, gf: row.gf });
      }
    }
    return out;
  };
  const strong = plan ? plan.strong : competitions.filter((c) => c.tier === 1 && countryStrengthOffset(c.country) === 0);
  const weak = plan ? plan.weak : competitions.filter((c) => c.tier === 1 && countryStrengthOffset(c.country) > 0);
  const field = [...collect(strong, CUP_STRONG_LEAGUE_SLOTS), ...collect(weak, CUP_WEAK_LEAGUE_SLOTS)]
    .sort(seedSort)
    .map((q) => q.tid);
  return { field, compOf };
}

/**
 * Seed the next season's Swiss cup from a completed season's per-competition
 * final tables: qualify the field, seed it, and draw the league phase. The
 * knockout bracket (CupState.teams, CUP_KO_SIZE slots) stays empty until the
 * league phase and playoff resolve — see seedKnockoutFromLeaguePhase. Returns
 * null when the world can't field a cup (see cupPlan).
 */
export function buildCupState(
  competitions: Competition[],
  tablesByCompId: Map<number, StandingsRow[]>,
  season: number,
): CupState | null {
  const plan = cupPlan(competitions);
  if (!plan) return null;
  const { field, compOf } = qualifyCupTeams(competitions, tablesByCompId);
  if (field.length !== plan.total) return null;

  const seeds: Record<number, number> = {};
  field.forEach((tid, i) => (seeds[tid] = i + 1));
  const matches = drawLeaguePhase(field, compOf, hashInts(season, 0x51533));
  return {
    season,
    name: CUP_NAME,
    teams: new Array<number>(CUP_KO_SIZE).fill(-1),
    seeds,
    leaguePhase: { teams: field, matches },
    playoff: null,
    playIn: null,
    ties: [],
    championTid: null,
    twoLegged: true,
    koLegs: null,
  };
}

/* ── Swiss league phase → knockout seeding ───────────────────────────────────*/

/** Whether the knockout bracket has been seeded from the league phase yet. */
export function knockoutSeeded(cup: CupState): boolean {
  return cup.teams.some((t) => t >= 0) || cup.playoff !== null;
}

/**
 * Once the league phase is complete, split its table and seed the quarter-final
 * bracket: the top CUP_LP_DIRECT_QF take seeds 1..4 directly, and the next
 * CUP_LP_PLAYOFF_TEAMS are paired into the single-leg playoff (5v12, 6v11, …)
 * whose four winners fill seeds 5..8. Bracket order via seedOrder(CUP_KO_SIZE)
 * so the top seeds can only meet late. No-op if not applicable / already seeded.
 */
export function seedKnockoutFromLeaguePhase(cup: CupState): CupState {
  if (!cup.leaguePhase || knockoutSeeded(cup) || !leaguePhaseComplete(cup.leaguePhase)) return cup;
  const table = leaguePhaseTable(cup.leaguePhase, cup.seeds);
  const { directQF, playoff } = splitLeaguePhase(table);

  const order = seedOrder(CUP_KO_SIZE); // seed sitting at each bracket position
  const teams = order.map((seed) => (seed <= CUP_LP_DIRECT_QF ? directQF[seed - 1] : -1));

  // Playoff ties: 5th vs 12th, 6th vs 11th, … Winner of tie i takes KO seed CUP_LP_DIRECT_QF+1+i.
  const playoffTeams: number[] = [];
  const half = playoff.length / 2;
  for (let i = 0; i < half; i++) playoffTeams.push(playoff[i], playoff[playoff.length - 1 - i]);
  const slots: number[] = [];
  for (let s = CUP_LP_DIRECT_QF + 1; s <= CUP_KO_SIZE; s++) slots.push(order.indexOf(s));

  const playoffRound: CupPlayoff = { teams: playoffTeams, slots, matchday: CUP_PLAYOFF_MATCHDAY, ties: [] };
  return { ...cup, teams, playoff: playoffRound };
}

/** Whether the playoff is due to be played at `matchday` (seeded, and not yet played). */
export function playoffDue(cup: CupState, matchday: number): boolean {
  return cup.playoff !== null && cup.playoff.ties.length === 0 && matchday >= cup.playoff.matchday;
}

/** Whether a playoff exists and still needs playing — the quarter-finals must wait for it. */
export function playoffPending(cup: CupState): boolean {
  return cup.playoff !== null && cup.playoff.ties.length === 0;
}

/** Fill the bracket's four playoff slots with the tie winners and record the completed playoff ties. */
export function applyPlayoff(cup: CupState, ties: CupTie[]): CupState {
  if (!cup.playoff) return cup;
  const teams = [...cup.teams];
  cup.playoff.slots.forEach((slot, i) => { if (ties[i]) teams[slot] = ties[i].winner; });
  return { ...cup, teams, playoff: { ...cup.playoff, ties } };
}

/* ── Legacy play-in (pre-Swiss saves only) ───────────────────────────────────*/

/** Whether the legacy preliminary play-in is due at `matchday` (and not already played). */
export function playInDue(cup: CupState, matchday: number): boolean {
  return cup.playIn !== null && cup.playIn.ties.length === 0 && matchday >= cup.playIn.matchday;
}

/** Whether a legacy play-in exists and still needs playing — the round of 16 must wait. */
export function playInPending(cup: CupState): boolean {
  return cup.playIn !== null && cup.playIn.ties.length === 0;
}

/** Fill the legacy bracket's two play-in slots with the tie winners. */
export function applyPlayIn(cup: CupState, ties: CupTie[]): CupState {
  if (!cup.playIn) return cup;
  const teams = [...cup.teams];
  cup.playIn.slots.forEach((slot, i) => { if (ties[i]) teams[slot] = ties[i].winner; });
  return { ...cup, teams, playIn: { ...cup.playIn, ties } };
}

/* ── Knockout (shared by both formats) ───────────────────────────────────────*/

/** How many knockout rounds have already been played (a full round is played atomically). */
export function completedRounds(cup: CupState): number {
  return new Set(cup.ties.map((t) => t.round)).size;
}

/** Winners of a completed round, in bracket order (so they pair up cleanly for the next round). */
export function winnersOfRound(cup: CupState, round: number): number[] {
  return cup.ties.filter((t) => t.round === round).map((t) => t.winner);
}

/** The [home, away] pairings for round `r` — bracket order for the opener, else the previous round's winners paired up. */
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
  return winnersOfRound(cup, koFinalRound(cup) - 1);
}

/** A knockout leg due to be played: which round, which leg (0/1), and whether the round is two-legged. */
export interface DueLeg {
  round: number;
  leg: number; // 0 = first leg (or the only leg of a single-leg round), 1 = second leg
  twoLeg: boolean;
  matchday: number; // the leg's scheduled matchday
}

/**
 * The knockout leg due to be played at `matchday`, or null if none is. For a
 * Swiss cup the knockout can't start until the league phase and playoff have
 * filled the bracket; for a legacy cup, until the play-in has. Within a
 * two-legged round the first leg comes due first; once it's played (its results
 * held in `cup.koLegs`) the second leg comes due on its own later matchday.
 */
export function dueCupLeg(cup: CupState, matchday: number): DueLeg | null {
  if (isCupComplete(cup)) return null;
  if (isSwissCup(cup)) {
    if (!cup.leaguePhase || !leaguePhaseComplete(cup.leaguePhase)) return null;
    if (playoffPending(cup)) return null;
  } else if (playInPending(cup)) {
    return null;
  }
  const round = completedRounds(cup);
  if (round >= koRoundsOf(cup)) return null;
  const legMds = koLegMatchdays(cup)[round];
  const twoLeg = legMds.length === 2;
  // First leg still outstanding? koLegs holds the current round's first legs.
  const leg = twoLeg && cup.koLegs && cup.koLegs.length > 0 ? 1 : 0;
  const md = legMds[leg];
  return matchday >= md ? { round, leg, twoLeg, matchday: md } : null;
}

/**
 * The knockout round due to be played at `matchday`, or null if none is — a
 * thin wrapper over dueCupLeg for callers that only care about the round (the
 * stop-before-final check, UI). See dueCupLeg for the full leg detail.
 */
export function dueCupRound(cup: CupState, matchday: number): number | null {
  return dueCupLeg(cup, matchday)?.round ?? null;
}

/**
 * One club's furthest stage in a single cup and whether it won that stage's tie.
 * For a Swiss cup the stage may be a knockout round (0 = QF …), CUP_STAGE_PLAYOFF
 * (lost the playoff), or CUP_STAGE_LEAGUE_PHASE (didn't reach the playoff). Null
 * if the club didn't take part / no result yet.
 */
export function clubCupRun(cup: CupState, tid: number): { round: number; wonRound: boolean } | null {
  // Furthest knockout tie (shared by both formats).
  let round = -Infinity;
  let wonRound = false;
  for (const tie of cup.ties) {
    if ((tie.home === tid || tie.away === tid) && tie.round > round) {
      round = tie.round;
      wonRound = tie.winner === tid;
    }
  }
  if (round > -Infinity) return { round, wonRound };

  if (isSwissCup(cup)) {
    if (!cup.leaguePhase!.teams.includes(tid)) return null;
    if (cup.playoff && cup.playoff.ties.length > 0) {
      const tie = cup.playoff.ties.find((t) => t.home === tid || t.away === tid);
      if (tie) return { round: CUP_STAGE_PLAYOFF, wonRound: tie.winner === tid };
    }
    return { round: CUP_STAGE_LEAGUE_PHASE, wonRound: false };
  }

  if (!cup.teams.includes(tid)) return null;
  return null; // legacy: qualified but no tie played yet
}

/** Display name for a knockout round index, given the cup's total knockout rounds. */
export function cupRoundName(round: number, koRounds: number = CUP_KO_ROUND_MATCHDAYS.length): string {
  if (round === CUP_STAGE_LEAGUE_PHASE) return "League Phase";
  if (round === CUP_STAGE_PLAYOFF) return "Playoff Round";
  const teamsInRound = 2 ** (koRounds - round);
  switch (teamsInRound) {
    case 2: return "Final";
    case 4: return "Semi-finals";
    case 8: return "Quarter-finals";
    default: return `Round of ${teamsInRound}`;
  }
}

/**
 * A club's cup run in one season summarised for history: a short label
 * ("Winners", "Semi-finals", "Playoff", "League phase", …) plus champion /
 * runner-up flags — all format-aware, so it works for Swiss and legacy cups
 * alike. Null if the club didn't take part.
 */
export function cupRunSummary(
  cup: CupState,
  tid: number,
): { note: string; isChampion: boolean; isRunnerUp: boolean } | null {
  const run = clubCupRun(cup, tid);
  if (!run) return null;
  const finalRound = koFinalRound(cup);
  const isChampion = run.round === finalRound && run.wonRound;
  const isRunnerUp = run.round === finalRound && !run.wonRound;
  const note =
    run.round === CUP_STAGE_LEAGUE_PHASE ? "League phase"
      : run.round === CUP_STAGE_PLAYOFF ? "Playoff"
        : isChampion ? "Winners"
          : isRunnerUp ? "Runners-up"
            : cupRoundName(run.round, koRoundsOf(cup));
  return { note, isChampion, isRunnerUp };
}
