/**
 * Cost-aware split of test files across CI shards.
 *
 * Vitest's own `--shard` hashes each file path with sha1, sorts by the hash and
 * slices the list into equal *counts* (see `BaseSequencer.shard`). That is
 * deterministic and cost-blind, which is a bad combination for this suite: the
 * work is wildly unevenly distributed — a handful of full-world multi-season sim
 * files run for minutes while most run in milliseconds — so one shard reliably
 * draws the heavy files and every other runner finishes early and idles. It is
 * the same draw every run, because the hash of a path doesn't change. Measured
 * over three consecutive CI runs on six shards, the slowest shard took 1749s,
 * 1765s and 1863s while the fastest took 40s, 41s and 47s, against ~75 minutes
 * of total work — so wall-clock was roughly 2.4x what an even split would cost.
 *
 * So: weight each file, then greedily pack the shards. Nothing here changes
 * which tests run, only which runner runs them.
 *
 * **The floor is the slowest single file, not the average.** No split can beat
 * it, so once the shards are balanced the only way further down is to break up
 * the biggest files (`test/core/offseason.test.ts` is ~21 minutes on its own).
 * `test/validation/m4-multiseason-integrity.test.ts` is the precedent — it was
 * split out of its sibling for exactly this reason.
 */

/**
 * Measured wall-clock seconds per test file, for the files where the number is
 * big enough to matter. Everything absent is assumed to cost
 * `DEFAULT_WEIGHT_SECONDS`.
 *
 * These drive load balancing only. Being wrong costs balance, never
 * correctness: every file still runs exactly once across the shards whatever
 * the weights say (`partitionByCost` is total and disjoint, pinned by
 * `shardPartition.test.ts`). So an unlisted new file is safe — it just lands
 * somewhere by default weight.
 *
 * Refresh a number by timing the file on its own:
 *   npx vitest run <file> --reporter=basic
 * and add an entry whenever a new file runs longer than ~30s.
 */
export const FILE_WEIGHTS_SECONDS: Readonly<Record<string, number>> = {
  "test/core/offseason.test.ts": 1276,
  "test/core/international.test.ts": 721,
  "test/validation/m4-multiseason.test.ts": 220,
  "test/validation/m4-multiseason-integrity.test.ts": 199,
  "test/validation/m3-top-scorer.test.ts": 173,
  "test/core/simThrough.test.ts": 81,
  "test/ui/transfersRender.test.tsx": 65,
  "test/helpers/fixtureFidelity.test.ts": 31,
  "test/validation/m1-benchmarks.test.ts": 20,
};

/**
 * What an unlisted file is assumed to cost. Set from the measured residual: the
 * suite totals ~75 minutes of work, the files listed above account for roughly
 * 45 of it, and the remainder spread over the ~155 files that aren't listed
 * comes out near ten seconds each. Sharding is insensitive to this being a few
 * seconds off — it only decides the order light files get topped up in.
 */
export const DEFAULT_WEIGHT_SECONDS = 10;

export function weightFor(relPath: string): number {
  return FILE_WEIGHTS_SECONDS[relPath] ?? DEFAULT_WEIGHT_SECONDS;
}

/**
 * Split `relPaths` into `count` groups of roughly equal total weight.
 *
 * Greedy longest-processing-time: heaviest file first, each one onto whichever
 * shard is currently lightest. That is the standard 4/3-approximation for
 * multiway partitioning, and well inside what matters here — the real limit is
 * the single heaviest file, which no algorithm can split.
 *
 * Ties break on path so the result depends only on the file list, never on the
 * order the caller happened to supply. Every shard runs this identically and
 * they must all agree, since each one keeps only its own group.
 */
export function partitionByCost(relPaths: readonly string[], count: number): string[][] {
  if (count < 1) throw new Error(`shard count must be >= 1, got ${count}`);

  const ordered = [...relPaths].sort((a, b) => {
    const d = weightFor(b) - weightFor(a);
    return d !== 0 ? d : a.localeCompare(b);
  });

  const bins: string[][] = Array.from({ length: count }, () => []);
  const totals = new Array<number>(count).fill(0);

  for (const path of ordered) {
    let lightest = 0;
    for (let i = 1; i < count; i++) {
      if (totals[i] < totals[lightest]) lightest = i;
    }
    bins[lightest].push(path);
    totals[lightest] += weightFor(path);
  }

  return bins;
}
