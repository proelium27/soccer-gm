import type { Position, SkillKey } from "./types.js";

/** Generation-offset tier. "ABS" = drawn from the absolute-low pool. */
export type Tier = "star" | "H" | "M" | "L" | "VL" | "ABS";

/** Table A — generation offsets (center of the roll) per position per skill. */
export const GEN_OFFSETS: Record<Position, Record<SkillKey, Tier>> = {
  GK: { speed: "L", strength: "M", stamina: "L", jumping: "H", shortPass: "M", longPass: "H", crosses: "ABS", dribbling: "ABS", longShot: "ABS", finishing: "ABS", tackling: "ABS", interceptions: "L", positioning: "H", goalkeeping: "star" },
  CB: { speed: "M", strength: "H", stamina: "M", jumping: "H", shortPass: "M", longPass: "M", crosses: "L", dribbling: "L", longShot: "L", finishing: "L", tackling: "star", interceptions: "H", positioning: "H", goalkeeping: "ABS" },
  FB: { speed: "H", strength: "M", stamina: "H", jumping: "L", shortPass: "M", longPass: "M", crosses: "H", dribbling: "M", longShot: "L", finishing: "L", tackling: "H", interceptions: "H", positioning: "M", goalkeeping: "ABS" },
  DM: { speed: "M", strength: "H", stamina: "H", jumping: "M", shortPass: "H", longPass: "H", crosses: "L", dribbling: "M", longShot: "M", finishing: "L", tackling: "H", interceptions: "star", positioning: "H", goalkeeping: "ABS" },
  CM: { speed: "M", strength: "M", stamina: "H", jumping: "M", shortPass: "star", longPass: "H", crosses: "M", dribbling: "H", longShot: "M", finishing: "M", tackling: "M", interceptions: "M", positioning: "H", goalkeeping: "ABS" },
  AM: { speed: "H", strength: "L", stamina: "M", jumping: "L", shortPass: "H", longPass: "H", crosses: "M", dribbling: "star", longShot: "H", finishing: "H", tackling: "L", interceptions: "L", positioning: "H", goalkeeping: "ABS" },
  W:  { speed: "star", strength: "L", stamina: "H", jumping: "L", shortPass: "M", longPass: "L", crosses: "H", dribbling: "star", longShot: "M", finishing: "H", tackling: "L", interceptions: "L", positioning: "M", goalkeeping: "ABS" },
  ST: { speed: "H", strength: "H", stamina: "M", jumping: "H", shortPass: "M", longPass: "L", crosses: "L", dribbling: "M", longShot: "H", finishing: "star", tackling: "VL", interceptions: "L", positioning: "star", goalkeeping: "ABS" },
};

/** Table B — OVR weights (%). Keys may include "height". Each row sums to 100. */
export type OvrKey = SkillKey | "height";
export const OVR_WEIGHTS: Record<Position, Partial<Record<OvrKey, number>>> = {
  GK: { goalkeeping: 48, positioning: 18, jumping: 10, height: 8, longPass: 10, shortPass: 6 },
  CB: { tackling: 20, interceptions: 18, positioning: 16, strength: 14, jumping: 10, height: 6, speed: 6, longPass: 5, shortPass: 5 },
  FB: { speed: 15, tackling: 14, interceptions: 13, stamina: 12, crosses: 12, positioning: 10, shortPass: 8, dribbling: 8, strength: 8 },
  DM: { interceptions: 18, positioning: 16, tackling: 15, shortPass: 15, longPass: 12, stamina: 10, strength: 8, dribbling: 6 },
  CM: { shortPass: 18, longPass: 15, positioning: 14, stamina: 12, dribbling: 12, longShot: 8, interceptions: 8, tackling: 7, finishing: 6 },
  AM: { dribbling: 18, finishing: 15, shortPass: 14, positioning: 14, longShot: 13, longPass: 12, speed: 8, crosses: 6 },
  W:  { speed: 20, dribbling: 18, crosses: 16, finishing: 14, stamina: 10, longShot: 8, shortPass: 8, positioning: 6 },
  ST: { finishing: 26, positioning: 20, longShot: 14, speed: 12, strength: 10, jumping: 8, height: 5, dribbling: 5 },
};

/** Height range [lowCm, highCm] per position. */
export const HEIGHT_RANGES: Record<Position, [number, number]> = {
  GK: [188, 198], CB: [185, 195], FB: [172, 182], DM: [178, 188],
  CM: [175, 185], AM: [170, 180], W: [170, 180], ST: [178, 190],
};
