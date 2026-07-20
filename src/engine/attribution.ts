import type { ShotOutcome } from "./matchSim.js";
import { mulberry32 } from "./rng.js";
import {
  PASSES_PER_TICK,
  PASS_ATTEMPT_NOISE,
  PASS_COMPLETION_BASE,
  PASS_COMPLETION_CONTROL_K,
  CROSSES_PER_TICK,
  CROSS_NOISE,
} from "./constants.js";

export type MatchPosition =
  | "GK" | "CB" | "FB" | "DM" | "CM" | "AM" | "W" | "ST";

export interface MatchPlayer {
  pid: number;
  pos: MatchPosition;
  shooting: number;
  dribbling: number;
  tackling: number;
  keeping: number;
  positioning: number;
  heading: number;
  stamina: number;
  interceptions: number;
}

export type MatchEventType =
  | "turnover"
  | "shot_blocked"
  | "shot_off_target"
  | "shot_saved"
  | "goal"
  | "yellow_card"
  | "red_card"
  | "substitution"
  | "corner"
  | "penalty"
  | "injury";

export interface MatchEvent {
  clock: number;
  type: MatchEventType;
  side: "home" | "away";
  pids: number[];
}

export interface PlayerMatchLine {
  pid: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  /** Sum of pre-roll goal probability across this player's shots (incl. penalties); see engine/matchSim.ts's resolveShot. */
  xg: number;
  /** Goalkeepers only: the team's full-match goals conceded (0 for every other position). */
  goalsAgainst: number;
  /** Goalkeepers only: the opposing side's full-match attacking xG total, i.e. this keeper's "expected goals against." */
  xga: number;
  saves: number;
  tackles: number;
  interceptions: number;
  /** Passes attempted. Decorative (see attributeTouchStats) — never affects the scoreline. */
  passes: number;
  /** Passes completed; passesCompleted <= passes. */
  passesCompleted: number;
  /** Crosses attempted. */
  crosses: number;
  /** Fouls committed (every FOUL_BASE tick, whether or not it drew a card). */
  foulsCommitted: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  /** FotMob-style 1-10 match performance rating; see engine/matchRating.ts. */
  rating: number;
}

export interface BoxScore {
  home: PlayerMatchLine[];
  away: PlayerMatchLine[];
  events: MatchEvent[];
}

const SHOT_WEIGHTS: Record<MatchPosition, number> = {
  ST: 2.5, W: 2, AM: 1.5, CM: 1, DM: 0.5, FB: 0.3, CB: 0.2, GK: 0,
};

const ASSIST_WEIGHTS: Record<MatchPosition, number> = {
  AM: 3, W: 2.5, CM: 2, ST: 1.5, DM: 1, FB: 1, CB: 0.3, GK: 0.1,
};

const TACKLE_WEIGHTS: Record<MatchPosition, number> = {
  CB: 3, DM: 2.5, FB: 2, CM: 1.5, AM: 0.5, W: 0.5, ST: 0.2, GK: 0.1,
};

const FOUL_WEIGHTS: Record<MatchPosition, number> = {
  CB: 2.5, DM: 2.5, FB: 2, CM: 1.5, AM: 0.7, W: 0.5, ST: 0.5, GK: 0.1,
};

const HEADER_WEIGHTS: Record<MatchPosition, number> = {
  ST: 2.5, CB: 2, W: 1, AM: 1, CM: 0.8, DM: 0.7, FB: 0.5, GK: 0,
};

const CARRIER_WEIGHTS: Record<MatchPosition, number> = {
  AM: 2, W: 2, CM: 1.5, ST: 1.5, DM: 1, FB: 1, CB: 0.7, GK: 0.2,
};

function weightedPick(
  rng: () => number,
  players: MatchPlayer[],
  posWeights: Record<MatchPosition, number>,
  ratingKey: keyof MatchPlayer,
): MatchPlayer {
  let total = 0;
  const weights: number[] = [];
  for (const p of players) {
    const w = posWeights[p.pos] * ((p[ratingKey] as number) + 10);
    weights.push(w);
    total += w;
  }
  let r = rng() * total;
  for (let i = 0; i < players.length; i++) {
    r -= weights[i];
    if (r <= 0) return players[i];
  }
  return players[players.length - 1];
}

