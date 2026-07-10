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
}

export type MatchEventType =
  | "turnover"
  | "shot_blocked"
  | "shot_off_target"
  | "shot_saved"
  | "goal"
  | "yellow_card"
  | "red_card"
  | "substitution";

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
  yellowCards: number;
  redCards: number;
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

/** Picks who commits a foul. Weighted toward tackling, like a tackler, but any outfielder can foul. */
export function pickFouler(rng: () => number, players: MatchPlayer[]): MatchPlayer {
  const outfield = players.filter((p) => p.pos !== "GK");
  if (outfield.length === 0) return players[0];
  return weightedPick(rng, outfield, FOUL_WEIGHTS, "tackling");
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
    yellowCards: 0, redCards: 0,
  };
}
