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

    const mine = new Set(partitionByCost(files.map(keyOf), count)[index - 1]);
    return files.filter((spec) => mine.has(keyOf(spec)));
  }
}
