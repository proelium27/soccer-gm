import type { Player, Position, PlayerRatings, SkillKey } from "./types.js";
import { SKILL_KEYS } from "./types.js";
import { GEN_OFFSETS, HEIGHT_RANGES, type Tier } from "./templates.js";
import { computeOvr } from "./ovr.js";
import { generateName } from "./names.js";
import { rollPotential } from "./progression.js";
import {
  TIER_OFFSET, RATING_NOISE_SD, ABS_LOW_MIN, ABS_LOW_MAX,
  RATING_MIN, RATING_MAX, SALARY_PER_OVR,
} from "../constants.js";

const clampRating = (x: number): number =>
  Math.round(Math.max(RATING_MIN, Math.min(RATING_MAX, x)));

/** Standard-normal sample via Box-Muller from the seeded stream. */
function gaussian(rng: () => number): number {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function rollRating(rng: () => number, tier: Tier, base: number): number {
  if (tier === "ABS") {
    return clampRating(ABS_LOW_MIN + rng() * (ABS_LOW_MAX - ABS_LOW_MIN));
  }
  const offset = TIER_OFFSET[tier];
  return clampRating(base + offset + gaussian(rng) * RATING_NOISE_SD);
}

export function generatePlayer(
  rng: () => number,
  pos: Position,
  base: number,
  pid: number,
  age: number,
  season: number,
): Player {
  const tiers = GEN_OFFSETS[pos];
  const ratings = {} as PlayerRatings;
  for (const key of SKILL_KEYS as readonly SkillKey[]) {
    ratings[key] = rollRating(rng, tiers[key], base);
  }

  const [loH, hiH] = HEIGHT_RANGES[pos];
  const heightCm = Math.round(loH + rng() * (hiH - loH));

  const ovr = computeOvr(pos, ratings, heightCm);
  const potential = rollPotential(rng, ovr, age, pos);
  const born = season - age;

  return {
    pid,
    name: generateName(rng, "Genero"),
    nationality: "Genero",
    born,
    pos,
    heightCm,
    ratings,
    ovr,
    potential,
    // Placeholder contract — length/expiry are a caller concern (initial gen,
    // youth intake, and free agency all set these differently). Finances
    // beyond this salary formula are still TBD.
    contract: { salary: SALARY_PER_OVR * ovr, expiresSeason: 1 },
    injury: null,
    stats: [],
    hist: [],
  };
}
