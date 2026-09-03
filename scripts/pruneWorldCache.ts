/**
 * Prune the on-disk test world cache.
 *
 * `test/helpers/worldCache.ts` keys generated worlds by a content hash of
 * everything that can affect generation, which is what makes a cached world
 * safe to trust. Nothing ever deletes the directory belonging to a hash that is
 * no longer current, so the cache accumulates one directory per source state
 * the machine has ever run tests against. Measured 2026-09-03: 3.6 GB across 20
 * hash directories, the largest 720 MB.
 *
 * This is deliberately a script rather than something `loadFixture` does on its
 * own. Several worktrees are normally open on this repo at once, each possibly
 * on a different commit and therefore a different hash, and they share one
 * cache directory under `node_modules/.cache`. A run that deleted "every hash
 * but mine" would have those worktrees continually destroying each other's
 * fixtures and paying full generation again -- the exact cost the cache exists
 * to avoid. So the rule here is conservative by default: keep the current hash,
 * and keep anything another checkout has touched recently.
 *
 *   npm run test:clean-worlds              keep current hash + anything used in 7 days
 *   npm run test:clean-worlds -- --days 2  narrower recency window
 *   npm run test:clean-worlds -- --all     keep only the current hash
 *   npm run test:clean-worlds -- --dry-run report, delete nothing
 */
import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { fixtureCacheDir, sourceHash } from "../test/helpers/worldCache.js";

const CACHE_DIR = fixtureCacheDir();

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const all = args.includes("--all");
const daysArg = args.indexOf("--days");
const days = daysArg >= 0 ? Number(args[daysArg + 1]) : 7;

if (!Number.isFinite(days) || days < 0) {
  console.error(`--days needs a non-negative number, got ${args[daysArg + 1]}`);
  process.exit(1);
}

/** Size of a directory tree in bytes, and when it was last touched. */
function measure(dir: string): { bytes: number; mtimeMs: number } {
  let bytes = 0;
  let mtimeMs = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = measure(abs);
      bytes += sub.bytes;
      mtimeMs = Math.max(mtimeMs, sub.mtimeMs);
    } else {
      const st = statSync(abs);
      bytes += st.size;
      mtimeMs = Math.max(mtimeMs, st.mtimeMs);
    }
  }
  return { bytes, mtimeMs };
}

const gb = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(2)} GB`;

let hashes: string[];
try {
  hashes = readdirSync(CACHE_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
} catch {
  console.log(`No cache at ${CACHE_DIR} — nothing to prune.`);
  process.exit(0);
}

const current = sourceHash();
const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

let kept = 0;
let freed = 0;
const removed: string[] = [];

for (const hash of hashes.sort()) {
  const dir = join(CACHE_DIR, hash);
  const { bytes, mtimeMs } = measure(dir);
  const isCurrent = hash === current;
  // Recent means another checkout may be mid-run against it. Skipped entirely
  // under --all, which is the "I know nothing else is running" switch.
  const isRecent = !all && mtimeMs >= cutoff;

  if (isCurrent || isRecent) {
    kept += bytes;
    const why = isCurrent ? "current" : `used ${Math.round((Date.now() - mtimeMs) / 86_400_000)}d ago`;
    console.log(`keep   ${hash}  ${gb(bytes).padStart(8)}  (${why})`);
    continue;
  }

  freed += bytes;
  removed.push(hash);
  console.log(`${dryRun ? "would " : ""}delete ${hash}  ${gb(bytes).padStart(8)}`);
  if (!dryRun) rmSync(dir, { recursive: true, force: true });
}

console.log(
  `\n${hashes.length} hash director${hashes.length === 1 ? "y" : "ies"}: ` +
    `kept ${gb(kept)}, ${dryRun ? "would free" : "freed"} ${gb(freed)} ` +
    `across ${removed.length}.`,
);
if (!all && removed.length === 0 && hashes.length > 1) {
  console.log(`Everything else was touched within ${days} days. Use --all to drop it anyway.`);
}
