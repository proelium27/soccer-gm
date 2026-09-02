# Save performance: split `players` into its own IndexedDB store

Status: **phases 0–2 implemented, and phase 3b has since begun.** Phase 3 is
measured and recommended *against*; phase 4 is untouched. See "Results" below
for what shipped and what it bought.

**Written 2026-08-10, against schema v2. The database is at v3 now** — schema v3
(2026-08-22) split `retiredPlayers` into its own `retirees` store, on the same
out-of-line `[lid, pid]` key, the same identity diff and the same transaction as
the players split described here. That is the first slice of phase 3b, and it
confirmed the diagnosis: the archive was being re-serialised on every lineup
change, costing 11ms per save at 2,000 rows and 91ms at 20,000, so
`RETIREE_ARCHIVE_LIMIT` turned out to be bounding **write latency, not disk** —
which is why it could go 2,000 → 20,000 the moment it moved out. The remaining
append-only logs (`powerRankingHistory`, `transfers`, `newsEvents`,
`seasonHistory`, `cupHistory`) are still in the league record. See CLAUDE.md's
"Split player storage" entry for the current state.

This changes the on-disk format of existing saves (see "Migration").

## The problem in one sentence

The entire league is a single IndexedDB record, so every mutation rewrites the
whole world, and the cost of clicking any button grows with how long you've played.

## Why this is the right fix

Basketball GM stays responsive at 100 seasons with a database that is also large.
It manages that by storing entities as separate indexed records, so the cost of an
action tracks *what changed*, not *how much history exists*. We do the opposite:

- `src/db/database.ts` declares exactly **one** object store, `leagues`, keyed by
  `lid`, whose value is the whole `LeagueStore`. No indexes.
- `saveLeague` is `db.put("leagues", league)` — serialize and write all 64 MB.
- `LeagueContext.tsx` calls `saveLeague` at **9 sites**. Signing one free agent
  writes 64 MB. Moving one player in the lineup writes 64 MB. Nudging the scouting
  slider writes 64 MB.
- `listLeagues()` calls `db.getAll("leagues")`, fully deserializing *every* save
  just to read `name` and `created` for the `/leagues` page.

This reframes the last year of work on this problem. The free-agent cull,
`archiveCup`, `WINDOW_TRANSFER_LIMIT`, `RETIREE_ARCHIVE_LIMIT` — all of it fought
*size*, on the theory that a smaller save is a faster save. That is only true
because we made total size the thing that gets touched on every action. Shrinking
the save buys a constant factor. Splitting the store changes the exponent.

## Measured baseline

`scripts/leagueSizeTiming.ts`, 240-club world (the six-country world of the time), single run:

| season | players | MB (json) | structuredClone | saveLeague |
|--------|---------|-----------|-----------------|------------|
| 1  | 9,083  | 12.0 | 62 ms   | 78 ms   |
| 5  | 10,345 | 33.4 | 1,233 ms | 1,588 ms |
| 10 | 10,616 | 52.3 | 1,330 ms | 1,908 ms |
| 14 | 10,714 | 64.2 | 1,518 ms | 1,071 ms |

Growth is ~2.9 MB/season and only slowly decelerating. Mobile is 5–10× slower.

**Every number in this document was measured before Belgium and Turkey landed
(2026-08-12), i.e. on 240 clubs rather than today's 320.** Treat them as a floor,
not a current reading — the save is bigger now, so both the problem and the win
are larger. The conclusions are unaffected; the absolute milliseconds are not.

## Scope: this plan fixes one of the two costs

There are two independent whole-league costs, and it matters not to conflate them:

1. **The IndexedDB write** (`saveLeague`). ← *this plan*
2. **The `structuredClone` to and from the sim worker.** Every `WorkerCommand` and
   `WorkerResponse` in `src/worker/protocol.ts` carries the full `LeagueStore`, and
   `postMessage` clones it both ways on the main thread. Untouched here.

So be clear about what this delivers: **ordinary interactions become instant;
simming stays roughly where it is.** Cost (2) dominates a sim, and only worker
residency fixes it (see "Not in scope" below). That split is the right priority
anyway — a sim is a moment where the user accepts that the game is thinking, while
a lineup change freezing for a second is what reads as broken.

## Design

### 1. Schema v2

`DB_VERSION` 1 → 2. Two stores:

- **`leagues`** — the `LeagueStore` *minus* `players`. Keyed by `lid`, as today.
- **`players`** — one record per player, out-of-line array key `[lid, pid]`.

Array keys are native to IndexedDB, so a league's whole pool is one range query:
`IDBKeyRange.bound([lid, -Infinity], [lid, Infinity])`. No index needed; the
primary key already clusters by `lid`.

`loadLeague` reassembles the two into a normal `LeagueStore` before returning, so
**everything above the db layer is unchanged** — `migrate.ts`, `exportImport.ts`,
the worker, and all 50 files touching `league.players` keep working against one
in-memory array. That containment is what makes this tractable.

