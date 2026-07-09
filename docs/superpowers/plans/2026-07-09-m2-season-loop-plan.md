# M2 — Season Loop: Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-09-m2-season-loop-design.md`

## Build Order

Tasks are ordered by dependency. Each task lists exactly which files to create or modify. Tasks in the same phase have no dependencies on each other and can be built in parallel.

---

### Phase 1 — Core logic (no browser APIs, pure TypeScript)

#### Task 1.1: Team identity data

Create `src/core/teams/clubs.ts` with the static list of 20 clubs (name, abbrev, colors). Export a `CLUBS` array and a helper `assignIdentities(league: League): StoredTeam[]` that zips club identity onto tids.

**Files:**
- Create `src/core/teams/clubs.ts`

**Tests:**
- `test/core/clubs.test.ts` — `CLUBS` has 20 entries, all abbrevs are unique and 3 chars, `assignIdentities` maps tids correctly.

#### Task 1.2: Matchday scheduling

Replace `doubleRoundRobin` with a matchday-aware scheduler. Use a circle-method rotation: for N teams, N-1 rounds per half, pair teams by rotating all but one fixed team. Double it for home+away halves = 38 matchdays. Return `ScheduleGame[]` with `matchday` field.

Add calendar mapping: a `MATCHDAY_MONTHS` lookup table and helpers `currentMonth(matchday)`, `lastMatchdayOfMonth(matchday)`, `TRANSFER_DEADLINE_MATCHDAY = 22`.

**Files:**
- Rewrite `src/core/schedule.ts` — new `generateSchedule(teamIds: number[], rng: () => number): ScheduleGame[]` plus calendar helpers. Keep the old `Fixture` type exported for backward compat with M1's `simSeason` (or update `simSeason` to use the new type).
- Create `src/core/calendar.ts` — month mapping table and helpers.

**Tests:**
- `test/core/schedule.test.ts` — update existing tests: 380 games, 38 matchdays, 10 games per matchday, no team plays twice in the same matchday, every pair meets exactly once home and once away.
- `test/core/calendar.test.ts` — matchday 1→August, matchday 22→January, matchday 38→May, `lastMatchdayOfMonth` returns correct boundaries.

#### Task 1.3: LeagueStore types

Define the `LeagueStore`, `StoredTeam`, `ScheduleGame` interfaces and a `createLeagueState(userTid: number, rng: () => number): LeagueStore` pure function that generates a league, assigns identities, builds the schedule, and returns the full state object (no IDB dependency).

**Files:**
- Create `src/core/leagueState.ts` — types + `createLeagueState` function.
- Update `src/core/index.ts` — re-export new modules.

**Tests:**
- `test/core/leagueState.test.ts` — `createLeagueState` returns correct shape, 20 teams with names, 500 players, 380 scheduled games, `userTid` matches, phase is `"regular"`.

#### Task 1.4: Sim-through logic

A pure function `simThrough(league: LeagueStore, through: "game" | "month" | "deadline" | "season", rng: () => number): LeagueStore` that:
1. Computes composites once from the current roster/player state.
2. Determines the target matchday from `through` + current schedule state.
3. Sims each fixture in order up to the target matchday using `simMatch`.
4. Moves completed games from `schedule` to `played`.
5. Sets `phase: "offseason"` if schedule is empty.
6. Returns a new `LeagueStore` (immutable — does not mutate input).

This is the core sim logic the worker will call, but it has no worker/DOM dependency so it's fully testable in Node.

**Files:**
- Create `src/core/simThrough.ts`

**Tests:**
- `test/core/simThrough.test.ts` — sim `"game"` advances 1 matchday (10 games move to `played`), sim `"month"` advances to end of current month, sim `"deadline"` goes to matchday 22, sim `"season"` plays all remaining, phase becomes `"offseason"` after full season. Standings from a full sim-through should match §8 spread gates (champion 78–94 pts, bottom 15–32 pts).

---

### Phase 2 — Browser infrastructure (IDB, worker, Vite scaffold)

Depends on Phase 1 types being defined.

