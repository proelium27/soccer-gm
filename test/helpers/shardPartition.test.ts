import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  partitionByCost,
  weightFor,
  FILE_WEIGHTS_SECONDS,
  DEFAULT_WEIGHT_SECONDS,
} from "./shardPartition.js";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

function allTestFiles(): string[] {
  const out: string[] = [];
  const walk = (abs: string) => {
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      const p = join(abs, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.test\.tsx?$/.test(e.name)) out.push(relative(REPO_ROOT, p));
    }
  };
  walk(join(REPO_ROOT, "test"));
  return out.sort();
}

/**
 * The partition decides what CI runs. Its failure mode is the dangerous kind:
 * drop a file from every shard and the suite still reports all green, having
 * silently stopped running that file. So the properties below are the point of
 * this file — the balance assertions further down are the nice-to-have.
 */
describe("cost-aware shard partition", () => {
  const files = allTestFiles();

  it("finds the suite (guards the walker itself)", () => {
    // If the walk broke, every property below would hold vacuously.
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain("test/helpers/shardPartition.test.ts");
  });

  for (const count of [1, 2, 3, 6, 7, 12]) {
    it(`covers every file exactly once across ${count} shard(s)`, () => {
      const bins = partitionByCost(files, count);
      expect(bins).toHaveLength(count);

      const seen = bins.flat();
      // Total: nothing dropped.
      expect(seen.slice().sort()).toEqual(files);
      // Disjoint: nothing run twice.
      expect(new Set(seen).size).toBe(seen.length);
    });
  }

  it("depends only on the file list, not the order it arrives in", () => {
    const forward = partitionByCost(files, 6);
    const reversed = partitionByCost([...files].reverse(), 6);
    expect(reversed).toEqual(forward);
  });

  it("handles more shards than files without dropping any", () => {
    const few = files.slice(0, 3);
    const bins = partitionByCost(few, 6);
    expect(bins.flat().sort()).toEqual([...few].sort());
    expect(bins.filter((b) => b.length === 0)).toHaveLength(3);
  });

  it("rejects a nonsensical shard count rather than silently dropping files", () => {
    expect(() => partitionByCost(files, 0)).toThrow();
  });

  it("weights known-heavy files above the default and unknown files at it", () => {
    expect(weightFor("test/core/offseason.test.ts")).toBeGreaterThan(DEFAULT_WEIGHT_SECONDS);
    expect(weightFor("test/does/not/exist.test.ts")).toBe(DEFAULT_WEIGHT_SECONDS);
  });

  it("every weighted file still exists, so the table can't rot unnoticed", () => {
    // A renamed or deleted heavy file silently reverts to the default weight,
    // which is exactly the imbalance this machinery exists to prevent.
    for (const path of Object.keys(FILE_WEIGHTS_SECONDS)) {
      expect(files, `${path} is weighted but no longer exists`).toContain(path);
    }
  });

  it("splits the heavy files across shards instead of stacking them", () => {
    const bins = partitionByCost(files, 6);
    const totals = bins.map((b) => b.reduce((s, f) => s + weightFor(f), 0));
    const heaviest = Math.max(...totals);
    const lightest = Math.min(...totals);

    // The real floor is the single slowest file: no split can beat it, so the
    // bar is that the heaviest shard is near it rather than a multiple of it.
    const slowestFile = Math.max(...files.map(weightFor));
    expect(heaviest).toBeLessThan(slowestFile * 1.5);

    // Vitest's own hash split leaves the lightest shard at ~2% of the heaviest
    // (measured 40s against 1749s in CI). Anything in that region means the
    // packing has stopped working.
    expect(lightest / heaviest).toBeGreaterThan(0.25);
  });
});
