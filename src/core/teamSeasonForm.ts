import type { Composites } from "../engine/composites.js";
import { hashInts, mulberry32 } from "../engine/rng.js";
import { TEAM_SEASON_FORM_PROB, TEAM_SEASON_FORM_DELTA } from "./constants.js";

/** Salt for the historic-season roll (must differ from every other hash salt). */
const TEAM_FORM_SALT = 0x5446_4F52; // "TFOR"

const COMPOSITE_KEYS = ["attack", "finishing", "defense", "keeping", "control"] as const;

/** Same range the composite normalizer clamps to — the engine never sees values outside it. */
const clamp = (x: number): number => Math.max(0.05, Math.min(0.95, x));

/**
 * A club's hidden season-long form swing: +TEAM_SEASON_FORM_DELTA for a dream
 * season, −TEAM_SEASON_FORM_DELTA for a season from hell, 0 (almost always)
 * otherwise. Derived deterministically from (lid, season, tid) — no schema
 * change, identical however the user batches the sim, re-rolled each season.
 * See the constants' doc comment for tuning rationale.
 */
export function teamSeasonFormDelta(lid: number, season: number, tid: number): number {
  const u = mulberry32(hashInts(TEAM_FORM_SALT, lid, season, tid))();
  if (u < TEAM_SEASON_FORM_PROB) return TEAM_SEASON_FORM_DELTA;
  if (u < 2 * TEAM_SEASON_FORM_PROB) return -TEAM_SEASON_FORM_DELTA;
  return 0;
}

/** Apply a season-form delta to every composite, clamped to the engine's expected range. */
export function applySeasonForm(c: Composites, delta: number): Composites {
  if (delta === 0) return c;
  const out: Composites = { ...c };
  for (const key of COMPOSITE_KEYS) out[key] = clamp(out[key] + delta);
  return out;
}
