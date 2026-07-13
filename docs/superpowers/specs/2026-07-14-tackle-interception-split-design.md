# Split `tackles` into realistic `tackles` + `interceptions`

Status: approved by user, ready for implementation planning.

## Context

CLAUDE.md's Match Rating section already flagged a known gap: "this engine's
`tackles` field is a catch-all defensive-action count that can run into the
high teens per match (unlike a real match's ~5-8 tackles), so at the given
DEF weight (0.2/tackle) a scoreless center-back can rating-farm into the 9s."

Investigation confirmed the root cause and its severity is worse than that
note implied. The real Premier League's single-season tackle leader (a full
~38-game season) tops out around 85 — roughly 2.2/game. This engine can
produce mid-teens for one center-back in a *single* match, off by roughly
two orders of magnitude versus the seasonal rate.

Root cause chain:
- `src/engine/matchSim.ts:521-524` increments a player's `tackles` on
  essentially every simulated-possession turnover roll (`turnoverP`, derived
  from `TURNOVER_BASE` in `src/engine/constants.ts:13`), which fires on
  most possession ticks throughout a match — not on a discrete, realistic
  "tackle" event.
- `pickTackler` (`src/engine/attribution.ts:121-125`) always credits *some*
  outfield player on every such turnover, weighted by `TACKLE_WEIGHTS`
  (`attribution.ts:67-69`: CB 3, DM 2.5, FB 2, CM 1.5, AM/W 0.5, ST 0.2, GK
  0.1) × `(tackling + 10)`. CB carries the single highest weight, so CBs
  accumulate the plurality of these very-frequent credits nearly every
  match.
- `computeMatchRating` (`src/engine/matchRating.ts:52`,
  `TACKLE_WEIGHT.DEF = 0.2` at line 21) then rewards that volume linearly
  with no cap or diminishing returns — fifteen tackles is a +3.0 rating
  swing, dwarfing what a MID/FWD can realistically add from goals/assists
  in a given match. This is why center-backs currently dominate the match
  rating leaderboard.

User decision (confirmed during brainstorming): fix should **not** change
how often possession actually changes hands (`turnoverP`/match flow/scoring
stay untouched) — only what gets *credited* as a stat, and richer than a
single tuned-down "tackle" count: split the credited turnovers into two
distinct, separately-tracked stats, **`tackles`** and **`interceptions`**,
matching how a real box score distinguishes a crunching challenge from a
clean interception. Both should land in real-world-plausible per-match
ranges (roughly the ~2-6/match order of magnitude discussed for tackles;
interceptions tuned to a similarly realistic scale during implementation,
not hardcoded here).

## Design

### 1. Data model

- `PlayerMatchLine` (`src/engine/attribution.ts:38-51`): add
  `interceptions: number` alongside the existing `tackles: number`.
  `emptyLine()` (lines 157-162) zeroes it like every other counter.
- `SeasonStats` (`src/core/players/types.ts:14-28`): add a season-total
  `interceptions: number`, tracked exactly like the existing `tackles`
  field (a plain running sum — no `sum`/`avg` pair needed, unlike
  `ratingSum`/`avgRating`, since nothing derives an average interceptions
  stat). `emptySeasonStats` (lines 30-35) zeroes it.
- Rollup (`src/core/simThrough.ts:41-53`): add
  `ss.interceptions += line.interceptions;` next to the existing
  `ss.tackles += line.tackles;` (line 49).

### 2. Generation logic (`matchSim.ts` / `attribution.ts`)

Leave `turnoverP` and `pickTackler`'s position weighting **untouched** —
match flow, possession changes, and scoring are unaffected by this change.

At `matchSim.ts:521-524`, after `pickTackler` selects the defender who wins
the ball, replace the unconditional `tackles++` with a three-way categorical
roll deciding what, if anything, gets credited:

- **Tackle** — a real, creditable challenge.
- **Interception** — won the ball cleanly, without a physical duel.
- **No credit** — the turnover still happens (for flow purposes; the
  attacking side still loses the ball and play continues exactly as today)
  but isn't logged as a notable defensive stat against anyone, mirroring how
  a real match has plenty of stoppages/misplaced passes that no box score
  attributes as a "tackle" or "interception."

Two new constants in `src/engine/constants.ts`, next to `TURNOVER_BASE`
(matching that file's flat `export const NAME = value; // comment` style,
not a doc-block section — there is no existing section-header convention in
this particular file to match):

```ts
export const TACKLE_CREDIT_PROB = <tbd>;       // share of turnovers logged as a tackle
export const INTERCEPTION_CREDIT_PROB = <tbd>; // share of turnovers logged as an interception
```

(`1 - TACKLE_CREDIT_PROB - INTERCEPTION_CREDIT_PROB` is the "no credit"
share.)

**Deviation from the original plan (approved during implementation):** rather
than reusing whichever defender `pickTackler` already selected for both
credit types, the shipped implementation adds a distinct `pickInterceptor`
(`src/engine/attribution.ts`) run as its own selection pass on the
interception branch, keyed to the player's own `interceptions` rating instead
of `tackling` — a rating that was previously unused anywhere in match
simulation. This was a deliberate scope increase, confirmed with the user via
an explicit choice ("use the dedicated interceptions rating") during planning,
on the reasoning that a player who reads the game well via a `positioning`/
`interceptions`-driven skill isn't necessarily the same player who wins the
ball via a physical `tackling` duel — treating them as fully independent stats
better matches how a real box score distinguishes the two. `pickInterceptor`
still shares `TACKLE_WEIGHTS`' CB/DM/FB-leaning position shape (both
skills cluster in the same positions), only the rating key differs.

