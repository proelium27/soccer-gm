# Testing

176 test files. This is what they're for, which kind to reach for, and which to run.

It's descriptive, not aspirational — the conventions here were already in the suite before they were written down, which is precisely why they kept getting re-derived from scratch and looking inconsistent.

## The principle

> **Test in proportion to how silent the failure would be.**

Nearly every test in here that's earned its place guards something that breaks with no error at all. `test/db/playerIdentity.test.ts` exists because mutating a player in place makes the save layer's reference-identity diff call him clean and never persist the edit — no throw, no type error, and nothing else in the suite notices. `test/helpers/shardPartition.test.ts` exists because a partition bug drops a file from every CI shard and CI still reports green.

The bugs that actually shipped here have the same shape. `awardedPids` returned an empty set for every save, so the protection it implemented did nothing and nothing failed. A missing per-league nationality table silently falls back to England's. A reused pid inherits a dead player's transfer history.

Loud failures — a throw, a crash, a visibly wrong number — need much less. You'll find them.

Two corollaries that resolve most "should this have a test?" arguments:

**Statistical gates are a tax, so charge it only where the equilibrium is fragile.** They're slow, they're noisy, and a badly-scoped one is worse than none. Hence six of them, not sixty.

**Match the assertion to the precision the design actually has.** If you can't say what the number *should* be, you can't gate on it. See "Writing a gate" below — this has gone wrong four times and the fix was the same every time.

## The kinds of test

| Kind | Where | What it's for |
|---|---|---|
| Pure unit | `test/core/**`, `test/engine/**` | Deterministic in→out. Cheap, so the default. |
| Statistical gate | `test/validation/` | Sim N seasons, assert a *band* on a mean. The realism tripwires. |
| Hash pin | `test/engine/touchStats.test.ts` | "This change must not perturb the rng stream." |
| Silent-failure gate | `playerIdentity`, `fixtureFidelity`, `shardPartition` | Protects an assumption whose breach produces no error. |
| Render smoke | `test/ui/*.test.tsx` | Server-rendered markup: does the page throw, does it say the right thing. |
| Interaction | `test/ui/transfersInteraction.test.tsx` | Real DOM: effects, state, event handlers. |
| Budget cap | `windowTransferCap`, `shardPartition` | Pins a *cost* — DOM nodes, shard balance. |
| Audit script | `scripts/` — **not tests** | Too slow to gate, and needs a seed-vs-`main` comparison. |

### On audit scripts specifically

They are deliberately not tests. A dynasty audit runs 20 seasons × 4 seeds and has to be run *on both branches* to mean anything, because several of its metrics drift on `main` too. Making one a test would either take an hour of CI or assert a number that isn't stable. Run them by hand when touching the thing they measure; `CLAUDE.md` says which script guards which mechanic.

## Which tests to run

Full suite is ~67 minutes of work. Don't run it locally; let CI shard it.

| Change shape | Run |
|---|---|
| Pure derivation, UI, docs | `tsc --noEmit` + the touched files |
| New persisted field | + `test/db/migrate.test.ts` — non-negotiable |
| Anything in `src/core` or `src/engine` | + `touchStats` + the relevant `test/validation/` gates |
| Retunes a constant | + the dynasty audit script for that mechanic, vs `main` |
| Adds an invariant others rely on | + a gate test, and say so in `CLAUDE.md` |
| Perf work | + a budget cap test |

The middle rows are the expensive ones and the reason for the table: a pure derivation change does not need a 20-minute sim.

## Writing a gate

The recurring failure is **gating on the wrong statistic and then widening the band when it fails**. Four instances, all in `CLAUDE.md` in full:

- The M3 top-scorer gate measured a world-wide *max* — which rises with world size and was being set by a tier-2 player — while claiming to describe a Golden Boot.
- The M1 benchmark gate sampled `seedComps[len / 2]`, an arbitrary club, while claiming to describe "the average team".
- The M1 table-spread gate averaged 5 seasons of a quantity with sd ≈ 5, so it could fail on seed luck alone.
- The offseason roster-floor test asserted a minimum over 320 clubs that nothing in the game enforces, and had been passing by luck.

