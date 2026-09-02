import type { PlayerRatings, Position, SkillKey } from "../players/types.js";
import { OVR_WEIGHTS } from "../players/templates.js";
import { computeOvr } from "../players/ovr.js";
import { RATING_MIN, RATING_MAX, SCOUT_PROFILE_TILT } from "../constants.js";

/**
 * What the user has told his scouts to look for in a player, as opposed to
 * where (`scoutingRegions`) or at which position (`scoutingPositions`).
 *
 * Three profiles rather than a longer list, and the three were chosen by
 * checking coverage rather than by picking football words: each has to own at
 * least one OVR-weighted skill at EVERY position, or it would silently do
 * nothing for some of them. "Defensive" (tackling + interceptions) and "end
 * product" (finishing + long shots) both fail that test — a keeper weights
 * neither pair and a striker weights neither — which is why they are absent.
 * The three that survive are also the three genuinely orthogonal to position:
 * a centre-back can be an athlete or a ball player, so asking for one does not
 * just restate a position you already picked.
 */
export type ScoutProfile = "physical" | "technical" | "reading";

/** The skills each profile pushes up. Everything else pays for them. */
export const SCOUT_PROFILE_SKILLS: Record<ScoutProfile, readonly SkillKey[]> = {
  physical: ["speed", "strength", "stamina", "jumping"],
  technical: ["shortPass", "longPass", "dribbling", "crosses"],
  reading: ["positioning", "interceptions"],
};

/** Player-facing name and one-line brief for each profile. */
export const SCOUT_PROFILE_LABELS: Record<ScoutProfile, { name: string; blurb: string }> = {
  physical: { name: "Athletes", blurb: "quick, strong, and they keep running" },
  technical: { name: "Ball players", blurb: "comfortable in possession, good feet" },
  reading: { name: "Readers of the game", blurb: "anticipation and positioning, gets there first" },
};

export const SCOUT_PROFILES: readonly ScoutProfile[] = ["physical", "technical", "reading"];

/** Narrow an untrusted value (an old save, a hand edit) to a real profile. */
export function sanitizeScoutProfile(value: unknown): ScoutProfile | null {
  return typeof value === "string" && (SCOUT_PROFILES as readonly string[]).includes(value)
    ? (value as ScoutProfile)
    : null;
}

const clampRating = (x: number): number =>
  Math.round(Math.max(RATING_MIN, Math.min(RATING_MAX, x)));

/**
 * Tilt a freshly-rolled set of ratings toward a scouting profile, IN PLACE,
 * leaving the player's OVR **exactly** what it was.
 *
 * The idea is one line of arithmetic: OVR is a weighted mean of the skills, so
 * a change of `d` to skill `k` moves it by `w(k) * d / W`. Push the profile's
 * skills up and take the cost back out of the rest in proportion to what OVR
 * pays for them, and the player is a visibly different footballer and
 * identically good. That is `POSITION_OVR_CALIBRATION`'s device applied per
 * player rather than per position, and it is what makes a scouting preference
 * safe to hand the user: a lever that cannot move OVR cannot move wages (cubic
 * in ovr), valuation, team rating, the strength ladder or the solvency column —
 * so it needs no dynasty audit, which is the whole reason it is built this way.
 *
 * Four things carry it, each load-bearing rather than defensive:
 *
 * **(a) Only skills THIS POSITION'S OVR pays for may take part.** `OVR_WEIGHTS`
 * is partial — a striker weights none of tackling, interceptions, goalkeeping,
 * stamina, crosses or long passing. Paying for a boost out of skills the
 * position isn't judged on would be a free OVR rise, i.e. precisely the exploit
 * this function exists not to be.
 *
 * **(b) `height` sits out.** It carries an OVR weight but is not a skill and
 * cannot be tilted; its own delta is zero, so it drops out of the sum and
 * neutrality is unaffected.
 *
 * **(c) The tilt is scaled to the headroom, not clamped into it.** A weak
 * academy rolls ratings that already sit near `RATING_MIN` (a third-division
 * youth base saturates the softplus floor at ~1), so the compensating
 * subtraction would clamp — which breaks the trade in the player's FAVOUR, and
 * would hand exactly the poorest clubs a small free OVR rise for picking a
 * profile. Scaling both sides by the worst-affected skill keeps the trade
 * honest at every academy strength and degrades gracefully: a club with nothing
 * to give gets a smaller tilt rather than a free one.
 *
 * **(d) Ratings are integers, so the books are balanced against OVR itself
 * rather than against the weighted sum.** `clampRating` rounds at generation
 * and in progression, so fractional ratings are not a thing this codebase has;
 * rounding the compensating side then leaves a sub-point residual that the
 * arithmetic alone cannot cancel. Rather than accept "neutral to within
 * rounding", the tilt measures the OVR it actually produced and nudges single
 * paying skills by one point until it matches what it started with. If it
 * cannot get there — no headroom left anywhere — the whole tilt is reverted, so
 * the player is exactly as rolled instead of approximately as rolled.
 */