export function pickShooter(rng: () => number, players: MatchPlayer[]): MatchPlayer {
  const outfield = players.filter((p) => p.pos !== "GK");
  if (outfield.length === 0) return players[0];
  return weightedPick(rng, outfield, SHOT_WEIGHTS, "shooting");
}

export function pickAssister(
  rng: () => number,
  players: MatchPlayer[],
  shooterPid: number,
): MatchPlayer | null {
  const candidates = players.filter((p) => p.pos !== "GK" && p.pid !== shooterPid);
  if (candidates.length === 0) return null;
  if (rng() < 0.25) return null;
  return weightedPick(rng, candidates, ASSIST_WEIGHTS, "dribbling");
}

/**
 * Shared by pickTackler/pickInterceptor: both use TACKLE_WEIGHTS' CB/DM/FB-leaning
 * position shape (the same positions that read the game well also tend to win
 * clean interceptions), differing only in which rating drives the pick.
 */
function pickDefensiveAction(
  rng: () => number,
  players: MatchPlayer[],
  ratingKey: "tackling" | "interceptions",
): MatchPlayer {
  const outfield = players.filter((p) => p.pos !== "GK");
  if (outfield.length === 0) return players[0];
  return weightedPick(rng, outfield, TACKLE_WEIGHTS, ratingKey);
}

export function pickTackler(rng: () => number, players: MatchPlayer[]): MatchPlayer {
  return pickDefensiveAction(rng, players, "tackling");
}

/** Picks who wins a clean interception, keyed to the player's own `interceptions` rating. */
export function pickInterceptor(rng: () => number, players: MatchPlayer[]): MatchPlayer {
  return pickDefensiveAction(rng, players, "interceptions");
}

/** Picks who commits a foul. Weighted toward tackling, like a tackler, but any outfielder can foul. */
export function pickFouler(rng: () => number, players: MatchPlayer[]): MatchPlayer {
  const outfield = players.filter((p) => p.pos !== "GK");
  if (outfield.length === 0) return players[0];
  return weightedPick(rng, outfield, FOUL_WEIGHTS, "tackling");
}

/** Picks who gets on the end of a corner. Weighted toward heading, favoring CBs/STs at set pieces. */
export function pickHeader(rng: () => number, players: MatchPlayer[]): MatchPlayer {
  const outfield = players.filter((p) => p.pos !== "GK");
  if (outfield.length === 0) return players[0];
  return weightedPick(rng, outfield, HEADER_WEIGHTS, "heading");
}

/** Picks who was carrying the ball when tackled, weighted toward ball-playing positions. */
export function pickCarrier(rng: () => number, players: MatchPlayer[]): MatchPlayer {
  const outfield = players.filter((p) => p.pos !== "GK");
  if (outfield.length === 0) return players[0];
  return weightedPick(rng, outfield, CARRIER_WEIGHTS, "dribbling");
}

export function eventTypeFromShot(outcome: ShotOutcome): MatchEventType {
  switch (outcome) {
    case "blocked": return "shot_blocked";
    case "off_target": return "shot_off_target";
    case "saved": return "shot_saved";
    case "goal": return "goal";
  }
}

export function emptyLine(pid: number): PlayerMatchLine {
  return {
    pid, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, xg: 0, goalsAgainst: 0, xga: 0, saves: 0, tackles: 0,
    interceptions: 0, passes: 0, passesCompleted: 0, crosses: 0, foulsCommitted: 0,
    yellowCards: 0, redCards: 0, minutesPlayed: 0, rating: 6.0,
  };
}

// --- Decorative touch attribution (passes / crosses) -----------------------
// Passes and crosses aren't modeled by the composite tick loop, so they're
// synthesized after the match from possession volume on a SEPARATE rng stream
// (see attributeTouchStats' seed in matchSim.ts) — they can never shift the
// scoreline or any stat the main stream drives. Fouls, by contrast, are real
// events: matchSim credits foulsCommitted directly off the existing pickFouler.

