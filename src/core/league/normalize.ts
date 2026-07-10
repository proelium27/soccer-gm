import type { Composites } from "../../engine/composites.js";
import { NORMALIZE_K } from "../constants.js";

const COMPOSITE_KEYS = ["attack", "finishing", "defense", "keeping", "control"] as const;
type CompositeKey = (typeof COMPOSITE_KEYS)[number];

export type NormStats = Record<CompositeKey, { mean: number; sd: number }>;

const clamp = (x: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, x));

/** Per-composite league mean/σ, anchored to the supplied (starting-XI) composites. */
export function computeNormStats(raw: Composites[]): NormStats {
  const stats: NormStats = {} as never;
  for (const key of COMPOSITE_KEYS) {
    const vals = raw.map((c) => c[key]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    stats[key] = { mean, sd: Math.sqrt(variance) };
  }
  return stats;
}

/** Normalize one team's raw composites against precomputed league stats. */
export function normalizeWith(
  stats: NormStats,
  c: Composites,
  k: number = NORMALIZE_K,
): Composites {
  const out: Composites = { ...c };
  for (const key of COMPOSITE_KEYS) {
    const { mean, sd } = stats[key];
    out[key] = sd === 0 ? 0.5 : clamp(0.5 + k * ((c[key] - mean) / sd), 0.05, 0.95);
  }
  return out;
}

/**
 * Z-normalize each composite across all teams so the average team sits at 0.5:
 *   normalized = clamp(0.5 + k * z, 0.05, 0.95)
 * Anchored to the supplied (starting-XI) composites — the population the engine
 * actually sees. Zero variance on a composite yields 0.5 for every team.
 */
export function normalizeLeague(raw: Composites[], k: number = NORMALIZE_K): Composites[] {
  const stats = computeNormStats(raw);
  return raw.map((c) => normalizeWith(stats, c, k));
}
