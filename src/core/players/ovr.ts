import type { Position, PlayerRatings } from "./types.js";
import { OVR_WEIGHTS, HEIGHT_RANGES, type OvrKey } from "./templates.js";
import { POSITION_OVR_CALIBRATION, RATING_MIN, RATING_MAX } from "../constants.js";

/** Map height in cm to a 0..100 contribution (160cm -> 0, 200cm -> 100). */
export function heightScore(cm: number): number {
  return Math.max(0, Math.min(100, ((cm - 160) / 40) * 100));
}

/**
 * The height score a position is measured AGAINST — the middle of its own
 * generated range. Height is a deviation term, not a level one: a centre-back
 * is tall by definition, so paying every centre-back for being tall just moves
 * the whole position's OVR up, which is a level effect masquerading as a skill
 * weight. Centring it leaves the part that actually distinguishes players —
 * this centre-back is tall *for a centre-back* — and hands the level question
 * to POSITION_OVR_CALIBRATION, where it is visible and deliberate.
 */
const MEAN_HEIGHT_SCORE: Record<Position, number> = Object.fromEntries(
  (Object.keys(HEIGHT_RANGES) as Position[]).map((pos) => {
    const [lo, hi] = HEIGHT_RANGES[pos];
    return [pos, heightScore((lo + hi) / 2)];
  }),
) as Record<Position, number>;

/**
 * Weighted per-position overall from ratings + height. Rounded to an integer.
 *
 * Three properties, and each one is load-bearing:
 *
 *  - **Skill weights are normalized, not summed.** OVR is the weighted MEAN of
 *    the skills a position's row names, so a row states relative importance and
 *    nothing else. A row that happens to sum to 92 rather than 100 would
 *    otherwise scale that whole position's OVR — including its slope against
 *    team strength, so its players would also spread less between a strong club
 *    and a weak one. (GK's row shipped at 92 for exactly that reason, as a hand
 *    correction for keepers reading high; the calibration below replaces it.)
 *
 *  - **Height is centred** on the position's own range, so it separates tall
 *    players from short ones within a position instead of paying a whole
 *    position for being tall. See MEAN_HEIGHT_SCORE.
 *
 *  - **A uniform rating gain moves every position identically.** A weighted
 *    mean of (ratings + k) is (weighted mean + k) for any row, which is what
 *    keeps cross-position comparisons — secondary positions, position changes,
 *    who fills a slot — a read on a player's SHAPE rather than on his level.
 */
export function computeOvr(pos: Position, ratings: PlayerRatings, heightCm: number): number {
  const weights = OVR_WEIGHTS[pos];
  let skillSum = 0;
  let skillWeight = 0;
  let height = 0;
  for (const key of Object.keys(weights) as OvrKey[]) {
    const w = weights[key]!;
    if (key === "height") {
      height = (w / 100) * (heightScore(heightCm) - MEAN_HEIGHT_SCORE[pos]);
    } else {
      skillSum += w * ratings[key];
      skillWeight += w;
    }
  }
  // Clamped to the rating scale itself. A position carrying a positive
  // calibration would otherwise print above 99 for a player at the ceiling —
  // unreachable in play (a fresh world tops out around 81) but reachable
  // through God Mode and roster imports.
  const ovr = Math.round(skillSum / skillWeight + height + POSITION_OVR_CALIBRATION[pos]);
  return Math.max(RATING_MIN, Math.min(RATING_MAX, ovr));
}
