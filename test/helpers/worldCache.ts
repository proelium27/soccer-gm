import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * A disk-backed cache for expensive, deterministic test fixtures — in practice
 * generated worlds. Measured 2026-09-03 on the 626-club / 15,650-player world:
 * generation 6.8s, a cached load 110ms, the fixture 25.7 MB on disk. (These
 * read 4.1s and 12ms until then, from a 240-club world three expansions ago —
 * the fuller table is on `league.ts`.)
 *
 * Why this exists: vitest runs every test file in its own worker process, so a
 * plain in-process memo dies at each file boundary and the same world is
 * regenerated in every one of the ~69 files that ask for it. Persisting to disk
 * makes each distinct world cost one generation *ever* rather than one per file
 * per run.
 *
 * Safety rests entirely on the cache key (see `sourceHash`): a stale fixture
 * would mean tests silently validating against an outdated sim.
 *
 * Nothing here deletes the directory belonging to a hash that is no longer
 * current, so the cache grows by one directory per source state the machine has
 * ever tested (measured: 3.6 GB across 20 of them). `npm run test:clean-worlds`
 * prunes it. That is deliberately an opt-in script rather than something this
 * file does on its own — several worktrees share one cache directory and each
 * may sit on a different hash, so self-pruning would have them destroying each
 * other's fixtures.
 */

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** Sources whose contents can change what a generated world looks like. */
const HASHED_PATHS = ["src/core", "src/engine/rng.ts"];

export interface FixtureCacheOptions {
  /** Cache root. Defaults to node_modules/.cache/soccer-gm-worlds. */
  dir?: string;
  /** Cache key. Defaults to `sourceHash()`. */
  hash?: string;
  /** Set false to bypass disk entirely and always generate. */
  enabled?: boolean;
}

/** name -> serialized fixture, so repeat calls in one file skip even the disk read. */
const memo = new Map<string, string>();

/** Drop the in-process memo. Tests use this to simulate a fresh worker process. */
export function resetFixtureMemo(): void {
  memo.clear();
}

function walkFiles(abs: string, out: string[]): void {
  let st;
  try {
    st = statSync(abs);
  } catch {
    return; // A hashed path that doesn't exist simply contributes nothing.
  }
  if (st.isFile()) {
    out.push(abs);
    return;
  }
  for (const entry of readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    walkFiles(join(abs, entry.name), out);
  }
}

let cachedSourceHash: string | null = null;

/**
 * Content hash of everything that can affect world generation, plus the Node
 * version (its Math/JSON behaviour is part of the output).
 *
 * Deliberately hashes **all of `src/core`** rather than generation's current
 * import list. Generation cannot depend on anything outside the hashed set, so
 * a missed dependency cannot silently produce a stale world. Narrowing this to
 * a hand-picked file list reintroduces exactly that failure mode — don't.
 */
export function sourceHash(): string {
  if (cachedSourceHash) return cachedSourceHash;
  const files: string[] = [];
  for (const p of HASHED_PATHS) walkFiles(join(REPO_ROOT, p), files);
  files.sort();
  const h = createHash("sha256");
  h.update(process.version);
  for (const f of files) {
    h.update(f.slice(REPO_ROOT.length));
    h.update(readFileSync(f));
  }
  cachedSourceHash = h.digest("hex").slice(0, 32);
  return cachedSourceHash;
}

/**
 * Where cached fixtures live, one subdirectory per source hash.
 *
 * Exported so `scripts/pruneWorldCache.ts` prunes the directory this actually
 * writes to rather than recomputing the path and risking the two drifting.
 */
export function fixtureCacheDir(): string {
  return join(REPO_ROOT, "node_modules", ".cache", "soccer-gm-worlds");
}

/**
 * Return `name`'s fixture, generating it only if no valid cached copy exists.
 *
 * Every caller gets an independent, freely-mutable value: fixtures are stored
 * as JSON and re-parsed per call. For a LeagueStore that is both exactly
 * equivalent to `structuredClone` (asserted in fixtureFidelity.test.ts) and
 * faster than it — 12ms to parse vs 25ms to clone.
 */
export function loadFixture<T>(
  name: string,
  generate: () => T,
  opts: FixtureCacheOptions = {},
): T {
  const enabled = opts.enabled ?? process.env.SOCCER_GM_NO_FIXTURE_CACHE !== "1";
  if (!enabled) return generate();

  const hash = opts.hash ?? sourceHash();
  const key = `${hash}/${name}`;

  const remembered = memo.get(key);
  if (remembered !== undefined) return JSON.parse(remembered) as T;

  const dir = join(opts.dir ?? fixtureCacheDir(), hash);
  const file = join(dir, `${name}.json`);

  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as T; // Throws on a truncated/corrupt file.
    memo.set(key, raw);
    return parsed;
  } catch {
    // Missing, unreadable, or corrupt — fall through and regenerate.
  }

  const value = generate();
  const raw = JSON.stringify(value);
  memo.set(key, raw);

  // Atomic publish: up to 8 vitest workers can race on the same fixture, and a
  // torn read must be impossible. Rename within the same directory is atomic;
  // a loser of the race simply overwrites with byte-identical content.
  try {
    mkdirSync(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    writeFileSync(tmp, raw);
    renameSync(tmp, file);
  } catch {
    // A cache we can't write is a performance problem, not a correctness one.
  }

  return JSON.parse(raw) as T;
}
