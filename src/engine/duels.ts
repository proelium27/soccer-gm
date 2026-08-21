import type { MatchPlayer, MatchPosition } from "./attribution.js";
import { CARRIER_WEIGHTS, TACKLE_WEIGHTS } from "./attribution.js";
import { ENERGY_START, FATIGUE_PHYSICAL_WEIGHT } from "./constants.js";

/**
 * Individual duel resolution — the actor-first half of simMatchDetailed.
 *
 * The composite-driven sim decides WHETHER an event happens from two team
 * numbers, then picks a player to pin it on afterwards. That gets the league
 * aggregates right and the individuals wrong: a player never influences an
 * outcome, he only receives credit for one.
 *
 * This module inverts that. Each tick names the two players actually contesting
 * the ball — the carrier and the defender closing him down — and their own
 * attributes shift that tick's probabilities.
 *
 * EVERY term here is a DEVIATION FROM THE PICK-WEIGHTED TEAM MEAN, never an
 * absolute. That is what makes it safe to bolt onto an already-calibrated
 * engine: the player who acts is drawn with probability proportional to his
 * pick weight, and the baseline subtracted from him is the mean of that same
 * weighted distribution, so the deviation has expectation exactly zero.
 * League-wide turnover and scoring rates are preserved by construction and only
 * the DISTRIBUTION of outcomes across individuals moves. It is the same trick
 * SHOOTER_FINISH_WEIGHT already uses for shot conversion, generalized to the
 * two events that actually decide a match.
 *
 * Fatigue enters here per player rather than as a team average, which is what
 * makes an individually knackered defender exploitable. Because the baseline is
 * built from the same energy-scaled values, a uniformly tired side produces no
 * swing at all — only a player tired *relative to his team-mates* is punished,
 * so this does not double-count applyFatigue's team-level term.
 */

/** A player's own energy multiplier, matching applyFatigue's physical shape. */
function fatigueFactor(energy: number): number {
  return 1 - FATIGUE_PHYSICAL_WEIGHT * (ENERGY_START - energy);
}

/**
 * How well the man on the ball keeps it: dribbling to beat the press,
 * positioning to know where the out-ball is. On 0..1.
 */
export function carrierQuality(p: MatchPlayer, energy: number): number {
  return ((p.dribbling + p.positioning) / 2 / 100) * fatigueFactor(energy);
}

/** How well the man closing him down wins it back. On 0..1. */
export function contesterQuality(p: MatchPlayer, energy: number): number {
  return ((p.tackling + p.interceptions + p.positioning) / 3 / 100) * fatigueFactor(energy);
}

export interface DuelActor {
  player: MatchPlayer;
  /**
   * The actor's quality minus the pick-weighted mean of his own group.
   * Mean-zero over the pick distribution by construction — see the module note.
   */
  deviation: number;
}

/**
 * Draw one actor and measure him against his group's pick-weighted mean, in a
 * single pass. Fused deliberately: the selection weights and the baseline
 * weights are the same numbers, so computing them separately would double the
 * per-tick cost of the hottest loop in the sim for nothing.
 *
 * Consumes exactly one rng draw, with selection semantics identical to
 * attribution.ts's weightedPick.
 */
export function drawActor(
  rng: () => number,
  players: MatchPlayer[],
  posWeights: Record<MatchPosition, number>,
  ratingKey: "dribbling" | "tackling",
  quality: (p: MatchPlayer, energy: number) => number,
  energyOf: (p: MatchPlayer) => number,
): DuelActor | null {
  const outfield = players.filter((p) => p.slot !== "GK");
  if (outfield.length === 0) return null;

  const weights: number[] = [];
  const quals: number[] = [];
  let total = 0;
  let weightedSum = 0;
  for (const p of outfield) {
    const w = posWeights[p.slot] * (p[ratingKey] + 10);
    const q = quality(p, energyOf(p));
    weights.push(w);
    quals.push(q);
    total += w;
    weightedSum += w * q;
  }
  const baseline = total === 0 ? 0 : weightedSum / total;

  let r = rng() * total;
  let idx = outfield.length - 1;
  for (let i = 0; i < outfield.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      idx = i;
      break;
    }
  }
  return { player: outfield[idx], deviation: quals[idx] - baseline };
}

/** Draw the man on the ball this tick. */
export function drawCarrier(
  rng: () => number,
  players: MatchPlayer[],
  energyOf: (p: MatchPlayer) => number,
): DuelActor | null {
  return drawActor(rng, players, CARRIER_WEIGHTS, "dribbling", carrierQuality, energyOf);
}

/** Draw the man closing him down. */
export function drawContester(
  rng: () => number,
  players: MatchPlayer[],
  energyOf: (p: MatchPlayer) => number,
): DuelActor | null {
  return drawActor(rng, players, TACKLE_WEIGHTS, "tackling", contesterQuality, energyOf);
}

/**
 * The tick's duel edge, positive when the defender is winning it. Mean-zero.
 * A null actor (an empty side) falls back to 0, i.e. the pure composite result.
 */
export function duelEdge(carrier: DuelActor | null, contester: DuelActor | null): number {
  return (contester?.deviation ?? 0) - (carrier?.deviation ?? 0);
}

/**
 * Which stat the winning defender is credited with. Pure labelling — it never
 * touches an outcome — so it can key off the player's absolute tilt rather than
 * a mean-zero deviation with no calibration risk. A ball-winner reads as
 * tackles, a reader of the game as interceptions.
 */
export function interceptionShare(p: MatchPlayer, base: number): number {
  const tilt = (p.interceptions - p.tackling) / 200;
  return Math.max(0.15, Math.min(0.85, base + tilt));
}
