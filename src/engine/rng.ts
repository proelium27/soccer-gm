/** Seeded RNG — mulberry32. Returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard-normal sample via Box-Muller from the seeded stream. */
export function gaussian(rng: () => number): number {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Deterministically mixes an arbitrary list of integers into a single uint32
 * seed — for deriving independent sub-streams (e.g. a per-player identity
 * rng) from existing identifiers without consuming the caller's rng stream.
 */
export function hashInts(...parts: number[]): number {
  let h = 0x9e3779b9;
  for (const p of parts) {
    h = Math.imul(h ^ (p + 1), 2654435761);
    h = (h ^ (h >>> 15)) >>> 0;
  }
  return h;
}
