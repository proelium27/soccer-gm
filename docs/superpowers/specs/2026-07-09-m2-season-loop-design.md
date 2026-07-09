# M2 — Season Loop: Design Spec

**Date:** 2026-07-09
**Milestone:** M2
**Status:** Approved

## Overview

Add IndexedDB persistence, a web worker for off-thread simulation, and a minimal React UI so the user can create a league, pick a team, and sim through a 38-match season seeing standings and results update. Bootstrap 5 styling for a BBGM-like data-dense aesthetic.

## New Dependencies

- `react`, `react-dom` — UI framework
- `react-router-dom` — SPA routing for sidebar navigation
- `bootstrap` — CSS only (no jQuery), provides the BBGM-style tables/nav/badges
- `idb` — lightweight IndexedDB wrapper
- `vite` — dev server + production build (already in spec, not yet installed)
- `@vitejs/plugin-react` — Vite React support

## New Directories

```
src/
  db/              # IndexedDB persistence + JSON export/import
  worker/          # Web worker entry + typed message protocol
  ui/              # React app: pages, components, layout
```

## Data Layer (`src/db/`)

### Storage Model

Single IDB database `soccer-gm`, one object store `leagues` with auto-increment key `lid`. Each saved league is one document containing the full game state:

```ts
interface LeagueStore {
  lid: number;
  meta: {
    name: string;
    created: number;       // Date.now() at creation
    userTid: number;       // the user's chosen team
  };
  teams: StoredTeam[];     // 20 teams with identity + roster pids
  players: Player[];       // all ~500 players
  season: number;          // current season number (starts at 1)
  phase: "regular" | "offseason";
  schedule: ScheduleGame[];  // remaining unplayed fixtures
  played: PlayedMatch[];     // completed match results
}

interface StoredTeam {
  tid: number;
  name: string;
  abbrev: string;
  colors: [string, string];
  roster: number[];        // pids
}

interface ScheduleGame {
  matchday: number;        // 1–38
  home: number;            // tid
  away: number;            // tid
}
```

### API

- `createLeague(userTid: number): Promise<LeagueStore>` — generate league, assign team identities, build schedule, persist to IDB, return the stored state.
- `saveLeague(league: LeagueStore): Promise<void>` — overwrite the league document in IDB.
- `loadLeague(lid: number): Promise<LeagueStore>` — read from IDB.
- `listLeagues(): Promise<Array<{ lid: number; meta: LeagueMeta }>>` — for a future league-select screen; M2 supports one league at a time.
- `exportJSON(lid: number): Promise<void>` — serialize the league document and trigger a browser download as `.json`.
- `importJSON(file: File): Promise<LeagueStore>` — parse, validate shape, store in IDB, return.

## Schedule Improvements (`src/core/schedule.ts`)

Enhance scheduling to produce **matchdays**. A 20-team double round-robin has 380 matches across 38 matchdays (10 matches per matchday). Use a standard round-robin rotation algorithm to ensure no team plays twice in the same matchday.

Each `ScheduleGame` carries a `matchday: number` (1–38).

### Calendar Mapping

Map matchdays to approximate real-world months for the sim controls:

| Matchdays | Month     |
|-----------|-----------|
| 1–4       | August    |
| 5–8       | September |
| 9–13      | October   |
| 14–17     | November  |
| 18–21     | December  |
| 22        | January (transfer deadline) |
| 23–25     | January   |
| 26–29     | February  |
| 30–33     | March     |
| 34–36     | April     |
| 37–38     | May       |

"Sim to end of month" advances through the last matchday of the current month. "Sim to transfer deadline" advances through matchday 22. This mapping is a simple lookup table, not a real date system.

## Worker Protocol (`src/worker/`)

### Message Types

```ts
// UI → Worker
type WorkerCommand =
  | { type: "sim"; through: "game" | "month" | "deadline" | "season"; league: LeagueStore };

// Worker → UI
type WorkerResponse =
  | { type: "simResult"; league: LeagueStore };
```

### Sim Logic

When the worker receives a `sim` command:

1. Determine the target matchday based on `through`:
   - `"game"` → current matchday (the lowest matchday in `schedule`)
   - `"month"` → last matchday of the current calendar month
   - `"deadline"` → matchday 22
   - `"season"` → matchday 38
2. For each matchday up to and including the target:
   - Compute composites for all teams (using `leagueComposites`)
   - Sim each fixture via `simMatch`
   - Move the fixture from `schedule` to `played` with the result
3. If `schedule` is empty after sim, set `phase: "offseason"`
4. Post back the updated `LeagueStore`

Composites are recomputed once at the start of the sim batch (not per-matchday) since no roster changes happen during M2.

## Team Identity

A static list of 20 English-flavored fictional clubs, assigned to tids 0–19 during league generation:

