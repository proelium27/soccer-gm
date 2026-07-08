import type { Composites } from "../engine/composites.js";
import type { Player, Position, SkillKey } from "./players/types.js";
import { heightScore } from "./players/ovr.js";

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

/** Average a set of skills (0..100) over a group of players, returned on 0..1. */
function groupAvg(players: Player[], skills: SkillKey[]): number {
  const vals: number[] = [];
  for (const p of players) for (const s of skills) vals.push(p.ratings[s]);
  return mean(vals) / 100;
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

  const attack = groupAvg(attackers, [
    "finishing", "longShot", "dribbling", "speed", "positioning", "crosses",
  ]);

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

  const defenseBase = groupAvg(defenders, [
    "tackling", "interceptions", "positioning", "strength",
  ]);
  const defenseAerial = mean(defenders.map(aerial));
  const defense = 0.75 * defenseBase + 0.25 * defenseAerial;

  const keeping = gk
    ? 0.85 * (gk.ratings.goalkeeping / 100) + 0.15 * aerial(gk)
    : 0.5;

  const control = groupAvg(outfield, [
    "shortPass", "longPass", "dribbling", "positioning",
  ]);

  return { name: teamName, attack, finishing, defense, keeping, control };
}
