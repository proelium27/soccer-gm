import type { Composites } from "../engine/composites.js";
import type { Player, Position, SkillKey } from "./players/types.js";
import { heightScore } from "./players/ovr.js";
import { familiarityPenalty } from "../engine/positionFit.js";
import { COMPOSITE_STAR_CONCENTRATION } from "./constants.js";

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * A player together with the formation slot he's filling. Every composite is
 * bucketed by `slot`, never by the player's own position: the team's shape is
 * set by its formation, not by who happens to be standing in it. Playing a man
 * out of position moves him into that slot's phase and docks his contribution
 * (see familiarityPenalty) rather than quietly re-shaping the team around him.
 */
export interface SlottedPlayer {
  player: Player;
  slot: Position;
}

/** Pair an XI (in formation order) with its slots. */
export function withSlots(xi: Player[], slots: Position[]): SlottedPlayer[] {
  return xi.map((player, i) => ({ player, slot: slots[i] ?? player.pos }));
}

/**
 * A single player's quality on a skill set, 0..1 (average of the raw stats),
 * docked by what it costs him to play this slot. The penalty is in raw rating
 * points, so dividing by 100 puts it on the same scale as the quality itself.
 */
function playerQuality(sp: SlottedPlayer, skills: SkillKey[]): number {
  let s = 0;
  for (const k of skills) s += sp.player.ratings[k];
  const raw = s / skills.length / 100;
  return Math.max(0, raw - familiarityPenalty(sp.slot, sp.player.pos) / 100);
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
  players: SlottedPlayer[],
  skills: SkillKey[],
  weightOf: Partial<Record<Position, number>>,
): number {
  if (players.length === 0) return 0.5;
  let acc = 0;
  let wsum = 0;
  let peak = 0;
  for (const sp of players) {
    const q = playerQuality(sp, skills);
    const w = weightOf[sp.slot] ?? 0.5;
    acc += w * q;
    wsum += w;
    if (q > peak) peak = q;
  }
  const weightedMean = wsum === 0 ? 0.5 : acc / wsum;
  const c = COMPOSITE_STAR_CONCENTRATION;
  return (1 - c) * weightedMean + c * peak;
}

/**
 * Aerial ability per player: jumping + height reach, on 0..1. Deliberately NOT
 * docked for playing out of position — a tall player is tall wherever he
 * stands, and reaching a cross is the one thing that doesn't need positional
 * know-how.
 */
function aerial(p: Player): number {
  return (p.ratings.jumping + heightScore(p.heightCm)) / 200;
}

const inSlot = (xi: SlottedPlayer[], ...slots: Position[]): SlottedPlayer[] =>
  xi.filter((sp) => slots.includes(sp.slot));

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
 *
 * Every grouping and weight keys off the SLOT a player occupies, not his own
 * position. Before this, a centre-back pushed to centre-forward still counted
 * toward `defense` at full strength and contributed nothing to `attack` — so
 * moving a defender up the pitch made your back line *better*. Now he takes the
 * striker's weight in `attack`, carries a familiarity penalty for being there,
 * and leaves the defensive group entirely.
 */
export function rollupComposites(xi: SlottedPlayer[], teamName: string): Composites {
  const keeper = xi.find((sp) => sp.slot === "GK");
  const outfield = xi.filter((sp) => sp.slot !== "GK");
  const attackers = inSlot(xi, "ST", "W", "AM", "CM");
  const defenders = inSlot(xi, "CB", "FB", "DM");

  const attack = starComposite(
    attackers,
    ["finishing", "longShot", "dribbling", "speed", "positioning", "crosses"],
    ATTACK_WEIGHT,
  );

  // finishing: shot-share-weighted finishing/longShot/positioning across outfielders
  let fw = 0;
  let fsum = 0;
  for (const sp of outfield) {
    const share = SHOT_SHARE[sp.slot] ?? 0.3;
    const q = playerQuality(sp, ["finishing", "longShot", "positioning"]);
    fsum += share * q;
    fw += share;
  }
  const finishing = fw === 0 ? 0.5 : fsum / fw;

  const defenseBase = starComposite(
    defenders,
    ["tackling", "interceptions", "positioning", "strength"],
    DEFENSE_WEIGHT,
  );
  const defenseAerial = mean(defenders.map((sp) => aerial(sp.player)));
  const defense = 0.75 * defenseBase + 0.25 * defenseAerial;

  // An outfielder pressed into goal takes the keeper penalty, which is large
  // enough to floor his goalkeeping contribution — as it should be.
  const keeping = keeper
    ? 0.85 * Math.max(0, keeper.player.ratings.goalkeeping / 100 - familiarityPenalty("GK", keeper.player.pos) / 100)
      + 0.15 * aerial(keeper.player)
    : 0.5;

  const control = starComposite(
    outfield,
    ["shortPass", "longPass", "dribbling", "positioning"],
    CONTROL_WEIGHT,
  );

  return { name: teamName, attack, finishing, defense, keeping, control };
}
