import type { Competition } from "../competitions.js";
import type { StandingsRow } from "../standings.js";
import type { CupState, CupPlayoff, CupTie } from "./types.js";
import { hashInts } from "../../engine/rng.js";
import type { CupFormat } from "../constants.js";
import {
  CUP_ROUNDS, CUP_ROUND_MATCHDAYS,
  CUP_KO_SIZE, CUP_KO_ROUND_MATCHDAYS, CUP_KO_LEG_MATCHDAYS,
  CUP_LP_DIRECT_QF, CUP_PLAYOFF_MATCHDAY,
  CUP_FORMATS, CONTINENTAL_CUP_FORMAT, CONTINENTAL_ORDER, largestValidCupField,
} from "../constants.js";
import { isWeakLeague } from "../competitions.js";
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

/**
 * The competition format a cup belongs to — its qualification slots, prize
 * money and rng streams. Defaults to the Continental Cup for a save written
 * before the competitions were split (migrate stamps those, but a cup that
 * reaches here unstamped must not blow up).
 */
export function cupFormat(cup: CupState): CupFormat {
  return CUP_FORMATS[cup.competition] ?? CONTINENTAL_CUP_FORMAT;
}

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

/** Per-win knockout prizes, by cup format and competition. */
export function koPrizeByRound(cup: CupState): readonly number[] {
  const { prizes } = cupFormat(cup);
  return isSwissCup(cup) ? prizes.koByRound : prizes.legacyKoByRound;
}

/** Round index of the final for this cup (the round the user's sim halts before). */
export function koFinalRound(cup: CupState): number {
  return koRoundsOf(cup) - 1;
}

/* ── Qualification ───────────────────────────────────────────────────────────
 * Strong (big-four) leagues send `format.strongSlots` clubs; weak
 * (every league with a countryStrengthOffset — France, the Netherlands,
 * Portugal, Belgium, Turkey, Greece, Scotland, Serbia) send `format.weakSlots`.
 * Each
 * competition starts `format.rankOffset` places down its leagues' final tables,
 * which is what keeps the fields disjoint — the Continental Cup takes from the
 * top, the Shield takes the places directly below it. The combined field opens
 * the Swiss league phase. Everything is seeded purely by the league tables —
 * OVR never enters. */

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
 *
 * A world can field one competition and not another (a two-league world has
 * enough clubs for the Continental Cup's field but not for the Shield's), so
 * this is asked per format rather than once for the world.
 */
export function cupPlan(
  competitions: Competition[],
  format: CupFormat = CONTINENTAL_CUP_FORMAT,
): CupPlan | null {
  const tier1 = competitions.filter((c) => c.tier === 1);
  const strong = tier1.filter((c) => !isWeakLeague(c));
  const weak = tier1.filter((c) => isWeakLeague(c));
  // Summed per league rather than counted by class, because a league can carry
  // its own slot count (Competition.continentalSlots) that differs from the
  // strong/weak default its class would give it.
  const qualified = tier1.reduce((n, c) => n + cupSlotsForCompetition(c, format), 0);
  // Trim to a size the league-phase draw can actually build (see
  // isValidCupFieldSize). The shipped world lands exactly on one — 24 for the
  // Cup, 16 for the Shield — so this changes nothing there; a world whose
  // leagues send an awkward total now gets the largest valid field rather than
  // crashing the offseason on the draw.
  const total = largestValidCupField(qualified);
  if (total === 0) return null;
  return { strong, weak, total };
}

/**
 * Whether this world can field the given competition. Used by the UI to decide
 * whether to show the qualification zone / competition page for a given world.
 */
export function worldHasCup(
  competitions: Competition[],
  format: CupFormat = CONTINENTAL_CUP_FORMAT,
): boolean {
  return cupPlan(competitions, format) !== null;
}

/** How many league-phase places a tier-1 competition earns in this competition. */
export function cupSlotsForCompetition(
  comp: Competition,
  format: CupFormat = CONTINENTAL_CUP_FORMAT,
): number {
  const own = comp.continentalSlots?.[format.id];
  if (own !== undefined) return Math.max(0, Math.floor(own));
  return isWeakLeague(comp) ? format.weakSlots : format.strongSlots;
}

/** How many places down this competition starts in a given league's table (0 = the champion). */
export function cupOffsetForCompetition(
  comp: Competition,
  format: CupFormat = CONTINENTAL_CUP_FORMAT,
): number {
  // Sum what every competition above this one takes from THIS league, so the
  // fields butt up against each other exactly and no club can fall into two of
  // them (or into neither). See CONTINENTAL_ORDER.
  let offset = 0;
  for (const id of CONTINENTAL_ORDER) {
    if (id === format.id) break;
    offset += cupSlotsForCompetition(comp, CUP_FORMATS[id]);
  }
  return offset;
}

