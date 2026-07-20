# God Mode (sandbox editing) — Design

**Date:** 2026-07-20
**Status:** Approved, pending implementation plan

## Motivation

Multiple Reddit users requested a Basketball-GM-style "God Mode" — a sandbox
toggle that unlocks direct, guardrail-free edits to the world (player ratings,
potential, contracts, roster membership, club finances) plus creating players
from scratch. Everything shipped so far *simulates* a realistic world; God Mode
is a deliberately new axis that lets the user **override** the sim to build a
"dream league," debug, or experiment.

Scope agreed with the user for v1: **editable player attributes, roster
building (assign any player to any club), custom players (create from scratch),
and editing existing clubs (identity + finances + roster).** Adding/removing
clubs, hard-deleting players, and forcing match results are explicitly out of
scope.

## Activation & persistence

- New field `LeagueStore.godMode: boolean`. Migrated to `false` for every
  existing save in `src/db/migrate.ts`.
- An **always-visible toggle** lives in the sidebar footer (near the existing
  "Switch League" link), so it can be turned on or off mid-session for the
  active save. Enabling it:
  - reveals a new **"God Mode"** hub page link in the sidebar,
  - lights up the **"Edit"** affordances on the Player Profile page,
  - un-fogs potential across the whole app (see below).
- Disabling it hides all of the above again. The flag is purely a
  save-scoped switch — no penalty, no achievement tainting (the game has
  none).
- **All God Mode mutations are new `...Action` functions on `LeagueContext`**,
  routed through the same `runExclusive` promise chain + `saveLeague` that
  every other mutating action uses, so two quick edits can't compute from the
  same stale snapshot and lose a write.

## Un-fogging potential

While `godMode` is `true`, the scouting fog-of-war on potential is fully
bypassed: every player's **true POT** is shown everywhere in the app, not just
inside the editor. This is a single choke point — `PotDisplay`
(`src/ui/components/PotDisplay.tsx`) is the one component every raw
`{p.potential}` render already goes through. It reads `league.godMode` from
context and, when set, renders the exact number (skipping the
`potentialFog(...)` estimate). The underlying fog logic and
`scoutingObserved` tracking are untouched; only this display branch changes,
so turning God Mode back off restores normal fog immediately.

## Player editor (from Player Profile)

When God Mode is on, the **Player Profile page** (`src/ui/pages/PlayerProfile.tsx`)
grows an **"Edit"** button that opens a modal editing **any** player — the
user's own or any AI club's.

Editable fields (all confirmed in scope):

- All 14 skill ratings (`SKILL_KEYS`).
- **Potential** (`potential`).
- **Name** and **nationality**.
- **Age** (edited as born-year, or as an age that maps to `born`),
  **position** (`pos`), and **height** (`heightCm`).
- **Contract**: weekly wage (→ stored `salary`) and `expiresSeason`.
- A **"Clear injury"** action (sets `injury` to `null`).

Behavior:

- Editing ratings, position, or height **recomputes OVR live** via
  `computeOvr(pos, ratings, heightCm)` before persisting.
- The editor always displays **true POT** (independent of the global un-fog
  toggle, so the editor is correct even if that behavior is ever changed).
- Edits change the player **going forward**. Past `hist` and `stats`
  snapshots are **not** rewritten — the next offseason snapshot captures the
  new values, exactly like normal progression. (Same forward-only convention
  as scouting-tenure, per-season-team, and the OVR-history academy flag.)

Also surfaced on the profile when God Mode is on:

- **"Move to club…"** — a club picker that assigns the player to any club's
  senior roster instantly, with no fee/budget/cap check.
- **"Release to free agency"** — removes the player from his club's roster
  (this is the v1 removal path; there is no hard-delete from the world).

## God Mode hub page (`/god-mode`)

A dedicated page, in the sidebar only when God Mode is on, with three tools:

### Create Player
Build a new player from scratch. All fields from the player editor, plus:
- a fresh unique `pid` (max existing pid + 1),
- a single baseline `hist` snapshot at the current `season - 1` (mirrors what
  `generatePlayer` produces, so the OVR-history chart and history table have a
  starting point),
- empty `stats`, no injury,
- a contract (either user-specified or a sensible default from
  `contractTerms`).
Drop the new player onto any club's roster **or** into free agency (unrostered).

### Club roster builder
Pick any club and see its senior roster. From here:
- move a player to another club, remove a player (→ free agency), or pull any
  player / free agent from anywhere onto this club,
- **pure sandbox**: no transfer fee, no budget deduction, no `ROSTER_CAP`, no
  per-position depth floor.

### Club finances & identity
For any club:
- set **budget** and **hype** directly (raw number inputs, clamped only to
  sane bounds — e.g. hype 0–100),
- edit **name / abbrev / colors** by reusing the existing
  `TeamIdentityEditor` / `applyTeamIdentities` path.

## Correctness details

Any God Mode move or release must scrub the player's pid from transient
per-window / lineup state so no dangling reference reaches the match engine or
a UI list:

- `LeagueStore.negotiations`, `LeagueStore.inboundOffers`
- `LeagueStore.loanListings`, `LeagueStore.activeLoans`, `LeagueStore.loanRejections`
- the old club's `StoredTeam.transferListed`
- the old club's `StoredTeam.starters` (set to `null` if the moved/released pid
  was a starter, so `resolveXI` re-auto-picks a valid XI)
- the old and new clubs' `roster` / `academyRoster` arrays (a player is only
  ever in one club's arrays at a time)

A single shared helper (e.g. `detachPlayer(league, pid)`) should perform this
scrub so every God Mode path (move, release, and moving a created player) is
consistent.

## Out of scope for v1 (explicitly)

- Adding, deleting, or replacing **clubs** — the world is a fixed 20-per-league
  shape that scheduling and promotion/relegation both assume; variable league
  sizes are a much larger, riskier change.
- **Hard-deleting** a player from the world (dangling stats/awards/history
  references). Removal is release-to-free-agency only.
- **Forcing match results** / editing standings, box scores, or season history.

## Testing

- Unit-test the new core helpers (pure functions), especially `detachPlayer`
  (scrubs all transient arrays + fixes `starters`), the create-player factory
  (unique pid, baseline hist, OVR computed from ratings), and any edit helper
  that recomputes OVR.
- Migration test: an old save with no `godMode` field loads with `godMode:
  false`.
- Follow the project convention: scope test runs to touched files during
  development; run the full suite as the final gate.
- Browser-verify the end-to-end flows (toggle on → edit a player's ratings →
  OVR updates; create a player onto a club; move a player between clubs; set a
  club's budget; POT shows exact everywhere while on, fogged again when off).

## Manual & CLAUDE.md

- Add a **God Mode** section to the in-game Manual (`src/ui/pages/Manual.tsx`)
  describing what it unlocks and that it's a deliberate sandbox override of the
  realism sim — kept honest about what it does and doesn't touch.
- Add a God Mode entry to CLAUDE.md's feature ledger (this is a player-visible
  feature on a genuinely new axis).
