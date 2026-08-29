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
 * of total work.
 *
 * So: weight each file, then greedily pack the shards. Nothing here changes
 * which tests run, only which runner runs them.
 *
 * **This does not by itself reduce CI wall-clock, and why not is worth knowing
 * before trusting any estimate of what balancing buys.** The floor is the
 * slowest single *file*, which no split can beat, and here that floor is very
 * nearly the whole budget: on the first packed run, shard 1 ran
 * `test/core/offseason.test.ts` **alone** and took 1933s, against a
 * pre-balancing worst shard of 1749-1863s. So the old worst shard was already
 * almost exactly that one file, and there was never a large wall-clock win to
 * take. What balancing actually bought is the other five shards getting
 * lighter — spare runner capacity, not a faster build.
 *
 * What it did do is make the floor mechanical and visible: shard 1 was provably
 * one file, which made the next move unambiguous. That move has since been
 * taken — `offseason.test.ts` (23 tests, ~1933s on CI) and
 * `international.test.ts` (25 tests, ~1082s) were each split into several
 * files, and this packing is what spreads the pieces across shards. Without it
 * two halves of a split file can land straight back on the same shard.
 * `test/validation/m4-multiseason-integrity.test.ts` was the precedent.
 *
 * With those split, no single file dominates any more and the binding
 * constraint becomes the *total*: work / shard count. If CI needs to go faster
 * still, the lever is the shard count in `.github/workflows/ci.yml`, not
 * further splitting.
 *
 * Note CI runners are ~1.5x slower than a dev machine here
 * (`offseason.test.ts` was ~1276s locally against ~1933s on CI), so the weights
 * below are local seconds. That is fine: uniform scaling doesn't change how the
 * packing sorts.
 */

/**
 * Approximate wall-clock seconds per test file, for the files where the number
 * is big enough to matter. Everything absent is assumed to cost
 * `DEFAULT_WEIGHT_SECONDS`.
 *
 * Treat these as an ordering, not as measurements. They were timed on a dev
 * machine, and a machine running full-world sims back to back thermally
 * throttles — the same file measured 234s and 557s an hour apart. That is fine
 * for the purpose (relative size is what packs the shards) but it means you
 * should not read them as CI seconds, and should not chase a small discrepancy.
 *
 * **A file timed on its own is not the same number as the same file timed
 * during a full run, and the gap is large.** Measured on an 8GB MacBook:
 * `offseasonFinance.test.ts` takes 156s alone and 244s alongside three other
 * heavy files — 1.57x, at only four workers on eight cores, so it is not CPU
 * contention but memory bandwidth and thermals. Parallel efficiency across
 * those four files was ~55%. The entries here are full-run numbers, which is
 * the right basis since packing is about a full run. So when you refresh one
 * with a solo `npx vitest run <file>` it will look far too low — do not paste
 * it in on its own. Mixing a solo number into a table of contended ones
 * reorders the packing on a measurement artefact rather than on real cost.
 *
 * That inflation is also the reason the local two-machine runner
 * (`scripts/testCluster.sh`) is worth more than its core count implies: a
 * second machine adds a memory subsystem and a thermal budget, not just cores.
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
  "test/core/offseasonFinance.test.ts": 490,
  "test/core/internationalPlayerRecord.test.ts": 450,
  "test/core/internationalCampaign.test.ts": 443,
  "test/core/internationalEquivalence.test.ts": 245,
  "test/core/internationalConfederationCups.test.ts": 240,
  "test/core/offseasonRetirement.test.ts": 237,
  "test/validation/m4-multiseason.test.ts": 220,
  "test/validation/m4-multiseason-integrity.test.ts": 199,
  "test/core/offseasonSquads.test.ts": 196,
  "test/core/offseason.test.ts": 208,
  "test/validation/m3-top-scorer.test.ts": 173,
  "test/core/offseasonSolvency.test.ts": 128,
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
 * `capacities` optionally makes the groups *unequal* — group `i` is given work
 * in proportion to `capacities[i]`. CI passes nothing and gets equal shards.
 * The two-machine local runner (`scripts/testCluster.sh`) passes a measured
 * throughput ratio, because a 16GB machine and an 8GB one are not the same
 * amount of test runner. Omitted, it behaves exactly as it always did.
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
export function partitionByCost(
  relPaths: readonly string[],
  count: number,
  capacities?: readonly number[],
): string[][] {
  if (count < 1) throw new Error(`shard count must be >= 1, got ${count}`);

  const caps = capacities ?? new Array<number>(count).fill(1);
  if (caps.length !== count) {
    throw new Error(`expected ${count} capacities, got ${caps.length}`);
  }
  for (const c of caps) {
    if (!Number.isFinite(c) || c <= 0) {
      throw new Error(`every capacity must be a positive finite number, got ${c}`);
    }
  }

  const ordered = [...relPaths].sort((a, b) => {
    const d = weightFor(b) - weightFor(a);
    return d !== 0 ? d : a.localeCompare(b);
  });

  const bins: string[][] = Array.from({ length: count }, () => []);
  const totals = new Array<number>(count).fill(0);

  for (const path of ordered) {
    // Lightest *relative to capacity*. With uniform capacities every divisor is
    // 1, so this is exactly the plain "least loaded" rule and CI's split is
    // byte-for-byte what it was before capacities existed.
    let best = 0;
    for (let i = 1; i < count; i++) {
      if (totals[i] / caps[i] < totals[best] / caps[best]) best = i;
    }
    bins[best].push(path);
    totals[best] += weightFor(path);
  }

  return bins;
}