const clampNum = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

/** Per-position share of a team's passes (centre/deep positions circulate the ball most). */
const PASS_POS_WEIGHT: Record<MatchPosition, number> = {
  GK: 0.6, CB: 1.5, FB: 1.3, DM: 1.5, CM: 1.4, AM: 1.1, W: 0.95, ST: 0.75,
};

/** Per-position share of a team's crosses (wide players dominate). */
const CROSS_POS_WEIGHT: Record<MatchPosition, number> = {
  GK: 0, CB: 0.1, FB: 3, DM: 0.3, CM: 0.6, AM: 1.2, W: 4, ST: 0.5,
};

export interface TouchSidePlayer {
  pid: number;
  pos: MatchPosition;
  minutes: number;
}

export interface TouchSide {
  players: TouchSidePlayer[];
  /** This side's possession ticks (proxy for time on the ball). */
  ticks: number;
  /** Team control composite (0..1, 0.5 = league avg); drives pass completion. */
  control: number;
}

/**
 * Distribute an integer `total` across `weights` proportionally, using the
 * largest-remainder method so the parts always sum to exactly `total`.
 * Deterministic (index tie-break); no rng.
 */
function distributeInt(total: number, weights: number[]): number[] {
  const n = weights.length;
  const out = new Array<number>(n).fill(0);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return out;
  const quota = weights.map((w) => (w / sum) * total);
  const floors = quota.map((q) => Math.floor(q));
  const remainder = total - floors.reduce((a, b) => a + b, 0);
  const order = quota
    .map((q, i) => ({ i, frac: q - Math.floor(q) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < remainder; k++) floors[order[k].i]++;
  return floors;
}

function attributeSide(rng: () => number, lines: Map<number, PlayerMatchLine>, side: TouchSide): void {
  const players = side.players;
  if (players.length === 0 || side.ticks <= 0) return;
  const minShare = (m: number): number => Math.max(1, m) / 90;

  // Passes: team total from possession volume (± noise), split by position × minutes.
  const passNoise = 1 + PASS_ATTEMPT_NOISE * (rng() * 2 - 1);
  const teamPasses = Math.max(0, Math.round(side.ticks * PASSES_PER_TICK * passNoise));
  const passWeights = players.map((p) => PASS_POS_WEIGHT[p.pos] * minShare(p.minutes));
  const perPasses = distributeInt(teamPasses, passWeights);
  const compRate = clampNum(
    PASS_COMPLETION_BASE + PASS_COMPLETION_CONTROL_K * (side.control - 0.5),
    0.7,
    0.92,
  );
  for (let i = 0; i < players.length; i++) {
    const line = lines.get(players[i].pid);
    if (!line) continue;
    const att = perPasses[i];
    const rate = clampNum(compRate + (rng() * 2 - 1) * 0.05, 0.6, 0.98);
    line.passes += att;
    line.passesCompleted += Math.min(att, Math.round(att * rate));
  }

  // Crosses: team total from possession volume (± noise), split toward wide players.
  const crossNoise = 1 + CROSS_NOISE * (rng() * 2 - 1);
  const teamCrosses = Math.max(0, Math.round(side.ticks * CROSSES_PER_TICK * crossNoise));
  const crossWeights = players.map((p) => CROSS_POS_WEIGHT[p.pos] * minShare(p.minutes));
  const perCrosses = distributeInt(teamCrosses, crossWeights);
  for (let i = 0; i < players.length; i++) {
    const line = lines.get(players[i].pid);
    if (line) line.crosses += perCrosses[i];
  }
}

/**
 * Fill in passes/crosses for both sides on a completed match's box-score lines,
 * using a caller-supplied seed for its own rng stream. Never reads the match's
 * main rng, so scorelines and every other stat stay bit-identical.
 */
export function attributeTouchStats(
  lines: Map<number, PlayerMatchLine>,
  home: TouchSide,
  away: TouchSide,
  seed: number,
): void {
  const rng = mulberry32(seed);
  attributeSide(rng, lines, home);
  attributeSide(rng, lines, away);
}