export function applyProfileTilt(
  ratings: PlayerRatings,
  pos: Position,
  heightCm: number,
  profile: ScoutProfile,
): void {
  const weights = OVR_WEIGHTS[pos];
  const wanted = SCOUT_PROFILE_SKILLS[profile];

  const boosted: SkillKey[] = [];
  const paying: SkillKey[] = [];
  let boostedWeight = 0;
  let payingWeight = 0;

  for (const key of Object.keys(ratings) as SkillKey[]) {
    // `height` never appears here — it is not a skill — so (b) needs no guard.
    const w = weights[key] ?? 0;
    if (w <= 0) continue; // (a): a skill this position isn't judged on sits out.
    if (wanted.includes(key)) {
      boosted.push(key);
      boostedWeight += w;
    } else {
      paying.push(key);
      payingWeight += w;
    }
  }

  // Nothing to boost, or nothing to pay with: leave him exactly as rolled
  // rather than approximately. Unreachable for the shipped profiles, which were
  // chosen so every position weights at least one skill on each side, but a
  // fourth added later could trip it and should degrade to a no-op.
  if (boosted.length === 0 || paying.length === 0) return;

  const before = computeOvr(pos, ratings, heightCm);
  const original = { ...ratings };

  const up = SCOUT_PROFILE_TILT;
  const down = (up * boostedWeight) / payingWeight;

  // (c) How much of the intended move each side can actually absorb.
  let scale = 1;
  for (const key of paying) scale = Math.min(scale, (ratings[key] - RATING_MIN) / down);
  for (const key of boosted) scale = Math.min(scale, (RATING_MAX - ratings[key]) / up);
  if (!(scale > 0)) return; // no headroom at all, or a non-finite rating
  scale = Math.min(1, scale);

  for (const key of boosted) ratings[key] = clampRating(ratings[key] + up * scale);
  for (const key of paying) ratings[key] = clampRating(ratings[key] - down * scale);

  // (d) Settle the rounding against OVR itself. Each pass moves one paying
  // skill by a point in whichever direction closes the gap; the biggest weight
  // with headroom goes first, so it converges in a handful of steps. The bound
  // is a guard against a pathological rating set, not an expected path.
  for (let step = 0; step < 64; step++) {
    const now = computeOvr(pos, ratings, heightCm);
    if (now === before) return;
    const dir = now > before ? -1 : 1;
    const key = paying
      .filter((k) => (dir > 0 ? ratings[k] < RATING_MAX : ratings[k] > RATING_MIN))
      .sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0))[0];
    if (key === undefined) break;
    ratings[key] += dir;
  }

  // Could not land on the original OVR: hand back exactly what was rolled.
  if (computeOvr(pos, ratings, heightCm) !== before) Object.assign(ratings, original);
}
