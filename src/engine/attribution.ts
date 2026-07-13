import type { ShotOutcome } from "./matchSim.js";

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
  saves: number;
  tackles: number;
  interceptions: number;
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

export function pickTackler(rng: () => number, players: MatchPlayer[]): MatchPlayer {
  const outfield = players.filter((p) => p.pos !== "GK");
  if (outfield.length === 0) return players[0];
  return weightedPick(rng, outfield, TACKLE_WEIGHTS, "tackling");
}

/**
 * Picks who wins a clean interception. Reuses TACKLE_WEIGHTS' CB/DM/FB-leaning
 * position shape (the same positions that read the game well also tend to
 * make clean interceptions), but keyed to the player's own `interceptions`
 * rating rather than `tackling` — a distinct skill previously unused in match
 * simulation.
 */
export function pickInterceptor(rng: () => number, players: MatchPlayer[]): MatchPlayer {
  const outfield = players.filter((p) => p.pos !== "GK");
  if (outfield.length === 0) return players[0];
  return weightedPick(rng, outfield, TACKLE_WEIGHTS, "interceptions");
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
    pid, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, saves: 0, tackles: 0,
    interceptions: 0, yellowCards: 0, redCards: 0, minutesPlayed: 0, rating: 6.0,
  };
}
