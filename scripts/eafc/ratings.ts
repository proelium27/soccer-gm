/**
 * EA FC attributes -> soccer-gm PlayerRatings.
 *
 * The two attribute sets line up unusually well (both are 1-99, and 12 of
 * soccer-gm's 14 skills have a near-namesake in EA's list), so this is mostly a
 * rename with two judgment calls:
 *
 *  - `tackling` averages EA's standing and sliding tackle, which soccer-gm
 *    does not separate.
 *  - `positioning` is weighted for *every* soccer-gm position (GK 17, CB 16,
 *    ST 20), so it means general game-reading rather than attacking movement.
 *    EA splits that concept in two — `mentality_positioning` (attacking) and
 *    `defending_marking_awareness` (defensive) — so we blend them on a
 *    per-position weight, and use EA's dedicated `goalkeeping_positioning` for
 *    keepers.
 *
 * Every skill falls back to the relevant EA face stat (pace/shooting/passing/
 * defending/physic) when the detailed column is missing, so the thinner
 * exports still import sensibly.
 */
import type { PlayerRatings, Position } from "../../src/core/players/types.js";
import { SKILL_KEYS } from "../../src/core/players/types.js";
import { computeOvr } from "../../src/core/players/ovr.js";
import { RATING_MIN, RATING_MAX } from "../../src/core/constants.js";
import { num, meanDefined, type ResolvedColumns } from "./schema.js";

/**
 * How much of `positioning` comes from EA's *attacking* positioning rather
 * than its defensive marking/awareness, per soccer-gm position. A striker's
 * positioning is goal-scoring movement; a centre-back's is defensive reading.
 */
const ATTACKING_POSITIONING_WEIGHT: Record<Position, number> = {
  GK: 0, CB: 0, FB: 0.25, DM: 0.3, CM: 0.5, AM: 0.85, W: 0.85, ST: 1,
};

const clampInt = (x: number, lo = RATING_MIN, hi = RATING_MAX) =>
  Math.max(lo, Math.min(hi, Math.round(x)));

/**
 * Build a player's rating *shape* from his EA attributes — correct relative
 * proportions, but still on EA's absolute scale. The caller shifts it to the
 * rescaled target overall (see shiftToOverall).
 *
 * `fallback` supplies a value for any skill the file cannot provide at all
 * (neither a detailed column nor a face stat), so the shape is always complete.
 */
export function ratingShapeFromEa(
  row: Record<string, string>,
  cols: ResolvedColumns,
  pos: Position,
  fallback: number,
): PlayerRatings {
  const g = (field: string) => num(row, cols, field);

  const pace = g("pace");
  const shooting = g("shooting");
  const passing = g("passing");
  const defending = g("defending_face");
  const physic = g("physic");

  const attPos = g("att_positioning");
  const marking = g("marking");
  const w = ATTACKING_POSITIONING_WEIGHT[pos];

  let positioning: number | undefined;
  if (pos === "GK") {
    positioning = g("gk_positioning") ?? meanDefined(g("gk_reflexes"), g("gk_handling"));
  } else if (attPos !== undefined && marking !== undefined) {
    positioning = w * attPos + (1 - w) * marking;
  } else {
    // Only one side available: use it, leaning on the face stat that best
    // stands in for the missing half.
    positioning = attPos ?? marking ?? meanDefined(shooting, defending);
  }

  const raw: Record<string, number | undefined> = {
    speed: meanDefined(g("acceleration"), g("sprint_speed")) ?? pace,
    strength: g("strength") ?? physic,
    stamina: g("stamina") ?? physic,
    jumping: g("jumping") ?? physic,
    shortPass: g("short_passing") ?? passing,
    longPass: g("long_passing") ?? passing,
    crosses: g("crossing") ?? passing,
    dribbling: meanDefined(g("skill_dribbling") ?? g("dribbling_face"), g("ball_control")),
    longShot: g("long_shots") ?? shooting,
    finishing: g("finishing") ?? shooting,
    tackling: meanDefined(g("standing_tackle"), g("sliding_tackle")) ?? defending,
    interceptions: g("interceptions") ?? defending,
    positioning,
    goalkeeping: meanDefined(
      g("gk_diving"), g("gk_handling"), g("gk_reflexes"), g("gk_positioning"),
    ),
  };

  return Object.fromEntries(
    SKILL_KEYS.map((k) => [k, clampInt(raw[k] ?? fallback)]),
  ) as PlayerRatings;
}

/**
 * Rescale a shape's deviations from its own mean by `spread` (1 = keep EA's
 * spikiness as-is). Exposed as a converter flag because EA's within-player
 * spread is a touch wider than soccer-gm's generated players (measured ~15.4
 * stdev across the 14 skills — see scripts/ovrDistProbe.ts), and some people
 * will want imported squads to blend in rather than stand out.
 */
export function applySpread(shape: PlayerRatings, spread: number): PlayerRatings {
  if (spread === 1) return shape;
  const vals = SKILL_KEYS.map((k) => shape[k]);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Object.fromEntries(
    SKILL_KEYS.map((k) => [k, clampInt(mean + spread * (shape[k] - mean))]),
  ) as PlayerRatings;
}

/**
 * Uniformly shift a rating shape until computeOvr lands on `target`.
 *
 * Same technique the game's own roster importer uses (shiftRatingsToOverall in
 * src/core/teams/rosterImport.ts): computeOvr is monotonic non-decreasing under
 * a uniform shift, so a binary search converges. Doing it here — rather than
 * letting the game do it — is what lets the roster file carry real per-skill
 * ratings (preserving that a player is fast rather than strong) while still
 * hitting the rescaled overall exactly. The game recomputes ovr from the
 * emitted `ratings`, so whatever we land on here is what shows up in-game.
 */
export function shiftToOverall(
  shape: PlayerRatings,
  pos: Position,
  heightCm: number,
  target: number,
): PlayerRatings {
  const want = clampInt(target);
  const shifted = (s: number): PlayerRatings =>
    Object.fromEntries(
      SKILL_KEYS.map((k) => [k, clampInt(shape[k] + s)]),
    ) as PlayerRatings;

  let lo = -RATING_MAX;
  let hi = RATING_MAX;
  for (let it = 0; it < 40; it++) {
    const mid = (lo + hi) / 2;
    if (computeOvr(pos, shifted(mid), heightCm) < want) lo = mid;
    else hi = mid;
  }
  return shifted(hi);
}