Every one was fixed by **changing the statistic, never by widening the band**. The bands are the spec's realism targets. If a gate is failing, the first question is whether it measures what its name says.

Two practical rules that fall out:

- **A max or a min over hundreds of entities is almost never the statistic you want.** Both drift with sample size and both are set by the weirdest case, not the typical one. Use a mean, or a percentile.
- **Verify a widened gate green on *both* sides of the change** that exposed it, or you've tuned the gate to the diff.

## How the suite is kept fast

Two mechanisms, both with sharp edges.

**Generated worlds are cached on disk** (`test/helpers/worldCache.ts`). `createLeagueState` costs ~4.1s and vitest gives every file its own process, so an in-process memo died at each file boundary. Build test worlds with `makeLeague(tid, seed)`. The exception is a test that threads its rng onward into a later `simThrough`/`simOffseason` — a cached world skips generation, so the rng arrives in the wrong state. Those keep calling `createLeagueState`, and `test/helpers/offseasonLeague.ts` / `intlLeague.ts` wrap the pattern.

The cache key is a content hash of **all of `src/core`** plus `src/engine/rng.ts`. Deliberately broad: generation then cannot depend on anything unhashed. **It does not cover the match engine**, which is correct only because generation never plays a match — see the deferred item below.

**CI shards are packed by cost** (`test/helpers/shardPartition.ts`). Vitest's own `--shard` slices by file *count* and ignores what a file costs, which left one runner at 31 minutes and another at 40 seconds, the same way every run. The weights are a hand-maintained table; being wrong costs balance, never correctness.

The thing to internalise: **a shard can never be faster than its slowest file.** Balancing alone bought nothing here (1863s → 1933s) because the worst shard was already one 32-minute file. What fixed it was splitting that file — CI is ~12 minutes now, with the shards within 8% of an even share. If it needs to be faster again, the lever is the shard count in `ci.yml`, not more splitting.

Add a weights entry when a new file runs longer than ~30s. Treat the numbers as an ordering, not seconds: a dev machine running full-world sims back to back thermally throttles, and the same file measured 234s and 557s an hour apart.

## The DOM

Most UI tests server-render to a string (`renderToStaticMarkup`), which reaches markup but never effects, state or handlers.

`test/ui/transfersInteraction.test.tsx` is the exception: it sets `// @vitest-environment happy-dom` and drives the page with `@testing-library/react`. **Set the environment per file, not globally** — the other ~170 files are pure logic or static markup and shouldn't pay for an environment they never use.

One trap, already hit: Vite rewrites `new URL(path, import.meta.url)` as an asset reference, which under a DOM environment yields a non-file URL and makes `fileURLToPath` throw. `worldCache.ts` splits the two steps for this reason. If a helper suddenly fails only in a DOM test, look there first.

This is a young seam. It exists because the interactive half of the app was structurally untestable, which is where the long-standing "the transfers tab keeps crashing" report lives — every candidate cause ruled out so far was ruled out by static means.

## Known gaps, and one deliberate non-goal

**Interaction coverage is one page deep.** The environment works; only `/transfers` uses it. Extending it is cheap now.

**No test drives the worker boundary.** `useSimWorker` and the `postMessage` round trip are untested, and `simArchive`'s detach/reattach invariant is guarded by a pure end-to-end equality test rather than by anything that exercises a real worker.

**Simmed worlds are not cached, and this was considered and declined.** Every expensive test re-sims from scratch. Caching the *result* would need the rng state cached with it, since these tests thread their rng onward — and mulberry32 keeps its state in a closure, so that means exposing internal rng state from `src/engine/rng.ts`. That is the file the entire determinism story rests on, and the payoff is roughly 2–3 minutes off a 12-minute CI. Not a good trade today. If it's ever revisited, note the cache key **must** widen to all of `src/engine` first: a simmed world depends on `matchSim`, `attribution`, `matchRating`, `engine/constants` and `positionFit`, none of which is hashed now.

**Changelog em-dashes.** `CLAUDE.md` says player-facing prose uses no em-dashes; five shipped entries do. `test/core/changelogEntries.test.ts` deliberately does not assert it — that's a call for whoever owns the voice, not something to settle by adding an assertion.
