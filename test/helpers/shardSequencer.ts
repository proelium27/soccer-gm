import { relative } from "node:path";
import { BaseSequencer, type WorkspaceSpec } from "vitest/node";
import { partitionByCost } from "./shardPartition.js";

/**
 * Replaces vitest's cost-blind `--shard` split with a weighted one. See
 * `shardPartition.ts` for why, and for the measurements.
 *
 * Only `shard()` is overridden; `sort()` (which orders files *within* a shard,
 * using vitest's own duration cache) is inherited unchanged.
 */
export default class CostAwareSequencer extends BaseSequencer {
  async shard(files: WorkspaceSpec[]): Promise<WorkspaceSpec[]> {
    const { config } = this.ctx;
    if (!config.shard) return files;
    const { index, count } = config.shard;

    // Key on the repo-relative path, which is what the weights table is written
    // in. Every shard partitions the identical list and keeps only its own
    // group, so this has to depend on nothing but the file list itself.
    const keyOf = (spec: WorkspaceSpec) => relative(config.root, spec.moduleId);

    const caps = capacitiesFromEnv(process.env.VITEST_SHARD_CAPACITIES, count);
    const mine = new Set(partitionByCost(files.map(keyOf), count, caps)[index - 1]);
    return files.filter((spec) => mine.has(keyOf(spec)));
  }
}

/**
 * Optional per-shard throughput weights, comma-separated, one per shard in
 * shard order. Used by the two-machine local runner (`scripts/testCluster.sh`),
 * where the shards are machines of different speed rather than identical CI
 * runners. CI sets nothing and gets the equal split it always had.
 *
 * **Throws rather than falling back to an equal split.** Every shard computes
 * the whole partition and keeps only its own slice, so the shards agree only
 * for as long as they agree on the capacities. If one machine parsed the value
 * and another quietly ignored it they would compute different partitions, and
 * that failure is silent in the worst way: some files run on both machines,
 * others on neither, and both report green. Better to refuse to start.
 */
function capacitiesFromEnv(raw: string | undefined, count: number): number[] | undefined {
  if (!raw) return undefined;
  const parts = raw.split(",").map((s) => Number(s.trim()));
  if (parts.length !== count || parts.some((n) => !Number.isFinite(n) || n <= 0)) {
    throw new Error(
      `VITEST_SHARD_CAPACITIES must be ${count} positive numbers separated by commas ` +
        `(one per shard), got "${raw}"`,
    );
  }
  return parts;
}
