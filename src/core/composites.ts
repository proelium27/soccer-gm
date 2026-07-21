import type { Composites } from "../engine/composites.js";
import type { Player, Position, SkillKey } from "./players/types.js";
import { heightScore } from "./players/ovr.js";
import { COMPOSITE_STAR_CONCENTRATION } from "./constants.js";

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

/** A single player's quality on a skill set, 0..1 (average of the raw stats). */
function playerQuality(p: Player, skills: SkillKey[]): number {
  let s = 0;
  for (const k of skills) s += p.ratings[k];
  return s / skills.length / 100;
}

/**
 * Position-weighted average of a per-player quality, then blended toward the
 * group's single best player by COMPOSITE_STAR_CONCENTRATION. The weights say
 * who drives the phase (a striker moves `attack` more than a midfielder); the
 * peak blend lets an elite individual resist being averaged down by weaker
 * teammates, so a standout in the right position genuinely carries a thin
 * group rather than washing out to the mean. Pure — reads only attributes, no
 * rng, so it never perturbs the seeded stream.
 */
function starComposite(
  players: Player[],
  skills: SkillKey[],
  weightOf: Partial<Record<Position, number>>,
): number {
  if (players.length === 0) return 0.5;
  let acc = 0;
  let wsum = 0;
  let peak = 0;
  for (const p of players) {
    const q = playerQuality(p, skills);
    const w = weightOf[p.pos] ?? 0.5;
    acc += w * q;
    wsum += w;
    if (q > peak) peak = q;
  }
  const weightedMean = wsum === 0 ? 0.5 : acc / wsum;
  const c = COMPOSITE_STAR_CONCENTRATION;
  return (1 - c) * weightedMean + c * peak;
}

/** Aerial ability per player: jumping + height reach, on 0..1. */
function aerial(p: Player): number {
  return (p.ratings.jumping + heightScore(p.heightCm)) / 200;
}

const inPos = (xi: Player[], ...pos: Position[]): Player[] =>
  xi.filter((p) => pos.includes(p.pos));

/** Weighted expected shot share by position (ST > W > AM > others). */
const SHOT_SHARE: Partial<Record<Position, number>> = {
  ST: 4, W: 2.5, AM: 2, CM: 1, FB: 0.5, DM: 0.5, CB: 0.3,
};

/** Who drives chance creation (`attack`): strikers most, wingers, then AM/CM. */
const ATTACK_WEIGHT: Partial<Record<Position, number>> = {
  ST: 4, W: 2.5, AM: 2, CM: 1,
};

/** Who drives possession (`control`): central midfield most, then AM/wide, striker least. */
const CONTROL_WEIGHT: Partial<Record<Position, number>> = {
  CM: 3, DM: 2.5, AM: 2, W: 1, FB: 1, CB: 1, ST: 0.5,
};

/** Who drives defending (`defense`): centre-backs most, then DM, then full-backs. */
const DEFENSE_WEIGHT: Partial<Record<Position, number>> = {
  CB: 3, DM: 2, FB: 1.5,
};

/**
 * Roll the on-pitch 11 up into the engine's five RAW (unnormalized) composites,
 * per SOCCER_GM_SPEC.md §4 mapped onto the 15-stat set. Values are ~0..1;
 * league normalization rescales them so the average XI hits 0.5.
 */
export function rollupComposites(xi: Player[], teamName: string): Composites {
  const gk = xi.find((p) => p.pos === "GK");
  const outfield = xi.filter((p) => p.pos !== "GK");
  const attackers = inPos(xi, "ST", "W", "AM", "CM");
  const defenders = inPos(xi, "CB", "FB", "DM");

  const attack = starComposite(
    attackers,
    ["finishing", "longShot", "dribbling", "speed", "positioning", "crosses"],
    ATTACK_WEIGHT,
  );

  // finishing: shot-share-weighted finishing/longShot/positioning across outfielders
  let fw = 0;
  let fsum = 0;
  for (const p of outfield) {
    const share = SHOT_SHARE[p.pos] ?? 0.3;
    const q = (p.ratings.finishing + p.ratings.longShot + p.ratings.positioning) / 3 / 100;
    fsum += share * q;
    fw += share;
  }
  const finishing = fw === 0 ? 0.5 : fsum / fw;

  const defenseBase = starComposite(
    defenders,
    ["tackling", "interceptions", "positioning", "strength"],
    DEFENSE_WEIGHT,
  );
  const defenseAerial = mean(defenders.map(aerial));
  const defense = 0.75 * defenseBase + 0.25 * defenseAerial;

  const keeping = gk
    ? 0.85 * (gk.ratings.goalkeeping / 100) + 0.15 * aerial(gk)
    : 0.5;

  const control = starComposite(
    outfield,
    ["shortPass", "longPass", "dribbling", "positioning"],
    CONTROL_WEIGHT,
  );

  return { name: teamName, attack, finishing, defense, keeping, control };
}