```ts
const CLUBS: Array<{ name: string; abbrev: string; colors: [string, string] }> = [
  { name: "Ashworth City",       abbrev: "ASH", colors: ["#1a5276", "#f4d03f"] },
  { name: "Northdale United",    abbrev: "NTD", colors: ["#c0392b", "#ffffff"] },
  { name: "Greenbrook FC",       abbrev: "GBK", colors: ["#27ae60", "#1a1a1a"] },
  { name: "Kingsley Town",       abbrev: "KGS", colors: ["#8e44ad", "#ecf0f1"] },
  { name: "Hartfield Rovers",    abbrev: "HTF", colors: ["#2c3e50", "#e67e22"] },
  { name: "Dunmore Athletic",    abbrev: "DUN", colors: ["#1abc9c", "#2c3e50"] },
  { name: "Westbury Albion",     abbrev: "WBA", colors: ["#2980b9", "#ffffff"] },
  { name: "Foxhall Rangers",     abbrev: "FOX", colors: ["#d35400", "#1a1a1a"] },
  { name: "Stonebridge FC",      abbrev: "STN", colors: ["#7f8c8d", "#c0392b"] },
  { name: "Linfield City",       abbrev: "LIN", colors: ["#3498db", "#f1c40f"] },
  { name: "Bramford Town",       abbrev: "BRM", colors: ["#e74c3c", "#ecf0f1"] },
  { name: "Copperhill United",   abbrev: "COP", colors: ["#e67e22", "#2c3e50"] },
  { name: "Haleston Borough",    abbrev: "HAL", colors: ["#16a085", "#ffffff"] },
  { name: "Redmarsh Wanderers",  abbrev: "RED", colors: ["#c0392b", "#f4d03f"] },
  { name: "Thornwick City",      abbrev: "THW", colors: ["#34495e", "#1abc9c"] },
  { name: "Millhaven Athletic",  abbrev: "MIL", colors: ["#9b59b6", "#f39c12"] },
  { name: "Daleford FC",         abbrev: "DAL", colors: ["#2ecc71", "#ffffff"] },
  { name: "Ashborne Rovers",     abbrev: "ABR", colors: ["#e84393", "#2d3436"] },
  { name: "Whitmore Town",       abbrev: "WHT", colors: ["#0984e3", "#dfe6e9"] },
  { name: "Elmsgate United",     abbrev: "ELM", colors: ["#fdcb6e", "#2d3436"] },
];
```

Strongest team (tid 0) = Ashworth City, weakest (tid 19) = Elmsgate United. The strength ordering from `generateLeague` is preserved.

## UI Architecture

### Layout

- **Top bar:** App title ("Soccer GM"), current season + matchday label, sim controls dropdown (four buttons), export/import buttons.
- **Sidebar:** Collapsible sections mirroring BBGM:
  - **League:** Dashboard, Standings, Schedule
  - **Team:** Roster
- **Main content area:** Renders the active page.

### Pages

#### 1. New League / Team Select

Shown on first visit or when creating a new league. Displays the 20 teams in a list (name, colors as a small swatch). Click a team to select it, then "Start League" to create and persist the league.

#### 2. Dashboard

- Your team name and colors at the top
- Current record (W-D-L, points, league position)
- Next match (opponent, home/away, matchday)
- Sim control buttons: "Sim One Game", "Sim to End of Month", "Sim to Transfer Deadline", "Sim to End of Season"
- When season is over (`phase: "offseason"`): show final position, disable sim buttons

#### 3. Standings

Full 20-team league table in a Bootstrap `<table>`:
- Columns: Pos, Team, P, W, D, L, GF, GA, GD, Pts
- User's team row highlighted (e.g. Bootstrap `table-active` or a subtle background)
- Sorted by points → GD → GF → tid

#### 4. Schedule

Your team's 38 fixtures in a table:
- Columns: Matchday, Home, Score, Away
- Played matches show the score; upcoming matches show "–" or "vs"
- Most recent result highlighted

#### 5. Roster

Your team's players in a table:
- Columns: Name, Pos, OVR, Age
- Sorted by position group (GK → CB → FB → DM → CM → AM → W → ST), then OVR descending within position
- View-only for M2

### Routing

```
/              → redirect to /dashboard (if league exists) or /new-league
/new-league    → team select
/dashboard     → Dashboard
/standings     → Standings
/schedule      → Schedule
/roster        → Roster
```

## What M2 Does NOT Include

- No player management, transfers, or contract actions
- No box scores or per-player match stats (M3)
- No multi-season — season ends at matchday 38, phase becomes "offseason", no "advance to next season" button
- No formation or tactics controls
- No mentality shifts during matches
- No finances page (deferred)
- No stepping/animated sim progression — results appear instantly after worker responds

## Validation

- All existing M0 and M1 tests continue to pass (engine math unchanged)
- New unit tests for: matchday scheduling (correct grouping, no conflicts), IDB round-trip (save/load/export/import), worker protocol (sim advances correct number of matchdays)
- Manual verification: create a league, pick a team, sim through an entire season, confirm standings look realistic (champion 78–94 pts, bottom 15–32 pts per §8)