#### Task 2.1: Install dependencies + Vite scaffold

Install runtime and dev dependencies. Create the Vite config, `index.html`, and React entry point. Set up tsconfig adjustments for JSX and DOM types.

**Commands:**
- `npm install react react-dom react-router-dom bootstrap idb`
- `npm install -D vite @vitejs/plugin-react @types/react @types/react-dom`

**Files:**
- Create `vite.config.ts`
- Create `index.html` (Vite entry)
- Create `src/ui/main.tsx` (React root mount, imports bootstrap CSS)
- Create `src/ui/App.tsx` (placeholder with router)
- Update `tsconfig.json` — add `"jsx": "react-jsx"`, add `"dom"` to types for the `src/ui` scope (may need a separate `tsconfig.app.json` so Node-only code in `engine/` and `core/` doesn't get DOM types).
- Update `package.json` — add `"dev": "vite"` and `"build": "vite build"` scripts.

**Verify:** `npm run dev` starts, shows a blank page with "Soccer GM" text, no errors in console. `npm run typecheck` still passes. `npm test` still passes (existing tests unaffected).

#### Task 2.2: IndexedDB layer

Implement the `src/db/` module using `idb`.

**Files:**
- Create `src/db/database.ts` — `openDB` call, schema definition (one `leagues` object store with `lid` keyPath + autoIncrement).
- Create `src/db/leagueDb.ts` — `saveLeague`, `loadLeague`, `listLeagues`, `deleteLeague`.
- Create `src/db/exportImport.ts` — `exportJSON` (serialize + trigger download), `importJSON` (parse File, validate, store).
- Create `src/db/index.ts` — barrel export.

**Tests:**
- `test/db/leagueDb.test.ts` — Use `fake-indexeddb` (install as dev dep) to test round-trip: create → save → load returns same data. List returns the saved league. Export produces valid JSON. Import of that JSON restores the league. Invalid JSON import throws.

#### Task 2.3: Web worker

**Files:**
- Create `src/worker/protocol.ts` — `WorkerCommand` and `WorkerResponse` type definitions.
- Create `src/worker/simWorker.ts` — the worker entry. Listens for `WorkerCommand` messages, calls `simThrough`, posts back `WorkerResponse`. Uses `mulberry32` with a seed derived from the league state (e.g. `lid * 1000 + played.length` so each sim batch is deterministic but different).
- Create `src/ui/useSimWorker.ts` — React hook that spawns the worker, provides a `sim(through, league)` function, and returns the result via state. Handles the `postMessage` / `onmessage` dance.

**Tests:**
- Worker logic is tested indirectly through `simThrough` tests (Task 1.4). The hook is tested via the UI integration (manual).

---

### Phase 3 — UI pages

Depends on Phase 2 scaffold being runnable.

#### Task 3.1: Layout shell (top bar + sidebar + routing)

**Files:**
- Create `src/ui/components/TopBar.tsx` — app title, season/matchday label, sim controls dropdown, export/import buttons.
- Create `src/ui/components/Sidebar.tsx` — nav links grouped by section (League: Dashboard, Standings, Schedule; Team: Roster). Active link highlighted.
- Create `src/ui/components/Layout.tsx` — combines TopBar + Sidebar + `<Outlet>` for page content.
- Update `src/ui/App.tsx` — set up `react-router-dom` with Layout as the parent route and child routes for each page.
- Create `src/ui/styles.css` — minimal custom CSS on top of Bootstrap (sidebar width, layout grid, team-highlight color).

#### Task 3.2: League context + New League page

**Files:**
- Create `src/ui/context/LeagueContext.tsx` — React context that holds the current `LeagueStore | null`, provides `setLeague`, `simAction` (calls the worker hook), `save`, `export`, `import` functions. Loads from IDB on mount.
- Create `src/ui/pages/NewLeague.tsx` — lists 20 teams (color swatch + name), click to select, "Start League" button calls `createLeagueState` → saves to IDB → navigates to `/dashboard`.
- Update `src/ui/App.tsx` — `/` redirects to `/dashboard` if league exists, else `/new-league`.

#### Task 3.3: Dashboard page

**Files:**
- Create `src/ui/pages/Dashboard.tsx` — shows user team name/colors, current record (W-D-L, points, position from computed standings), next match info, sim buttons. Buttons call `simAction` from context, which posts to worker and updates state + IDB on result. In offseason phase, disable sim buttons and show final position.

#### Task 3.4: Standings page

**Files:**
- Create `src/ui/pages/Standings.tsx` — full league table using Bootstrap `<table class="table table-striped">`. Calls `computeStandings` from the league's `played` array. User's team row gets `table-active` class. Columns: #, Team, P, W, D, L, GF, GA, GD, Pts.

#### Task 3.5: Schedule page

**Files:**
- Create `src/ui/pages/Schedule.tsx` — filters played + scheduled games for the user's team. Table columns: Matchday, Home, Score, Away. Played games show score; upcoming show "vs". Most recent result gets a subtle highlight.

#### Task 3.6: Roster page

**Files:**
- Create `src/ui/pages/Roster.tsx` — player table for user's team. Columns: Name, Pos, OVR, Age. Sorted by position group order (GK→ST), then OVR descending within group. Age computed as `season - player.born`. View-only.

---

### Phase 4 — Integration + polish

#### Task 4.1: Sim controls in top bar

Wire the TopBar sim dropdown buttons to the `LeagueContext.simAction`. Show a brief loading state while the worker is running. After the worker responds, the context updates the league state, saves to IDB, and all pages re-render with fresh data.

Wire export button to `LeagueContext.export`, import button to a file input that calls `LeagueContext.import`.

**Files:**
- Update `src/ui/components/TopBar.tsx`
- Update `src/ui/context/LeagueContext.tsx` if needed.

#### Task 4.2: Existing test suite passes

Ensure all M0 and M1 tests still pass. The `tsconfig` changes for JSX/DOM must not break Node-only test imports. May need a `tsconfig.node.json` for scripts/tests and `tsconfig.app.json` for the UI, with the base `tsconfig.json` as a shared root.

**Verify:**
- `npm test` — all existing + new tests pass.
- `npm run typecheck` — no errors.
- `npm run dev` — app loads, create league, sim through a full season, standings look realistic.

#### Task 4.3: Manual verification

- Create a new league, pick a team.
- Sim one game — standings update, schedule shows the result.
- Sim to end of month — multiple matchdays advance.
- Sim to transfer deadline — advances to matchday 22.
- Sim to end of season — all 380 matches played, phase is offseason, sim buttons disabled.
- Check standings: champion should have 78–94 pts, bottom should have 15–32 pts.
- Export JSON, delete league, import JSON — league restores correctly.
- Roster page shows players sorted by position.

---

## File Summary

### New files (20)
```
src/core/teams/clubs.ts
src/core/calendar.ts
src/core/leagueState.ts
src/core/simThrough.ts
src/db/database.ts
src/db/leagueDb.ts
src/db/exportImport.ts
src/db/index.ts
src/worker/protocol.ts
src/worker/simWorker.ts
src/ui/main.tsx
src/ui/App.tsx
src/ui/styles.css
src/ui/useSimWorker.ts
src/ui/context/LeagueContext.tsx
src/ui/components/TopBar.tsx
src/ui/components/Sidebar.tsx
src/ui/components/Layout.tsx
src/ui/pages/NewLeague.tsx
src/ui/pages/Dashboard.tsx
src/ui/pages/Standings.tsx
src/ui/pages/Schedule.tsx
src/ui/pages/Roster.tsx
vite.config.ts
index.html
```

### Modified files (4)
```
src/core/schedule.ts        — rewrite with matchday grouping
src/core/index.ts           — add re-exports
tsconfig.json               — JSX + DOM config
package.json                — new deps + scripts
```

### New test files (5)
```
test/core/clubs.test.ts
test/core/calendar.test.ts
test/core/leagueState.test.ts
test/core/simThrough.test.ts
test/db/leagueDb.test.ts
```