/**
 * The finishing positions a tier-1 league's clubs qualify from, as 1-based
 * ranks: `[first, last]` inclusive. The Continental Cup's strong-league range
 * is [1, 4], the Shield's [5, 6]. Used by the Standings qualification shading.
 */
export function cupSlotRange(
  comp: Competition,
  format: CupFormat = CONTINENTAL_CUP_FORMAT,
): [number, number] {
  const from = cupOffsetForCompetition(comp, format);
  return [from + 1, from + cupSlotsForCompetition(comp, format)];
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
 * for the draw's same-league constraint. Strong leagues contribute
 * `format.strongSlots` clubs and weak leagues `format.weakSlots`, both starting
 * `format.rankOffset` places down the table.
 */
export function qualifyCupTeams(
  competitions: Competition[],
  tablesByCompId: Map<number, StandingsRow[]>,
  format: CupFormat = CONTINENTAL_CUP_FORMAT,
): { field: number[]; compOf: Map<number, number> } {
  const plan = cupPlan(competitions, format);
  const compOf = new Map<number, number>();
  const collect = (comps: Competition[]): Qualifier[] => {
    const out: Qualifier[] = [];
    for (const comp of comps) {
      const table = tablesByCompId.get(comp.id) ?? [];
      const slots = cupSlotsForCompetition(comp, format);
      const from = cupOffsetForCompetition(comp, format);
      for (let i = from; i < from + slots && i < table.length; i++) {
        const row = table[i];
        compOf.set(row.tid, comp.id);
        out.push({ tid: row.tid, rank: i + 1, points: row.points, gd: row.gd, gf: row.gf });
      }
    }
    return out;
  };
  const strong = plan ? plan.strong : competitions.filter((c) => c.tier === 1 && !isWeakLeague(c));
  const weak = plan ? plan.weak : competitions.filter((c) => c.tier === 1 && isWeakLeague(c));
  const field = [...collect(strong), ...collect(weak)]
    .sort(seedSort)
    .map((q) => q.tid)
    // Trimmed AFTER seeding, so what gets dropped is the weakest qualifiers in
    // the world rather than whichever league happened to be collected last.
    .slice(0, plan ? plan.total : undefined);
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
  format: CupFormat = CONTINENTAL_CUP_FORMAT,
): CupState | null {
  const plan = cupPlan(competitions, format);
  if (!plan) return null;
  const { field, compOf } = qualifyCupTeams(competitions, tablesByCompId, format);
  if (field.length !== plan.total) return null;

  const seeds: Record<number, number> = {};
  field.forEach((tid, i) => (seeds[tid] = i + 1));
  const matches = drawLeaguePhase(field, compOf, hashInts(season, format.drawSeed));
  return {
    competition: format.id,
    season,
    name: format.name,
    teams: new Array<number>(CUP_KO_SIZE).fill(-1),
    seeds,
    leaguePhase: { teams: field, matches },
    playoff: null,
    playIn: null,
    ties: [],
    championTid: null,
    twoLegged: true,
    koLegs: null,
    // Live cup: stats are summed from box scores until it is archived.
    statLines: null,
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

/**
 * How far each club got, as **rounds from the final**: 0 = won it, 1 = lost the
 * final, 2 = out in the semis, 3 = out in the quarters, and every other
 * participant one step worse again (never reached the knockout at all).
 *
 * Deliberately measured backwards from the final rather than by raw round
 * index, because the round numbering isn't the same across formats — a Swiss
 * cup's knockout opens at the quarter-finals (round 0 = QF), a legacy bracket's
 * at the round of 16. Counting down from the final means "out in the semis" is
 * the same number in both.
 */
export function cupRoundsFromFinal(cup: CupState): Map<number, number> {
  const finalRound = koFinalRound(cup);
  const out = new Map<number, number>();
  const participants = cup.leaguePhase ? cup.leaguePhase.teams : cup.teams;
  for (const tid of participants) if (tid >= 0) out.set(tid, finalRound + 2);
  for (const tie of cup.ties) {
    for (const tid of [tie.home, tie.away]) {
      const reached = finalRound - tie.round + (tid === tie.winner ? 0 : 1);
      const best = out.get(tid);
      if (best === undefined || reached < best) out.set(tid, reached);
    }
  }
  return out;
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