### 2. Writes must be one transaction

`db.transaction(["leagues", "players"], "readwrite")` spanning both stores. Not
optional: a crash between the two writes leaves `teams[].roster` pointing at pids
that have no player record, which is a corrupt save rather than a slow one.

### 3. The dirty set

To write only what changed we need to know what changed. The core is **purely
functional** — it never mutates the players array structurally (the only
`players.push` in the entire repo is in a test fixture) and it passes unchanged
players through *by reference*:

```ts
players: players.map((p) => promoted.get(p.pid) ?? p)   // core/freeAgency.ts:555
```

So a **reference-identity diff** gives the dirty set for free. `LeagueContext`
keeps a `Map<pid, Player>` of what was last written; on save, walk the current
array and collect any player whose object identity differs, plus any pid that
vanished (a deletion). That is ~10,000 pointer comparisons — sub-millisecond, no
deep compare, no hashing.

**The catch, and it is the sharp edge of this whole design:** if any code ever
mutates a player *in place* while keeping the same object identity, the diff calls
it clean and the change is silently never persisted. That is a data-loss bug that
no type checker will catch and no existing test would notice.

Mitigation is mandatory and is its own phase: a **test-only verification pass**
that deep-compares the full pool against the last write and asserts the dirty set
was complete, run over a simulated season. That converts the failure mode from
silent corruption into a red test.

### 4. Known limit: sims dirty most of the pool

`simThrough.ts:165` shallow-copies **every** player at the start of a batch:

```ts
let currentPlayers = league.players.map((p) => ({ ...p, stats: [...p.stats.map((s) => ({ ...s }))] }));
```

so after any sim, every player has a new identity and reads dirty. Phase 1 simply
accepts this. Phase 3 could make that copy lazy — a pure refactor with no `rng`
draws, so determinism is safe — but the payoff is smaller than it looks:
`accumulateStats` opens or touches a `SeasonStats` row for **every player on either
roster**, not just the ~14 who appear, so a matchday genuinely changes roughly half
the pool. Expect ~2×, not ~20×.

*(This corrects a "~500 of 10,000" estimate I gave in chat before reading
`accumulateStats`. The real figure is about half the pool.)*

### 5. Migration

Create the `players` store in `upgrade()`, but do the **data split lazily in
`loadLeague`**: read the v1 record, split it, write v2. `loadLeague` already has a
write-back path (`shrankOnLoad`), so this follows an established pattern and is far
easier to test than doing bulk work inside a `versionchange` transaction. One-time
cost of a few seconds on the largest save, once.

**One-way door, and it is wider than "the migrated save".** Verified, not reasoned
about: once a `DB_VERSION` 2 build has opened the database even once, a version-1
build's `openDB` fails outright with `VersionError` — IndexedDB refuses to open at
a version below the stored one. So the blast radius is **the whole database, every
save, migrated or not**, per browser profile.

Two consequences worth planning around:

- **Deploy rollback is not free.** Ship this, have a user load it once, then roll
  back, and that user cannot open *any* save until you roll forward again. No data
  is lost — going back to the newer build restores everything — but the outage is
  total while it lasts.
- **Several branches and worktrees are normally open at once here**, so whichever one is
  on the older build will hit this the moment it loads a save after the new build has run once.

Export JSON is the escape hatch and should be called out in the PR.

## Phasing

Ordered so the risky part lands last, on top of something already proven.

| Phase | Work | Delivers | Effort |
|-------|------|----------|--------|
| **0** | Baseline harness: extend `leagueSizeTiming` to time individual actions, not just full saves. Write the dirty-set verification test *first*, against current behaviour. | Numbers to judge the rest by | ~0.5 day |
| **1** | Schema v2, two stores, one transaction, lazy migration, reassembly in `loadLeague`. **Still writes every player on every save.** | Proves split + migration with zero correctness risk. Fixes `listLeagues` outright. Little else. | ~2 days |
| **2** | Reference-identity dirty set + deletions + the verification test from phase 0. | **The actual win.** Non-sim actions drop from ~64 MB to a few KB. | ~2 days |
| **3** | ~~Lazy copy in `simThrough`~~ **Dropped.** Measured ceiling is 26%, on the one action users already accept as a pause, for a change to the hot path. | — | — |
| **3b** | *New, replaces 3.* Split the append-only logs (`powerRankingHistory`, `transfers`, `newsEvents`, `seasonHistory`, `cupHistory`) into their own stores, appending rather than rewriting. **Started:** `retiredPlayers` moved out in schema v3 (2026-08-22); the logs above have not. | Small actions go flat; removes the remaining 7.8 MB floor | ~2–3 days |
| **4** | *Separate piece of work.* Keep the league resident in the sim worker; pass commands and deltas instead of the world. | Kills cost (2), the sim bottleneck | ~1–2 weeks |

Phase 1 on its own delivers almost nothing user-visible — it exists purely to
de-risk phase 2. Worth knowing before it is judged on its own merits.

