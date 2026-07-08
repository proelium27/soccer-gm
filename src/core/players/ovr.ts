import type { Position, PlayerRatings } from "./types.js";
import { OVR_WEIGHTS, type OvrKey } from "./templates.js";

/** Map height in cm to a 0..100 contribution (160cm -> 0, 200cm -> 100). */
export function heightScore(cm: number): number {
  return Math.max(0, Math.min(100, ((cm - 160) / 40) * 100));
}

/** Weighted per-position overall from ratings + height. Rounded to an integer. */
export function computeOvr(pos: Position, ratings: PlayerRatings, heightCm: number): number {
  const weights = OVR_WEIGHTS[pos];
  let sum = 0;
  for (const key of Object.keys(weights) as OvrKey[]) {
    const w = weights[key]!;
    const value = key === "height" ? heightScore(heightCm) : ratings[key];
    sum += (w / 100) * value;
  }
  return Math.round(sum);
}
