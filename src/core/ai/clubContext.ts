import type { Player, Position } from "../players/types.js";
import { POSITIONS } from "../players/types.js";
import type { StoredTeam } from "../teams/clubs.js";
import type { PlayedMatch } from "../standings.js";
import { computeStandings } from "../standings.js";
import { NUM_TEAMS } from "../constants.js";
import {
  AI_SQUAD_STRENGTH_COUNT,
  AI_AMBITION_W_STRENGTH, AI_AMBITION_W_WEALTH, AI_AMBITION_W_FAME, AI_AMBITION_W_FORM,
  AI_AMBITION_HIGH, AI_AMBITION_LOW, AI_YOUNG_SQUAD_AGE,
} from "../constants.js";

/**
 * A human-readable summary of where a club sits strategically. These labels
 * are derived (not stored) from a club's ambition axis, form, and age
 * profile, purely for UI/debugging/tests — the evaluation math keys off the
 * numeric `ambition`/`frugality` scalars, never the label.
 */
export type StrategicDirection =
  | "Title Contender"
  | "Ambitious"
  | "Midtable Stability"
  | "Rebuilding"
  | "Relegation Battle";

/**
 * Everything the evaluation core needs to know about a club to value players
 * for it — all derived from current league state, so it shifts season to
 * season as a club rises, falls, ages, or spends.
 */
export interface ClubContext {
  tid: number;
  season: number;
  budget: number;
  /** Mean ovr of the club's best AI_SQUAD_STRENGTH_COUNT players. */
  squadStrength: number;
  /** Mean age across the whole roster. */
  squadAvgAge: number;
  /** Roster head-count at each position. */
  posDepth: Record<Position, number>;
  /** Best (highest) ovr the club currently has at each position, 0 if none. */
  posBestOvr: Record<Position, number>;
  /**
   * Win-now pressure, [0,1]. High for rich, famous, strong, in-form clubs;
   * low for poor, weak, struggling ones. Tilts value toward prime-age
   * readiness (high) or youth/upside (low).
   */
  ambition: number;
  /**
   * Financial caution, [0,1]. High for cash-poor clubs (steep penalty on
   * expensive deals), ~0 for the wealthiest (can absorb mistakes).
   */
  frugality: number;
  /** Derived flavor label — see StrategicDirection. */
  direction: StrategicDirection;
}

/** Min-max normalize a value into [0,1] against a league range; 0.5 if the range is flat. */
function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  return (value - min) / (max - min);
}

/** Mean of an array, or 0 when empty. */
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** A club's squad strength: mean ovr of its best AI_SQUAD_STRENGTH_COUNT players. */
function squadStrength(roster: Player[]): number {
  const top = [...roster].sort((a, b) => b.ovr - a.ovr).slice(0, AI_SQUAD_STRENGTH_COUNT);
  return mean(top.map((p) => p.ovr));
}

function positionalDepthAndBest(
  roster: Player[],
): { depth: Record<Position, number>; best: Record<Position, number> } {
  const depth = Object.fromEntries(POSITIONS.map((p) => [p, 0])) as Record<Position, number>;
  const best = Object.fromEntries(POSITIONS.map((p) => [p, 0])) as Record<Position, number>;
  for (const p of roster) {
    depth[p.pos]++;
    if (p.ovr > best[p.pos]) best[p.pos] = p.ovr;
  }
  return { depth, best };
}

/**
 * Label a club's strategic direction from its ambition, form (league rank,
 * 1 = top), and squad age. Only used for display/tests.
 */
function label(ambition: number, formNorm: number, squadAvgAge: number): StrategicDirection {
  if (ambition >= AI_AMBITION_HIGH) {
    return formNorm >= 0.7 ? "Title Contender" : "Ambitious";
  }
  if (ambition <= AI_AMBITION_LOW) {
    // A struggling club with a young squad is building; an old one is fighting to survive.
    return squadAvgAge <= AI_YOUNG_SQUAD_AGE ? "Rebuilding" : "Relegation Battle";
  }
  return "Midtable Stability";
}

/**
 * Just the league fields the evaluation core reads. A full LeagueStore
 * satisfies this, but the AI transfer market also passes it a forward-looking
 * `season` (e.g. next season, for offseason valuations) that needn't match
 * any stored season.
 */
export interface LeagueSnapshot {
  teams: StoredTeam[];
  players: Player[];
  season: number;
  played: PlayedMatch[];
}

/**
 * Derive a ClubContext for every team, computing the league-wide
 * normalizations (strength/wealth/fame/form ranges) once so ambition and
 * frugality are genuinely relative to the rest of the league.
 *
 * Form uses the current standings if any matches have been played this
 * season, otherwise a neutral 0.5 for every club (pre-season, no signal).
 */
export function deriveLeagueContexts(league: LeagueSnapshot): Map<number, ClubContext> {
  const playerById = new Map(league.players.map((p) => [p.pid, p]));
  const rosterOf = (t: StoredTeam): Player[] =>
    t.roster.map((pid) => playerById.get(pid)).filter((p): p is Player => p != null);

  // Per-club raw metrics.
  const raw = league.teams.map((t) => {
    const roster = rosterOf(t);
    const { depth, best } = positionalDepthAndBest(roster);
    return {
      tid: t.tid,
      budget: t.budget,
      hype: t.hype,
      strength: squadStrength(roster),
      avgAge: mean(roster.map((p) => league.season - p.born)),
      depth,
      best,
    };
  });

  // Form: rank each club by current standings (1 = top). Neutral before kickoff.
  const hasPlayed = league.played.length > 0;
  const rankByTid = new Map<number, number>();
  if (hasPlayed) {
    const standings = computeStandings(league.teams.map((t) => t.tid), league.played);
    standings.forEach((row, i) => rankByTid.set(row.tid, i + 1));
  }
  // Normalized form: 1 for top of the table, 0 for bottom.
  const formNorm = (tid: number): number =>
    hasPlayed ? normalize(NUM_TEAMS - (rankByTid.get(tid) ?? NUM_TEAMS), 0, NUM_TEAMS - 1) : 0.5;

  // League ranges for min-max normalization.
  const budgets = raw.map((r) => r.budget);
  const hypes = raw.map((r) => r.hype);
  const strengths = raw.map((r) => r.strength);
  const [bMin, bMax] = [Math.min(...budgets), Math.max(...budgets)];
  const [hMin, hMax] = [Math.min(...hypes), Math.max(...hypes)];
  const [sMin, sMax] = [Math.min(...strengths), Math.max(...strengths)];

  const contexts = new Map<number, ClubContext>();
  for (const r of raw) {
    const wealthNorm = normalize(r.budget, bMin, bMax);
    const fameNorm = normalize(r.hype, hMin, hMax);
    const strengthNorm = normalize(r.strength, sMin, sMax);
    const form = formNorm(r.tid);

    const ambition =
      AI_AMBITION_W_STRENGTH * strengthNorm +
      AI_AMBITION_W_WEALTH * wealthNorm +
      AI_AMBITION_W_FAME * fameNorm +
      AI_AMBITION_W_FORM * form;

    // Frugality is the inverse of relative wealth: the poorest club in the
    // league is maximally cautious, the richest barely constrained.
    const frugality = 1 - wealthNorm;

    contexts.set(r.tid, {
      tid: r.tid,
      season: league.season,
      budget: r.budget,
      squadStrength: r.strength,
      squadAvgAge: r.avgAge,
      posDepth: r.depth,
      posBestOvr: r.best,
      ambition,
      frugality,
      direction: label(ambition, form, r.avgAge),
    });
  }
  return contexts;
}
