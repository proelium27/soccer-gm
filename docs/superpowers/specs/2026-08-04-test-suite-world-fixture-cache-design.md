# Test suite speed: cache generated worlds on disk

**Date:** 2026-08-04
**Status:** implemented — `test/helpers/worldCache.ts` + `test/helpers/league.ts`
**Goal:** cut full-suite wall time without changing what any test covers.

## Problem

`npm test` runs 92 files / 743 tests in roughly 50 minutes wall, 8,202s of CPU
across 8 workers. Measured from a full instrumented run:

| Finding | Measurement |
| --- | --- |
| World generation dominates | `createLeagueState` = **4,116ms**, essentially all inside `generateWorld` (`assignIdentities` 2ms, `assignAIFormations` 20ms) |
| Hot files bypass the cache | `recommendations.test.ts`, `inboundOffers.test.ts`, `negotiation.test.ts`, `loans.test.ts` call `createLeagueState` **directly**, not the cached `makeLeague` helper |
| A distinct seed per test defeats caching | `recommendations.test.ts` builds ~20 worlds; its worst single test loops seeds `[10..17]` for **932s** |
| No reuse across files | vitest isolates each file in its own process, so `makeLeague`'s in-process `Map` dies at file boundaries. `makeLeague(0, 1)` is written 64 times across the suite and regenerated per file |
| Trivial tests pay full setup | `inboundOfferCandidates > is empty outside an open window` = **98.8s**; `searchWorldPlayers > returns nothing without at least one constraint` = **90s** |

The top 7 files account for 70% of all CPU. Wall times far exceed the 4.1s
idle generation cost (a ~2-generation test costing 99s), which indicates
generation is substantially slower under 8-way CPU contention — so generation
is the overwhelming majority of suite time.

**Correction to existing docs:** `test/helpers/league.ts` claims generation is
"dominated by `estimatePotential`, which runs a 16-trial career Monte-Carlo per
player (4000 players)". Measured: **8ms for all 6,000 players**, 0.2% of the
4.1s. That comment misdirects optimization work and should be fixed.

## Approach

Generate each distinct world **once ever**, persist it as JSON, and have every
test read it. Coverage is untouched: same seeds, same assertions, same worlds.

### Key facts this rests on (all verified)

- A `LeagueStore` survives `JSON.stringify`/`parse` **exactly equal** to
  `structuredClone`, with no keys silently dropped. So JSON can replace
  `structuredClone` as the "fresh mutable copy per caller" mechanism.
- Parse is **12ms** vs **4,116ms** to generate — ~340x.
- One world is 4.4MB of JSON; ~12-15 distinct worlds exist across the suite
  (~66MB total).
- Of the 38 `createLeagueState` call sites in tests, **25 pass a fresh inline
  `mulberry32(seed)`** and are cacheable. The other 13 hold an rng and reuse it
  after generation, so they must keep generating: `international.test.ts` (6),
  `offseason.test.ts` (2), the m3/m4 validation gates (3),
  `transfersRender.test.tsx` (1) and `loans.test.ts:190` (1). None of those are
  among the top-cost files.

### Implementation notes (found while building)

- **Generation is deterministic apart from `meta.created`**, a `Date.now()`
  stamp. Everything else — all 6,000 players, teams, schedule — is byte-identical
  across same-seed generations. This is the precondition the cache rests on and
  is now asserted directly, not assumed.
- `test/db/leagueDb.test.ts` defines its **own local `makeLeague`**, so it is
  excluded from the migration rather than being given a colliding import.

## Design

### 1. Fixture cache in `test/helpers/league.ts`

```
makeLeague(userTid, seed, genSeed)
  1. in-process Map                                  (~0ms, same-file repeats)
  2. node_modules/.cache/soccer-gm-worlds/<key>/<tid>-<seed>-<gen>.json  (~12ms)
  3. generate, write, return                         (~4.1s, once ever)
```

Each caller gets an independent, freely mutable object, exactly as today.

### 2. Cache key

`<key>` = SHA-256 of the contents of `src/core/**/*.ts` + `src/engine/rng.ts`,
plus `process.version`.

Hashing **all of core** rather than a hand-picked dependency list is
deliberate: generation cannot depend on anything outside the hashed set, so a
missed dependency cannot produce a stale world. The cost is that any core edit
rebuilds the ~12-15 worlds once (~60s), after which the run and all later runs
are free.

A stale fixture would mean tests silently validating against an outdated sim.
The broad hash is the mitigation, and it is the reason the key must not be
narrowed later without re-examining this.

### 3. Migrate direct call sites

Replace `createLeagueState(tid, mulberry32(seed))` with `makeLeague(tid, seed)`
in test files. Seeds stay identical.

**Exception:** `loans.test.ts:189` reuses its rng after generation and needs the
rng advanced by generation, which a cached world cannot reproduce. It keeps
calling the real `createLeagueState`. The existing helper doc already warns
about this case; keep that warning and make it point at this exception.

### 4. Concurrency and escape hatch

- Writes are atomic: write to a temp file, then `rename`. Eight workers may
  request the same world simultaneously; a torn JSON read is unacceptable.
- `SOCCER_GM_NO_FIXTURE_CACHE=1` bypasses the disk layer entirely and generates,
  for debugging a suspected cache problem.
- Cache lives in `node_modules/.cache/`, already outside git.

### 5. Guard test

A permanent test asserting a world loaded from cache deep-equals a freshly
generated one. This is what prevents silent drift; without it the cache is an
unverified trust boundary.

## Testing

1. The guard test above.
2. Full suite passes with identical results — 743 passing, same as the
   pre-change baseline captured on 2026-08-04.
3. Measure wall time cold (empty cache) and warm, and report both. The payoff
   here is projected from per-test timings, not from a direct profile of
   generation under parallel load, so it must be measured rather than assumed.

## Non-goals

- No change to seeds, assertions, or coverage.
- No trimming of multi-seed loops (considered and explicitly rejected: CLAUDE.md
  warns the sim gates are noisy and sit near their floors, so fewer samples
  means flakier gates, not just faster ones).
- No fast/slow test tiering.
- No change to world size or generation logic.

## Risks

| Risk | Mitigation |
| --- | --- |
| Stale fixture silently tests old sim behaviour | Hash all of `src/core`; guard test; documented that narrowing the key is unsafe |
| Torn read from concurrent workers | Atomic temp-write + rename |
| A future test reuses its rng after generation | Documented exception pattern; helper doc warns |
| Cache masks a real bug during debugging | `SOCCER_GM_NO_FIXTURE_CACHE=1` |