Exact values for `TACKLE_CREDIT_PROB`/`INTERCEPTION_CREDIT_PROB` are **not**
fixed in this spec — they get fit empirically during implementation via the
dynasty-audit approach described in Testing, the same way prior tuning
passes (OVR rebalance, AI-GM constants) were calibrated against real
simulation output rather than guessed.

### 3. Match rating (`src/engine/matchRating.ts`)

Add an `INTERCEPTION_WEIGHT` position matrix alongside the existing
`TACKLE_WEIGHT` (line 21), same DEF-leaning shape (CB/FB read the game more
than forwards/midfielders) but its own tuned magnitude — not necessarily
equal to `TACKLE_WEIGHT`. Apply it in `computeMatchRating` (around line 52)
the same way tackles are applied:

```ts
rating += line.interceptions * INTERCEPTION_WEIGHT[group];
```

Combined with realistically-sized raw counts from step 2, this should
resolve the "all-CB leaderboard" symptom without any special-cased
weight hack — the fix is in the volume, not just the weight.

### 4. UI

- `src/ui/pages/BoxScore.tsx`: add an "Int" column next to the existing
  "Tkl" column (line 45 header, line 67 cell), same `line.tackles || ""`
  empty-when-zero display convention.
- `src/ui/pages/Leaders.tsx` (the Stat Leaders page — not `StatLeaders.tsx`,
  despite the CLAUDE.md name): add `"interceptions"` to the sort-key union
  (near line 13), a column def `{ key: "interceptions", label:
  "Interceptions" }` (near line 23), career-total accumulation (near line
  49, alongside `total.tackles += s.tackles`), and a cell render (near line
  214).
- `src/ui/pages/Roster.tsx` (line 134 shows season tackles per player):
  add the equivalent season interceptions display alongside it.

### 5. Migration (`src/db/migrate.ts`)

Follow the exact existing pattern used for `rating`/`minutesPlayed`/
`ratingSum`/`avgRating` (lines 32-61): widen the "any version" types via
`Omit<X, "interceptions"> & Partial<Pick<X, "interceptions">>` for both
`PlayerMatchLine` and `SeasonStats`, then backfill `interceptions: line
.interceptions ?? 0` / `s.interceptions ?? 0`. Historical box scores get a
neutral 0, same treatment already given to `minutesPlayed`/`rating` for
saves that predate those fields — the underlying event data needed to
reconstruct history doesn't survive in old saves.

### 6. Manual.tsx

`src/ui/pages/Manual.tsx:89`'s Stat Leaders description ("goals, assists,
shots, tackles, saves, clean sheets, minutes, and average match rating")
gets "interceptions" added to the list. If the Manual's Match Rating section
enumerates the weight-matrix columns anywhere else, update that too.

### Scope boundaries (explicitly not building)

- No change to `turnoverP`, match flow, possession mechanics, or scoring
  rates — confirmed with the user up front.
- No new event type in `MatchEventType`/`MatchEvent` — the existing
  `"turnover"` event type and its `pids` attribution are untouched; only the
  *stat credit* resulting from a turnover is split three ways.
- No separate UI page or leaderboard entry beyond the existing Tackles-
  pattern columns — interceptions slot into the same places tackles already
  appear.

## Testing

- **Unit tests** (alongside existing `matchSim`/`attribution` tests): over
  many rolls, the three-way categorical outcome distribution lands close to
  its configured `TACKLE_CREDIT_PROB`/`INTERCEPTION_CREDIT_PROB` constants;
  `pickTackler`'s existing position-weighting behavior is unaffected by the
  new roll (CB still favored for whichever credit fires).
- **Match rating unit tests**: `computeMatchRating` correctly adds
  `INTERCEPTION_WEIGHT[group]` per interception, independent of the
  existing `TACKLE_WEIGHT` handling.
- **Migration test**: an old-save fixture missing `interceptions` on both
  `PlayerMatchLine` and `SeasonStats` backfills to `0` without touching any
  other field.
- **Dynasty/season audit** (same methodology used for OVR-rebalance and
  AI-GM tuning passes): simulate enough matches to observe realistic
  per-match and per-season tackle/interception distributions for busy
  center-backs — target order-of-magnitude matches real-world Premier
  League rates (season leader ~85 tackles, i.e. ~2.2/game) rather than the
  current high-teens-per-match blowout. Used to fit
  `TACKLE_CREDIT_PROB`/`INTERCEPTION_CREDIT_PROB` and the new
  `INTERCEPTION_WEIGHT` matrix, and to confirm match ratings across
  positions look sane again (no more CB-only leaderboards).

## Docs

Once implemented and merged, update CLAUDE.md: replace the existing
"tuning note for later" paragraph about `tackles` (in the post-M6 Match
Rating section) with a description of the shipped fix — the tackle/
interception split, the new constants, and the resolved CB-rating-farming
symptom — following the same style as the other post-M6 addendums in that
file.