## Results

Measured with `scripts/savePerfProbe.ts` (240-club world, seed 7). `dirty` is what
a save writes; `changed` is what genuinely differs by content.

**The reference-identity assumption holds.** At both 3 and 8 seasons, across every
action tried, no player ever changed content without also getting a new identity —
the probe fails loudly if one does. Single-player actions are as cheap as hoped:

| action | dirty | changed | of the save |
|--------|-------|---------|-------------|
| extend contract | 1 | 1 | 0.01% |
| sign free agent | 1 | 1 | 0.01% |
| release player / set lineup / set scouting spend | 0 | 0 | 0.00% |
| sim one matchday | 8,076 | 5,992 | 82% |
| offseason | 8,045 | 8,045 | 82% |

**Save cost, 8-season save (34.6 MB).** Small actions **281 ms → ~118 ms**; at a
3-season save, 99 ms → ~35 ms.

**Three findings that change the plan:**

1. **Phase 1 alone is a regression, as predicted but worse than expected** —
   writing ~8,000 rows individually took a full save from 99 ms to 335 ms. It must
   never ship without phase 2. (It didn't; both are on the same branch.)

2. **Phase 3 is not worth doing.** Its entire ceiling is the gap between `dirty`
   and `changed` on a sim: 8,076 vs 5,992, so ~26%. That is a modest gain on the
   one operation users already accept as a pause, in exchange for touching
   `simThrough`'s hot path in a repo with a history of RNG-order accidents.
   **Recommendation: drop it**, and spend the effort on the append-only split below.

3. **The win is real but not flat, and the remaining floor is now visible.** Small
   actions cost 35 ms at 3 seasons and 118 ms at 8, because the league record still
   holds everything that is not a player. At 8 seasons that is 7.8 MB, and it is
   almost entirely **append-only**: `powerRankingHistory` 2.3 MB, `transfers`
   1.7 MB, `newsEvents` 1.3 MB, `seasonHistory` 0.7 MB, `cupHistory` 0.6 MB.
   Append-only is the easiest case there is — new rows are written, old rows are
   never rewritten — so splitting these is both the next-biggest win and cheaper
   than the players work was. **This, not phase 3, is the follow-up.**

## Files that change

- `src/db/database.ts` — schema, `DB_VERSION`, second store
- `src/db/leagueDb.ts` — save/load/list, the transaction, the split, the dirty set
- `test/db/leagueDb.test.ts` — round-trip, incremental write, deletion, stale-writer
  fallback, v1→v2 split
- `test/db/playerIdentity.test.ts` — the invariant gate
- `scripts/savePerfProbe.ts` — per-action dirty set and timings

**`LeagueContext.tsx` did not need to change**, which the plan expected it would.
Keeping the last-written pool inside the db layer (keyed by lid) instead of asking
the caller to track it means no call site can forget, and the whole feature stays
in one file. The cross-tab hazard that created — another tab writing between our
saves, leaving our idea of the pool stale — is handled by a `writeSeq` counter on
the league record: if it does not match what we last wrote, the save falls back to
a full rewrite.

Deliberately unchanged: `migrate.ts`, `exportImport.ts`, `src/worker/*`, and every
file that reads `league.players`.

## Expected outcome

- Signing a player, setting a lineup, moving the scouting slider: **~1.0–1.5 s → effectively instant**, and flat in season count.
- `/leagues` stops deserializing every save's full player pool to render three rows.
- Simming: unchanged until phase 3, and properly fixed only by phase 4.

## Risks

1. **Silent missed writes** if the reference-identity assumption is ever violated. Highest-severity item here; phase 2 does not ship without the verification test.
2. **Save/roster desync** if the two stores are ever written outside one transaction.
3. **One-way migration** — older builds cannot read a split save.
4. **Reference-diff degrades quietly** if code starts copying players unnecessarily: correctness holds, speed silently reverts. The phase 0 harness should report dirty-set size per action so a regression shows up as a number.

## Not in scope

- Worker residency (phase 4 above) — the bigger win for sims, and a separate design.
- Splitting `seasonHistory` / `cupHistory` / `transfers` / `newsEvents` into their own stores. They are a much smaller share of the save post-`archiveCup`, and they are append-only, so a later phase can do it cheaply if measurement says it is worth it.
- Any change to what data we retain. This plan explicitly does **not** delete history; it stops us from rewriting it on every click.

## Open questions

**Answered:** phase 3 was the open question, and the measurement settled it — a 26%
ceiling on sims does not justify touching `simThrough`. Dropped in favour of 3b.

**Still open — needs a real browser.** The save now does its reads and writes inside
a single IndexedDB transaction. That is required for correctness, but IDB
transactions auto-commit once they go idle, and `fake-indexeddb` (what the tests
use) is more forgiving about this than Safari is. Every `await` in the save path is
on a request belonging to that transaction, which should keep it alive, but this
wants confirming by playing a save in an actual browser before it is trusted.
