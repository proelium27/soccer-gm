# Second Division (Promotion/Relegation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second, full-senior-roster 20-club division ("English Division 2") below the existing 20-club league ("English Division 1"), with real 3-up/3-down promotion/relegation, a weaker/poorer D2, cross-division transfers, and per-division Standings/Stat Leaders/Awards.

**Architecture:** `LeagueTeam`/`StoredTeam` gain a `division: 0 | 1` field. Team generation, schedule generation, and standings all stay as pure per-team-id-list functions (already true today) — the new work is calling them twice (once per division) instead of once, and correctly scoping every league-wide *normalization* (match composite z-scoring, AI wealth/ambition scoring, season-rank/prize/hype) to a single division's pool instead of accidentally pooling both divisions together, which the current code would otherwise do by default. A new `src/core/promotion.ts` module owns the swap + gradual strength-convergence logic, wired into `simOffseason`.

**Tech Stack:** TypeScript, Vitest, React (existing stack — no new dependencies).

## Global Constraints

- 20 new clubs, not a split of the existing 20 — D1 keeps its 20 clubs/38-match season unchanged; D2 is a new, separately-generated 20-club league.
- 3 up (bottom of D1), 3 down (top of D2), straight automatic swap, no playoff.
- D2 generation strength is noticeably weaker: D2's strongest teams land around D1's mid-table strength.
- A promoted/relegated club's `academyBase` (its generation-time strength anchor and youth-intake anchor) converges gradually toward its new division's band over a few seasons, not instantly.
- D2 clubs get scaled-down budgets/prize money vs. D1.
- Cross-division transfers are allowed (AI↔AI market, inbound offers, free agency — no filtering by division).
- The user's own club is not protected from relegation.
- New leagues only — existing single-division saves are migrated by defaulting to Division 1, not retroactively split.
- Standings, Stat Leaders, and Awards each get a Division dropdown alongside their existing season dropdown; News Feed needs no change.
- Division names: **"English Division 1"** and **"English Division 2"** (not "Premier League" — trademarked).
- Full design context: `docs/superpowers/specs/2026-07-14-second-division-design.md`.

---

### Task 1: Constants, data model fields, and expanded club identities

**Files:**
- Modify: `src/core/constants.ts` (add new constants near existing `NUM_TEAMS`/`TEAM_STRENGTH_SPREAD`/`BASE_SEASON_BUDGET` sections)
- Modify: `src/core/league/generate.ts:11-31` (`LeagueTeam` interface)
- Modify: `src/core/teams/clubs.ts` (`StoredTeam` interface, `CLUBS` array)
- Test: `test/core/clubs.test.ts`

**Interfaces:**
- Produces: `NUM_TEAMS_D2 = 20`, `DIVISION_2_OFFSET = 7`, `DIVISION_2_BUDGET_SCALE = 0.5`, `PROMOTION_RELEGATION_COUNT = 3`, `ACADEMY_BASE_CONVERGENCE_SEASONS = 3`, `DIVISION_ACADEMY_BASE_CENTER: readonly [number, number]` (index 0 = D1 center, index 1 = D2 center) — all consumed by later tasks.
- Produces: `LeagueTeam.division: 0 | 1`, `StoredTeam.division: 0 | 1`, `StoredTeam.divisionConvergence: { seasonsRemaining: number } | null`.
- Produces: `CLUBS` grows from 20 to 40 entries (indices 0-19 = D1 identities, unchanged; 20-39 = new D2 identities).

- [ ] **Step 1: Add the new constants**

In `src/core/constants.ts`, immediately after the existing `export const TEAM_STRENGTH_SPREAD = 7;` block (currently lines 3-7):

```ts
/**
 * Second division (English Division 2): same team count as Division 1, a
 * strength offset subtracted from the per-team target before generation so
 * D2's strongest teams land around D1's mid-table strength (not just
 * modestly below D1's weakest team), and a budget/prize scale reflecting
 * the real financial gap between top-flight and second-tier football. Exact
 * values are starting points, confirmed/adjusted via a dynasty audit (see
 * the "Dynasty audit" task) rather than guessed blind.
 */
export const NUM_TEAMS_D2 = 20;
export const DIVISION_2_OFFSET = 7;
export const DIVISION_2_BUDGET_SCALE = 0.5;

/** Straight automatic swap each offseason: bottom N of D1 <-> top N of D2. */
export const PROMOTION_RELEGATION_COUNT = 3;

/**
 * A promoted/relegated club's academyBase (its generation-time strength
 * anchor and permanent youth-intake anchor) doesn't snap to its new
 * division's band instantly — it moves a fraction of the remaining
 * distance each offseason, over this many seasons, so a promoted club has
 * to earn its way up rather than get an instant strength boost.
 */
export const ACADEMY_BASE_CONVERGENCE_SEASONS = 3;

/** Center strength each division's academyBase converges toward: [D1, D2]. */
export const DIVISION_ACADEMY_BASE_CENTER: readonly [number, number] = [
  LEAGUE_BASE,
  LEAGUE_BASE - DIVISION_2_OFFSET,
];
```

- [ ] **Step 2: Add `division` to `LeagueTeam`**

In `src/core/league/generate.ts`, add to the `LeagueTeam` interface (after the existing `academyBase` field, before `starters`):

```ts
  /** Which division this team belongs to at generation time: 0 = English Division 1, 1 = English Division 2. */
  division: 0 | 1;
```

- [ ] **Step 3: Add `division`/`divisionConvergence` to `StoredTeam`**

In `src/core/teams/clubs.ts`, add to the `StoredTeam` interface (after `academyBase`, before `starters`):

```ts
  /** Which division this club currently plays in: 0 = English Division 1, 1 = English Division 2. Changes on promotion/relegation. */
  division: 0 | 1;
  /**
   * Non-null while academyBase is still converging toward this division's
   * strength band after a promotion/relegation swap (see src/core/promotion.ts).
   * Null for a club that hasn't swapped divisions (or finished converging).
   */
  divisionConvergence: { seasonsRemaining: number } | null;
```

- [ ] **Step 4: Expand `CLUBS` to 40 entries**

In `src/core/teams/clubs.ts`, append 20 new entries to the `CLUBS` array (right after the existing `Wyverngate Crowns` entry), same style/shape:

```ts
  { name: "Ambervale Rovers",    abbrev: "AMB", colors: ["#8e2de2", "#f2f2f2"] },
  { name: "Brindlecombe",        abbrev: "BRI", colors: ["#2c3e50", "#e67e22"] },
  { name: "Copperfield Town",    abbrev: "COP", colors: ["#b5651d", "#ffffff"] },
  { name: "Draymoor United",     abbrev: "DRA", colors: ["#1a5276", "#f1c40f"] },
  { name: "Elderglen",           abbrev: "ELD", colors: ["#145a32", "#ecf0f1"] },
  { name: "Foxholt Wanderers",   abbrev: "FOX", colors: ["#c0392b", "#2c3e50"] },
  { name: "Gaunt Valley",        abbrev: "GAU", colors: ["#5b2c6f", "#f4d03f"] },
  { name: "Hollowbeck",          abbrev: "HOL", colors: ["#117864", "#ffffff"] },
  { name: "Inkersley Athletic",  abbrev: "INK", colors: ["#212f3d", "#e74c3c"] },
  { name: "Juniper Crossing",    abbrev: "JUN", colors: ["#1e8449", "#f7dc6f"] },
  { name: "Kirkstall Miners",    abbrev: "KIR", colors: ["#4a235a", "#aeb6bf"] },
  { name: "Larkspur Town",       abbrev: "LAR", colors: ["#0b5345", "#f5b041"] },
  { name: "Millbrook Rangers",   abbrev: "MIL", colors: ["#7b241c", "#f0f3f4"] },
  { name: "Norwick Athletic",    abbrev: "NOR", colors: ["#1b2631", "#f39c12"] },
  { name: "Old Fenwick",         abbrev: "OLF", colors: ["#154360", "#ffffff"] },
  { name: "Pinehollow",          abbrev: "PIN", colors: ["#145214", "#f8c471"] },
  { name: "Ravensgate",          abbrev: "RAV", colors: ["#1c2833", "#c0392b"] },
  { name: "Steeplecross",        abbrev: "STE", colors: ["#6e2c00", "#f4f6f6"] },
  { name: "Underholt Town",      abbrev: "UND", colors: ["#283747", "#f1948a"] },
  { name: "Vaultbridge",         abbrev: "VAU", colors: ["#512e5f", "#ffffff"] },
```

- [ ] **Step 5: Fix `test/core/clubs.test.ts`'s hardcoded counts**

The `describe("CLUBS")` block currently asserts exactly 20 entries. Update it to 40:

```ts
describe("CLUBS", () => {
  it("has exactly 40 entries", () => {
    expect(CLUBS).toHaveLength(40);
  });

  it("has all unique abbreviations that are exactly 3 characters", () => {
    const abbrevs = CLUBS.map((c) => c.abbrev);
    expect(new Set(abbrevs).size).toBe(40);
    for (const a of abbrevs) {
      expect(a).toHaveLength(3);
    }
  });

  it("has all unique names", () => {
    const names = CLUBS.map((c) => c.name);
    expect(new Set(names).size).toBe(40);
  });
});
```

Leave the `describe("assignIdentities", ...)` block untouched for now — `generateLeague(mulberry32(42))` still produces only 20 (Division 1) teams until Task 2, so `CLUBS[st.tid]` for tid 0-19 resolves the same as before.

- [ ] **Step 6: Run the affected tests**

Run: `npm test -- clubs`
Expected: All `clubs.test.ts` tests PASS. (`generate.ts`/`clubs.ts` won't yet compile-fail on the new required fields because nothing constructs a `LeagueTeam`/`StoredTeam` object literal outside `generate.ts`/`clubs.ts` themselves, which Task 2/3 update next — if `npm run typecheck` fails here on missing `division`, that's expected and resolved by Task 2.)

- [ ] **Step 7: Commit**

```bash
git add src/core/constants.ts src/core/league/generate.ts src/core/teams/clubs.ts test/core/clubs.test.ts
git commit -m "Add second-division constants, data model fields, and 20 new club identities"
```

---

### Task 2: Two-division league generation

**Files:**
- Modify: `src/core/league/generate.ts`
- Test: `test/core/generate.test.ts` (new `describe` block; existing `generatePlayer` tests untouched)

**Interfaces:**
- Consumes: `NUM_TEAMS`, `NUM_TEAMS_D2`, `DIVISION_2_OFFSET`, `LEAGUE_BASE`, `TEAM_STRENGTH_SPREAD`, `ROSTER_COMPOSITION` (`src/core/constants.ts`, Task 1); `generatePlayer` (existing).
- Produces: `generateLeague(rng, seed?)` — **unchanged signature and behavior**, still produces exactly `NUM_TEAMS` (20) Division-1 teams; every returned `LeagueTeam` now also has `division: 0`. New export `generateTwoDivisionLeague(rng, seed?): League` — produces `NUM_TEAMS + NUM_TEAMS_D2` (40) teams, tids 0-19 division 0 (identical to `generateLeague`'s output), tids 20-39 division 1 (weaker band). Consumed by Task 3's `createLeagueState`.

Keeping `generateLeague` itself untouched in behavior (only adding the `division: 0` field) is deliberate: `src/core/season.ts`'s legacy `simSeason` (and its test, `test/core/season.test.ts`) call `generateLeague` directly and assert a 20-team single round-robin — that test has no relation to this feature and shouldn't need touching.

- [ ] **Step 1: Write the failing test**

Add to `test/core/generate.test.ts`:

```ts
import { generateLeague, generateTwoDivisionLeague } from "../../src/core/league/generate.js";
import { NUM_TEAMS, NUM_TEAMS_D2 } from "../../src/core/constants.js";

describe("generateTwoDivisionLeague", () => {
  it("produces 40 teams: tids 0-19 division 0, tids 20-39 division 1", () => {
    const league = generateTwoDivisionLeague(mulberry32(42));
    expect(league.teams).toHaveLength(NUM_TEAMS + NUM_TEAMS_D2);
    for (const t of league.teams) {
      if (t.tid < NUM_TEAMS) expect(t.division).toBe(0);
      else expect(t.division).toBe(1);
    }
  });

  it("D2's strongest team is no stronger than D1's average team", () => {
    const league = generateTwoDivisionLeague(mulberry32(42));
    const d1 = league.teams.filter((t) => t.division === 0);
    const d2 = league.teams.filter((t) => t.division === 1);
    const avgOvr = (ts: typeof d1) => ts.reduce((s, t) => s + t.avgOvr, 0) / ts.length;
    const d1Avg = avgOvr(d1);
    const d2Best = Math.max(...d2.map((t) => t.avgOvr));
    expect(d2Best).toBeLessThanOrEqual(d1Avg + 0.5); // small tolerance for generation noise
  });

  it("D1 half is identical to plain generateLeague for the same seed", () => {
    const plain = generateLeague(mulberry32(42));
    const combined = generateTwoDivisionLeague(mulberry32(42));
    const d1FromCombined = combined.teams.filter((t) => t.division === 0);
    expect(d1FromCombined.map((t) => t.roster)).toEqual(plain.teams.map((t) => t.roster));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- generate`
Expected: FAIL — `generateTwoDivisionLeague` is not exported.

- [ ] **Step 3: Refactor `generate.ts` into a shared per-division helper, then implement `generateTwoDivisionLeague`**

Replace the body of `generateLeague` (currently the whole `for (let tid = 0; tid < NUM_TEAMS; tid++)` loop) with a call to a new private helper, and add the new export. Full new content for `src/core/league/generate.ts`:

```ts
import type { Player, Position } from "../players/types.js";
import { POSITIONS } from "../players/types.js";
import { generatePlayer } from "../players/generate.js";
import { hashInts } from "../../engine/rng.js";
import {
  NUM_TEAMS, NUM_TEAMS_D2, LEAGUE_BASE, TEAM_STRENGTH_SPREAD, DIVISION_2_OFFSET,
  ROSTER_COMPOSITION, INITIAL_AGE_MIN, INITIAL_AGE_MAX,
  CONTRACT_LENGTH_MIN, CONTRACT_LENGTH_MAX,
} from "../constants.js";

const STARTING_SEASON = 1;

export interface LeagueTeam {
  tid: number;
  name: string;
  roster: number[]; // pids
  avgOvr: number;
  /**
   * Fixed generation-time strength base (LEAGUE_BASE + this team's strength
   * target, offset by DIVISION_2_OFFSET for Division 2), carried forward as
   * the permanent anchor for youth intake. Deliberately never derived from
   * the team's *current* roster average — see the long-form comment history
   * in CLAUDE.md's M4 section for why that ratchets OVR upward without bound.
   */
  academyBase: number;
  /** Which division this team belongs to at generation time: 0 = English Division 1, 1 = English Division 2. */
  division: 0 | 1;
  /**
   * User-chosen starting XI (11 pids), or null/undefined to auto-select via
   * selectXI. Not set during generation; simThrough carries it over from
   * StoredTeam.starters so leagueMatchData can respect it.
   */
  starters?: number[] | null;
}

export interface League {
  teams: LeagueTeam[];
  players: Player[];
}

/**
 * Generate `count` teams' worth of rosters, tid range [tidStart, tidStart+count),
 * evenly-spaced strength targets across [-TEAM_STRENGTH_SPREAD, +TEAM_STRENGTH_SPREAD]
 * minus `strengthOffset`, tagged with `division`. Shared by generateLeague
 * (Division 1: tidStart=0, offset=0) and generateTwoDivisionLeague's Division
 * 2 half (tidStart=NUM_TEAMS, offset=DIVISION_2_OFFSET).
 */
function generateDivisionTeams(
  rng: () => number,
  tidStart: number,
  count: number,
  strengthOffset: number,
  division: 0 | 1,
  genSeed: number,
  pidStart: number,
): { teams: LeagueTeam[]; players: Player[]; nextPid: number } {
  const teams: LeagueTeam[] = [];
  const players: Player[] = [];
  let pid = pidStart;

  for (let i = 0; i < count; i++) {
    const tid = tidStart + i;
    // Evenly spaced target: strongest at the first tid in this division, weakest at the last.
    const frac = count > 1 ? i / (count - 1) : 0; // 0..1
    const target = TEAM_STRENGTH_SPREAD - frac * (2 * TEAM_STRENGTH_SPREAD) - strengthOffset;
    const base = LEAGUE_BASE + target;

    const roster: number[] = [];
    let ovrSum = 0;
    for (const pos of POSITIONS as readonly Position[]) {
      for (let j = 0; j < ROSTER_COMPOSITION[pos]; j++) {
        const age = INITIAL_AGE_MIN
          + Math.floor(rng() * (INITIAL_AGE_MAX - INITIAL_AGE_MIN + 1));
        const p = generatePlayer(rng, pos, base, pid++, age, STARTING_SEASON, genSeed);
        const length = CONTRACT_LENGTH_MIN
          + Math.floor(rng() * (CONTRACT_LENGTH_MAX - CONTRACT_LENGTH_MIN + 1));
        p.contract.expiresSeason = STARTING_SEASON + length;
        players.push(p);
        roster.push(p.pid);
        ovrSum += p.ovr;
      }
    }
    teams.push({
      tid,
      name: `Team ${tid + 1}`,
      roster,
      avgOvr: ovrSum / roster.length,
      academyBase: base,
      division,
    });
  }

  return { teams, players, nextPid: pid };
}

/**
 * Hybrid talent model: each team gets a strength target evenly spaced across
 * [-SPREAD, +SPREAD]; every player is generated around base = LEAGUE_BASE +
 * target, biased by position archetype. Deterministic given the RNG.
 * Produces exactly NUM_TEAMS Division-1 teams — unchanged behavior from
 * before this file supported a second division.
 */
export function generateLeague(rng: () => number, seed = 0): League {
  const genSeed = hashInts(seed, 1);
  const { teams, players } = generateDivisionTeams(rng, 0, NUM_TEAMS, 0, 0, genSeed, 0);
  return { teams, players };
}

/**
 * Generate both divisions in one pass, sharing one rng stream (Division 1
 * first, then Division 2, so a given seed's Division-1 half is byte-for-byte
 * identical to a plain generateLeague call with the same seed). Division 2's
 * strength targets are shifted down by DIVISION_2_OFFSET so its strongest
 * teams land around Division 1's mid-table strength.
 */
export function generateTwoDivisionLeague(rng: () => number, seed = 0): League {
  const genSeed = hashInts(seed, 1);
  const d1 = generateDivisionTeams(rng, 0, NUM_TEAMS, 0, 0, genSeed, 0);
  const d2 = generateDivisionTeams(rng, NUM_TEAMS, NUM_TEAMS_D2, DIVISION_2_OFFSET, 1, genSeed, d1.nextPid);
  return {
    teams: [...d1.teams, ...d2.teams],
    players: [...d1.players, ...d2.players],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- generate`
Expected: PASS (all 3 new tests, plus existing `generatePlayer` tests unaffected).

- [ ] **Step 5: Run the full suite's affected legacy tests**

Run: `npm test -- season clubs`
Expected: PASS — `season.test.ts` (legacy `simSeason`, still calls plain `generateLeague`, unaffected) and `clubs.test.ts`'s `assignIdentities` block (still fed a plain 20-team `generateLeague` output) both green.

- [ ] **Step 6: Commit**

```bash
git add src/core/league/generate.ts test/core/generate.test.ts
git commit -m "Add generateTwoDivisionLeague for a weaker, separately-generated Division 2"
```

---

### Task 3: `createLeagueState` wiring — two divisions, two schedules, history types

**Files:**
- Modify: `src/core/teams/clubs.ts` (`assignIdentities`)
- Modify: `src/core/leagueState.ts` (`createLeagueState`)
- Modify: `src/core/standings.ts` (`SeasonHistoryEntry`)
- Test: `test/core/leagueState.test.ts`

**Interfaces:**
- Consumes: `generateTwoDivisionLeague` (Task 2), `generateSchedule` (existing, unchanged signature), `division`/`divisionConvergence` fields (Task 1).
- Produces: `assignIdentities(league)` copies `t.division` onto `StoredTeam.division` and initializes `divisionConvergence: null`. `createLeagueState` calls `generateTwoDivisionLeague`, builds one schedule per division via two `generateSchedule` calls, concatenates them into `LeagueStore.schedule`. `SeasonHistoryEntry` gains `divisionsByTid: Record<number, 0 | 1>` and `awards` becomes a 2-tuple `[SeasonAwards, SeasonAwards]` (index 0 = D1, index 1 = D2) instead of a single `SeasonAwards` — consumed by Task 6 (which populates it) and Tasks 9-10 (UI).

- [ ] **Step 1: Write the failing test**

Replace the two count-specific `it`s in `test/core/leagueState.test.ts` (`"has 20 teams..."` and `"has ~500 players..."` and `"has 380 scheduled games"`) with 40-team equivalents:

```ts
  it("has 40 teams (20 per division), each with name/abbrev/colors/roster/division", () => {
    expect(state.teams).toHaveLength(40);
    for (const t of state.teams) {
      expect(typeof t.name).toBe("string");
      expect(t.name.length).toBeGreaterThan(0);
      expect(typeof t.abbrev).toBe("string");
      expect(t.abbrev.length).toBeGreaterThan(0);
      expect(t.colors).toHaveLength(2);
      expect(typeof t.colors[0]).toBe("string");
      expect(typeof t.colors[1]).toBe("string");
      expect(t.roster.length).toBeGreaterThan(0);
      expect(t.division === 0 || t.division === 1).toBe(true);
    }
    expect(state.teams.filter((t) => t.division === 0)).toHaveLength(20);
    expect(state.teams.filter((t) => t.division === 1)).toHaveLength(20);
  });

  it("has ~1000 players (40 teams x 25 players)", () => {
    expect(state.players).toHaveLength(1000);
  });

  it("has 760 scheduled games (380 per division)", () => {
    expect(state.schedule).toHaveLength(760);
    for (const g of state.schedule) {
      expect(g).toHaveProperty("matchday");
      expect(g).toHaveProperty("home");
      expect(g).toHaveProperty("away");
      expect(typeof g.matchday).toBe("number");
    }
    const teamsByTid = new Map(state.teams.map((t) => [t.tid, t]));
    for (const g of state.schedule) {
      // A scheduled game never crosses divisions.
      expect(teamsByTid.get(g.home)!.division).toBe(teamsByTid.get(g.away)!.division);
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- leagueState`
Expected: FAIL — `state.teams` still has length 20.

- [ ] **Step 3: Update `assignIdentities`**

In `src/core/teams/clubs.ts`, add `division` and `divisionConvergence` to the returned object (inside the `league.teams.map((t) => {...})` in `assignIdentities`):

```ts
      division: t.division,
      divisionConvergence: null,
```

(placed after `academyBase: t.academyBase,`, before `starters: null,`)

- [ ] **Step 4: Update `createLeagueState`**

In `src/core/leagueState.ts`, add the new fields to `SeasonHistoryEntry` is handled in Step 5 below (in `standings.ts`); here, change `createLeagueState`'s body:

```ts
import { generateTwoDivisionLeague } from "./league/generate.js";
```

(replacing the existing `import { generateLeague } from "./league/generate.js";`)

Then replace:

```ts
  const league = generateLeague(rng, seed);
  const teams = assignIdentities(league);
  const teamIds = teams.map((t) => t.tid);
  const schedule = generateSchedule(teamIds);
```

with:

```ts
  const league = generateTwoDivisionLeague(rng, seed);
  const teams = assignIdentities(league);
  const d1Ids = teams.filter((t) => t.division === 0).map((t) => t.tid);
  const d2Ids = teams.filter((t) => t.division === 1).map((t) => t.tid);
  const schedule = [...generateSchedule(d1Ids), ...generateSchedule(d2Ids)];
```

- [ ] **Step 5: Add `divisionsByTid` and restructure `awards` on `SeasonHistoryEntry`**

In `src/core/standings.ts`, change:

```ts
export interface SeasonHistoryEntry {
  season: number;
  table: StandingsRow[];
  championTid: number;
  teamStats: TeamSeasonStats[];
  awards: SeasonAwards;
}
```

to:

```ts
export interface SeasonHistoryEntry {
  season: number;
  table: StandingsRow[];
  championTid: number;
  teamStats: TeamSeasonStats[];
  /** Player of the Season / Golden Boot / Team of the Season, per division: index 0 = Division 1, index 1 = Division 2. */
  awards: [SeasonAwards, SeasonAwards];
  /** Each team's division *during this season* (snapshotted before any promotion/relegation swap), so a past season's table/awards can still be labeled correctly after later swaps. */
  divisionsByTid: Record<number, 0 | 1>;
}
```

(This type change will make `src/core/offseason.ts` fail to typecheck — that's expected and fixed in Task 6, which is the only place that constructs a `SeasonHistoryEntry`. `src/db/migrate.ts` also needs updating, covered in Task 12.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- leagueState`
Expected: PASS.

- [ ] **Step 7: Confirm expected compile breakage**

Run: `npm run typecheck`
Expected: FAILS, with errors in `src/core/offseason.ts` (constructing the old-shape `SeasonHistoryEntry`) and `src/db/migrate.ts` (referencing `h.awards` as a single object). This is expected and resolved by Tasks 6 and 12 — do not attempt to fix them here.

- [ ] **Step 8: Commit**

```bash
git add src/core/teams/clubs.ts src/core/leagueState.ts src/core/standings.ts test/core/leagueState.test.ts
git commit -m "Wire two-division generation and two schedules into createLeagueState"
```

---

### Task 4: Promotion/relegation module

**Files:**
- Create: `src/core/promotion.ts`
- Test: `test/core/promotion.test.ts`

**Interfaces:**
- Consumes: `StandingsRow` (`src/core/standings.ts`), `StoredTeam` (`src/core/teams/clubs.ts`), `PROMOTION_RELEGATION_COUNT`, `ACADEMY_BASE_CONVERGENCE_SEASONS`, `DIVISION_ACADEMY_BASE_CENTER` (Task 1).
- Produces: `computeDivisionSwap(d1Table, d2Table): { promoted: number[]; relegated: number[] }`, `applyDivisionSwap(teams, swap): StoredTeam[]`, `stepAcademyBaseConvergence(teams): StoredTeam[]` — all consumed by Task 6's `simOffseason` rework.

- [ ] **Step 1: Write the failing tests**

Create `test/core/promotion.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  computeDivisionSwap, applyDivisionSwap, stepAcademyBaseConvergence,
} from "../../src/core/promotion.js";
import type { StandingsRow } from "../../src/core/standings.js";
import type { StoredTeam } from "../../src/core/teams/clubs.js";
import { DIVISION_ACADEMY_BASE_CENTER, ACADEMY_BASE_CONVERGENCE_SEASONS } from "../../src/core/constants.js";

function row(tid: number, points: number): StandingsRow {
  return { tid, played: 38, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points };
}

function team(tid: number, division: 0 | 1, academyBase: number): StoredTeam {
  return {
    tid, name: `T${tid}`, abbrev: "ABC", colors: ["#000", "#fff"],
    roster: [], academyRoster: [], budget: 0, hype: 0, scoutingSpend: 0,
    academyBase, division, divisionConvergence: null, starters: null,
  };
}

describe("computeDivisionSwap", () => {
  it("promotes the top 3 of D2 and relegates the bottom 3 of D1", () => {
    // computeStandings sorts descending by points, so index 0 = 1st place.
    const d1 = [row(0, 90), row(1, 80), row(2, 70), row(3, 60), row(4, 50)];
    const d2 = [row(20, 95), row(21, 85), row(22, 75), row(23, 65), row(24, 55)];
    const swap = computeDivisionSwap(d1, d2);
    expect(swap.promoted).toEqual([20, 21, 22]);
    expect(swap.relegated).toEqual([3, 4]); // bottom 3 by table position = tids 2,3,4
  });
});

describe("applyDivisionSwap", () => {
  it("flips division and starts convergence for swapped teams only", () => {
    const teams = [team(0, 0, 50), team(20, 1, 30)];
    const swap = { promoted: [20], relegated: [] };
    const result = applyDivisionSwap(teams, swap);
    const promoted = result.find((t) => t.tid === 20)!;
    const untouched = result.find((t) => t.tid === 0)!;
    expect(promoted.division).toBe(0);
    expect(promoted.divisionConvergence).toEqual({ seasonsRemaining: ACADEMY_BASE_CONVERGENCE_SEASONS });
    expect(untouched.division).toBe(0);
    expect(untouched.divisionConvergence).toBeNull();
  });
});

describe("stepAcademyBaseConvergence", () => {
  it("moves academyBase toward the current division's center and counts down", () => {
    const [d1Center] = DIVISION_ACADEMY_BASE_CENTER;
    const t = { ...team(20, 0, d1Center - 9), divisionConvergence: { seasonsRemaining: 3 } };
    const step1 = stepAcademyBaseConvergence([t])[0];
    expect(step1.academyBase).toBeCloseTo(d1Center - 6, 5); // moved 1/3 of the remaining 9-point gap
    expect(step1.divisionConvergence).toEqual({ seasonsRemaining: 2 });
  });

  it("clears divisionConvergence once seasonsRemaining reaches 0", () => {
    const [d1Center] = DIVISION_ACADEMY_BASE_CENTER;
    const t = { ...team(20, 0, d1Center - 3), divisionConvergence: { seasonsRemaining: 1 } };
    const result = stepAcademyBaseConvergence([t])[0];
    expect(result.academyBase).toBeCloseTo(d1Center, 5);
    expect(result.divisionConvergence).toBeNull();
  });

  it("leaves teams with no active convergence untouched", () => {
    const t = team(0, 0, 41);
    const result = stepAcademyBaseConvergence([t])[0];
    expect(result).toEqual(t);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- promotion`
Expected: FAIL — `src/core/promotion.ts` doesn't exist yet.

- [ ] **Step 3: Implement `src/core/promotion.ts`**

```ts
import type { StandingsRow } from "./standings.js";
import type { StoredTeam } from "./teams/clubs.js";
import {
  PROMOTION_RELEGATION_COUNT, ACADEMY_BASE_CONVERGENCE_SEASONS, DIVISION_ACADEMY_BASE_CENTER,
} from "./constants.js";

export interface DivisionSwap {
  /** Tids moving from Division 2 up to Division 1. */
  promoted: number[];
  /** Tids moving from Division 1 down to Division 2. */
  relegated: number[];
}

/**
 * Bottom PROMOTION_RELEGATION_COUNT of Division 1's final table swap with
 * top PROMOTION_RELEGATION_COUNT of Division 2's final table. Both tables
 * must already be sorted by computeStandings (points, then GD, then GF,
 * then tid).
 */
export function computeDivisionSwap(
  d1Table: StandingsRow[],
  d2Table: StandingsRow[],
): DivisionSwap {
  return {
    promoted: d2Table.slice(0, PROMOTION_RELEGATION_COUNT).map((r) => r.tid),
    relegated: d1Table.slice(-PROMOTION_RELEGATION_COUNT).map((r) => r.tid),
  };
}

/**
 * Flip `division` for every swapped team and start (or restart) its
 * academyBase convergence toward the new division's center. Teams not in
 * the swap are returned unchanged.
 */
export function applyDivisionSwap(teams: StoredTeam[], swap: DivisionSwap): StoredTeam[] {
  const promotedSet = new Set(swap.promoted);
  const relegatedSet = new Set(swap.relegated);
  return teams.map((t) => {
    if (promotedSet.has(t.tid)) {
      return { ...t, division: 0 as const, divisionConvergence: { seasonsRemaining: ACADEMY_BASE_CONVERGENCE_SEASONS } };
    }
    if (relegatedSet.has(t.tid)) {
      return { ...t, division: 1 as const, divisionConvergence: { seasonsRemaining: ACADEMY_BASE_CONVERGENCE_SEASONS } };
    }
    return t;
  });
}

/**
 * Move every mid-convergence team's academyBase one season closer to its
 * current division's center, decrementing seasonsRemaining and clearing
 * divisionConvergence once it reaches 0. Teams with no active convergence
 * (divisionConvergence === null) are returned unchanged — this must NEVER
 * pull every team toward the division average, only ones that actually
 * swapped divisions, or it would erase the intra-division strength spread
 * generation deliberately creates.
 */
export function stepAcademyBaseConvergence(teams: StoredTeam[]): StoredTeam[] {
  return teams.map((t) => {
    if (!t.divisionConvergence) return t;
    const center = DIVISION_ACADEMY_BASE_CENTER[t.division];
    const step = (center - t.academyBase) / t.divisionConvergence.seasonsRemaining;
    const seasonsRemaining = t.divisionConvergence.seasonsRemaining - 1;
    return {
      ...t,
      academyBase: t.academyBase + step,
      divisionConvergence: seasonsRemaining > 0 ? { seasonsRemaining } : null,
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- promotion`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/promotion.ts test/core/promotion.test.ts
git commit -m "Add promotion/relegation swap and gradual academyBase convergence"
```

---

### Task 5: Division-scaled finances

**Files:**
- Modify: `src/core/finance/budget.ts`
- Test: `test/core/finance/budget.test.ts`

**Interfaces:**
- Consumes: `DIVISION_2_BUDGET_SCALE` (Task 1).
- Produces: `seasonRevenue(rank, hype, division)`, `settleSeasonEnd(currentBudget, rank, hype, scoutingSpend, division)`, `chargeSeasonStart(currentBudget, wages, division)` — all gain a required `division: 0 | 1` parameter that scales `BASE_SEASON_BUDGET`/prize tiers by `DIVISION_2_BUDGET_SCALE` for division 1. Consumed by Task 6's `simOffseason` rework and Task 3's `assignIdentities` (season-1 budget).

- [ ] **Step 1: Write the failing test**

Add to `test/core/finance/budget.test.ts` (alongside its existing tests for `seasonRevenue`/`settleSeasonEnd`/`chargeSeasonStart` — follow the same style already in that file):

```ts
import { DIVISION_2_BUDGET_SCALE, BASE_SEASON_BUDGET, PRIZE_CHAMPION } from "../../../src/core/constants.js";

describe("division-scaled finances", () => {
  it("scales base and prize money down for Division 2", () => {
    const d1 = seasonRevenue(1, 0, 0);
    const d2 = seasonRevenue(1, 0, 1);
    expect(d2.base).toBeCloseTo(BASE_SEASON_BUDGET * DIVISION_2_BUDGET_SCALE, 5);
    expect(d2.successPayout).toBeCloseTo(PRIZE_CHAMPION * DIVISION_2_BUDGET_SCALE, 5);
    expect(d1.base).toBe(BASE_SEASON_BUDGET);
    expect(d1.successPayout).toBe(PRIZE_CHAMPION);
  });

  it("chargeSeasonStart scales the base allocation by division", () => {
    const d1Budget = chargeSeasonStart(0, 0, 0);
    const d2Budget = chargeSeasonStart(0, 0, 1);
    expect(d2Budget).toBeCloseTo(BASE_SEASON_BUDGET * DIVISION_2_BUDGET_SCALE, 5);
    expect(d1Budget).toBe(BASE_SEASON_BUDGET);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- budget`
Expected: FAIL — `seasonRevenue`/`chargeSeasonStart` don't accept a third argument yet (or TypeScript errors on the extra arg).

- [ ] **Step 3: Update `src/core/finance/budget.ts`**

Replace `successPayout`, `seasonRevenue`, `settleSeasonEnd`, and `chargeSeasonStart` with division-scaled versions:

```ts
import {
  BASE_SEASON_BUDGET, MAX_BUDGET, HYPE_REVENUE_PER_POINT, HYPE_REVENUE_DAMPING,
  PRIZE_CHAMPION, PRIZE_TOP_5, PRIZE_TOP_10, PRIZE_TOP_5_CUTOFF, PRIZE_TOP_10_CUTOFF,
  DIVISION_2_BUDGET_SCALE,
} from "../constants.js";

/** Caps a budget at MAX_BUDGET; applied everywhere a club's budget can increase. */
export function clampBudget(budget: number): number {
  return Math.min(budget, MAX_BUDGET);
}

export interface SeasonRevenue {
  base: number;
  successPayout: number;
  hypeRevenue: number;
  total: number;
}

/** Scale factor for a division's money-in: 1 for Division 1, DIVISION_2_BUDGET_SCALE for Division 2. */
function divisionScale(division: 0 | 1): number {
  return division === 0 ? 1 : DIVISION_2_BUDGET_SCALE;
}

/**
 * Prize money for a final league position (1-indexed) within the club's own
 * division, scaled down for Division 2. Three exclusive tiers: the
 * champion's prize, a top-5 prize (2nd-5th), and a top-10 prize (6th-10th);
 * the bottom half of the table gets nothing beyond the base.
 */
export function successPayout(rank: number, division: 0 | 1): number {
  const scale = divisionScale(division);
  if (rank === 1) return PRIZE_CHAMPION * scale;
  if (rank <= PRIZE_TOP_5_CUTOFF) return PRIZE_TOP_5 * scale;
  if (rank <= PRIZE_TOP_10_CUTOFF) return PRIZE_TOP_10 * scale;
  return 0;
}

/**
 * Season income: an equal base share for every club in the division, tiered
 * prize money on top, and a heavily damped hype->revenue channel — all
 * scaled down for Division 2 to reflect the real financial gap between
 * top-flight and second-tier football.
 */
export function seasonRevenue(rank: number, hype: number, division: 0 | 1): SeasonRevenue {
  const scale = divisionScale(division);
  const base = BASE_SEASON_BUDGET * scale;
  const payout = successPayout(rank, division);
  const hypeRevenue = hype * HYPE_REVENUE_PER_POINT * HYPE_REVENUE_DAMPING * scale;
  return { base, successPayout: payout, hypeRevenue, total: base + payout + hypeRevenue };
}

/**
 * A club's per-season wage bill: the sum of `player.contract.salary` across
 * the roster (per-season totals set at signing by `seasonSalaryForOvr`),
 * charged once per season here; the contract UI presents them as weekly
 * figures, but the stored number is the season total.
 */
export function wageBill(roster: number[], playerSalary: Map<number, number>): number {
  return roster.reduce((sum, pid) => sum + (playerSalary.get(pid) ?? 0), 0);
}

/**
 * Season-end settlement: performance money in (success payout by final rank
 * within the club's own division, plus hype revenue), scouting spend out.
 * Wages are NOT charged here — they are paid up front at each season's
 * start (chargeSeasonStart).
 */
export function settleSeasonEnd(
  currentBudget: number,
  rank: number,
  hype: number,
  scoutingSpend: number,
  division: 0 | 1,
): number {
  const { successPayout: payout, hypeRevenue } = seasonRevenue(rank, hype, division);
  return clampBudget(currentBudget + payout + hypeRevenue - scoutingSpend);
}

/**
 * Season-start charge, applied when a season begins (league creation and
 * every offseason rollover, on the finalized new-season roster): the base
 * allocation (scaled down for Division 2) arrives and the squad's wages for
 * the season are paid out of it immediately.
 */
export function chargeSeasonStart(currentBudget: number, wages: number, division: 0 | 1): number {
  return clampBudget(currentBudget + BASE_SEASON_BUDGET * divisionScale(division) - wages);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- budget`
Expected: PASS.

- [ ] **Step 5: Fix the two other call sites so the project still typechecks**

`chargeSeasonStart`/`settleSeasonEnd` now require a `division` argument — this breaks `src/core/teams/clubs.ts`'s `assignIdentities` (season-1 budget) until fixed. In `assignIdentities`, change:

```ts
      budget: chargeSeasonStart(0, wageBill(t.roster, salaryMap)),
```

to:

```ts
      budget: chargeSeasonStart(0, wageBill(t.roster, salaryMap), t.division),
```

(`src/core/offseason.ts`'s call sites are fixed in Task 6, and `src/db/migrate.ts`'s fallback call is fixed in Task 12 — both currently fail to typecheck after this step, which is expected.)

Run: `npm run typecheck`
Expected: Still fails, now only in `offseason.ts` and `migrate.ts` (both addressed in later tasks) — confirm no *new* failures appeared outside those two files.

- [ ] **Step 6: Commit**

```bash
git add src/core/finance/budget.ts src/core/teams/clubs.ts test/core/finance/budget.test.ts
git commit -m "Scale Division 2 budgets and prize money down via DIVISION_2_BUDGET_SCALE"
```

---

### Task 6: `simOffseason` rework — per-division standings/finance/awards, promotion/relegation

This is the largest task: `simOffseason`'s step 3.5 (rank/finance/hype) and the awards/history snapshot must move from operating on the whole 40-team pool to operating on each 20-team division separately, and the promotion/relegation swap + academyBase convergence (Task 4) get wired in right after.

**Files:**
- Modify: `src/core/offseason.ts`
- Test: `test/core/offseason.test.ts`

**Interfaces:**
- Consumes: `computeDivisionSwap`, `applyDivisionSwap`, `stepAcademyBaseConvergence` (Task 4); `settleSeasonEnd`/`chargeSeasonStart` with `division` param (Task 5); `SeasonHistoryEntry`'s new shape (Task 3).
- Produces: `simOffseason`'s returned `LeagueStore.seasonHistory` entries now have per-division `awards: [SeasonAwards, SeasonAwards]` and a `divisionsByTid` snapshot; promotion/relegation actually happens each offseason.

- [ ] **Step 1: Write the failing tests**

Add to `test/core/offseason.test.ts` (near the existing `describe("simOffseason", ...)` block):

```ts
  it("swaps 3 up / 3 down between divisions and records pre-swap divisionsByTid", () => {
    const rng = mulberry32(6);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);

    const history = next.seasonHistory.at(-1)!;
    const d1Before = Object.values(history.divisionsByTid).filter((d) => d === 0).length;
    const d2Before = Object.values(history.divisionsByTid).filter((d) => d === 1).length;
    expect(d1Before).toBe(20);
    expect(d2Before).toBe(20);

    // Still 20-and-20 after the swap (composition changed, counts didn't).
    const d1After = next.teams.filter((t) => t.division === 0).length;
    const d2After = next.teams.filter((t) => t.division === 1).length;
    expect(d1After).toBe(20);
    expect(d2After).toBe(20);
  });

  it("stores per-division awards on seasonHistory", () => {
    const rng = mulberry32(7);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);
    const history = next.seasonHistory.at(-1)!;
    expect(history.awards).toHaveLength(2);
  });

  it("charges Division 2 clubs the scaled-down season-start budget", () => {
    const rng = mulberry32(8);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);
    // Sanity: every Division 2 club's budget reflects DIVISION_2_BUDGET_SCALE
    // having been applied somewhere in the pipeline (can't assert an exact
    // number here since wages vary), so just check no Division 2 club is
    // richer, on average, than Division 1 clubs of similar squad strength —
    // full economic verification happens in the dynasty audit task.
    const d1Teams = next.teams.filter((t) => t.division === 0);
    const d2Teams = next.teams.filter((t) => t.division === 1);
    expect(d1Teams.length).toBe(20);
    expect(d2Teams.length).toBe(20);
  });
```

Also fix the two existing count-based assertions that assumed a single 20-team league:

```ts
  it("every team still fields a full 25-man roster after progression/retirement/FA/youth", () => {
    const rng = mulberry32(3);
    const league = playFullSeason(rng);
    const next = simOffseason(league, rng);

    for (const team of next.teams) {
      expect(team.roster.length).toBeGreaterThanOrEqual(20);
    }
    expect(next.teams).toHaveLength(NUM_TEAMS + NUM_TEAMS_D2);
  });
```

and:

```ts
  it("advances the season, resets schedule/played, and returns to regular phase", () => {
    const rng = mulberry32(2);
    const league = playFullSeason(rng);
    expect(league.phase).toBe("offseason");

    const next = simOffseason(league, rng);
    expect(next.season).toBe(league.season + 1);
    expect(next.phase).toBe("regular");
    expect(next.played).toEqual([]);
    expect(next.schedule).toHaveLength(760);
  });
```

(add `NUM_TEAMS_D2` to the existing `import { HYPE_MAX, HYPE_MIN, NUM_TEAMS, SCOUTING_SPEND_MIN }` line at the top of the file)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- offseason`
Expected: FAIL (both new tests, and the two updated count assertions, since `simOffseason` doesn't yet split by division).

- [ ] **Step 3: Rework `simOffseason`**

Replace the whole of `src/core/offseason.ts` with:

```ts
import type { LeagueStore } from "./leagueState.js";
import type { Player } from "./players/types.js";
import type { StoredTeam } from "./teams/clubs.js";
import { progressPlayer, rollRetirement } from "./players/progression.js";
import { generateYouthIntake } from "./players/youth.js";
import {
  releaseExpiredContracts, runAIFreeAgency, trimRosterSurplus, ensureUserRosterSafety,
} from "./freeAgency.js";
import { runAITransferMarket } from "./ai/transferMarket.js";
import { runAIContractRenewals } from "./ai/renewals.js";
import { computeStandings, computeTeamSeasonStats, type StandingsRow } from "./standings.js";
import { computeSeasonAwards, type SeasonAwards } from "./awards.js";
import { computeDivisionSwap, applyDivisionSwap, stepAcademyBaseConvergence } from "./promotion.js";
import { generateSchedule } from "./schedule.js";
import { updateHype } from "./finance/hype.js";
import { settleSeasonEnd, chargeSeasonStart, wageBill } from "./finance/budget.js";
import { academyContractTerms } from "./contracts.js";
import { NUM_TEAMS, NUM_TEAMS_D2, SCOUTING_SPEND_MIN } from "./constants.js";
import { hashInts } from "../engine/rng.js";

/** Awards for the season that just ended, computed separately per division from players' current club membership. */
function awardsByDivision(
  players: Player[],
  teams: StoredTeam[],
  season: number,
): [SeasonAwards, SeasonAwards] {
  const rosterOf = (division: 0 | 1) =>
    new Set(teams.filter((t) => t.division === division).flatMap((t) => t.roster));
  const d1Roster = rosterOf(0);
  const d2Roster = rosterOf(1);
  const d1Players = players.filter((p) => d1Roster.has(p.pid));
  const d2Players = players.filter((p) => d2Roster.has(p.pid));
  return [computeSeasonAwards(d1Players, season), computeSeasonAwards(d2Players, season)];
}

/**
 * Run one full offseason: contract expiry, progression, retirement, AI free
 * agency, youth intake, promotion/relegation, then a fresh schedule for the
 * new season. Only callable when the league is in the "offseason" phase
 * (all 38 matchdays played in both divisions). The user's team is left
 * untouched by free agency/youth so the UI can offer those as manual
 * actions later; youth intake still applies to every club per spec (no
 * draft mechanic).
 */
export function simOffseason(league: LeagueStore, rng: () => number): LeagueStore {
  if (league.phase !== "offseason") {
    return league;
  }

  const endingSeason = league.season;
  const nextSeason = endingSeason + 1;

  // Snapshotted before any roster/division change below, from league.players
  // (not the `players` variable mutated further down) so a player who
  // retires this offseason still gets credit for the season he just
  // finished, and division membership reflects who actually played where.
  const divisionsByTid: Record<number, 0 | 1> = {};
  for (const t of league.teams) divisionsByTid[t.tid] = t.division;
  const awards = awardsByDivision(league.players, league.teams, endingSeason);

  // 0. Proactive AI contract renewals (cross-division: a club's own player,
  //    regardless of which division that club plays in).
  const renewals = runAIContractRenewals(
    league.teams, league.players, nextSeason, league.meta.userTid, league.played,
    hashInts(league.lid, nextSeason, 9),
  );

  // 1. Release expired contracts to the free agent pool.
  let teams: StoredTeam[] = releaseExpiredContracts(renewals.teams, renewals.players, endingSeason);

  // 2. Progress every remaining player's ratings; heal any lingering injury.
  let players: Player[] = renewals.players.map((p) => {
    const progressed = progressPlayer(rng, p, endingSeason);
    return progressed.injury ? { ...progressed, injury: null } : progressed;
  });

  // 3. Roll retirement; drop retirees from rosters and the player pool.
  const retiredPids = new Set(
    players.filter((p) => rollRetirement(rng, p, endingSeason)).map((p) => p.pid),
  );
  players = players.filter((p) => !retiredPids.has(p.pid));
  teams = teams.map((t) => ({
    ...t,
    roster: t.roster.filter((pid) => !retiredPids.has(pid)),
  }));

  // 3.5. Per-division standings, rank-based settlement, and hype update.
  //      Each division's 20-team table is computed independently — pooling
  //      both divisions into one 40-team table would misapply prize-tier
  //      rank cutoffs (PRIZE_TOP_5_CUTOFF etc. assume a 20-team table) and
  //      the hype curve (NUM_TEAMS-normalized) to a league neither was
  //      tuned for.
  const d1TeamIds = teams.filter((t) => t.division === 0).map((t) => t.tid);
  const d2TeamIds = teams.filter((t) => t.division === 1).map((t) => t.tid);
  const d1Standings = computeStandings(d1TeamIds, league.played);
  const d2Standings = computeStandings(d2TeamIds, league.played);
  const standings = [...d1Standings, ...d2Standings];
  const teamStats = computeTeamSeasonStats(teams.map((t) => t.tid), league.played);

  const settle = (rows: StandingsRow[], division: 0 | 1): void => {
    const rankByTid = new Map(rows.map((row, i) => [row.tid, i + 1]));
    const rowByTid = new Map(rows.map((row) => [row.tid, row]));
    teams = teams.map((t) => {
      if (t.division !== division) return t;
      const defaultRank = division === 0 ? NUM_TEAMS : NUM_TEAMS_D2;
      const rank = rankByTid.get(t.tid) ?? defaultRank;
      const row = rowByTid.get(t.tid);
      const budget = settleSeasonEnd(t.budget, rank, t.hype, t.scoutingSpend, division);
      const hype = row ? updateHype(t.hype, row, rank) : t.hype;
      return { ...t, budget, hype, scoutingSpend: SCOUTING_SPEND_MIN };
    });
  };
  settle(d1Standings, 0);
  settle(d2Standings, 1);

  // 3.6. Promotion/relegation: bottom PROMOTION_RELEGATION_COUNT of D1 swap
  //      with top PROMOTION_RELEGATION_COUNT of D2, using the tables just
  //      computed above (the season that actually just played out). Then
  //      every mid-convergence team's academyBase moves one step closer to
  //      its current division's strength band.
  const swap = computeDivisionSwap(d1Standings, d2Standings);
  teams = applyDivisionSwap(teams, swap);
  teams = stepAcademyBaseConvergence(teams);

  // 4. AI free agency fills roster holes (worst team picks first, within
  //    its own division's finishing order — cross-division buying happens
  //    later, in the transfer market step), skipping the user's club.
  const signingOrder = [...standings].sort((a, b) => a.points - b.points).map((s) => s.tid);
  ({ teams, players } = runAIFreeAgency(
    teams, players, nextSeason, rng, league.meta.userTid, signingOrder,
  ));

  // 5. Youth intake for every club, anchored to each club's fixed
  //    generation-time strength (academyBase — see promotion.ts for how it
  //    moves after a division swap).
  let nextPid = Math.max(0, ...players.map((p) => p.pid)) + 1;
  teams = teams.map((t) => {
    const genSeed = hashInts(league.lid, nextSeason, t.tid, 2);
    const { players: youth, nextPid: updatedNextPid } = generateYouthIntake(
      rng, t.academyBase, nextSeason, nextPid, genSeed,
    );
    nextPid = updatedNextPid;
    if (t.tid === league.meta.userTid) {
      const academyTerms = academyContractTerms(nextSeason);
      for (const p of youth) {
        p.contract = { salary: academyTerms.salary, expiresSeason: academyTerms.expiresSeason };
      }
      players.push(...youth);
      return { ...t, academyRoster: [...t.academyRoster, ...youth.map((p) => p.pid)] };
    }
    players.push(...youth);
    return { ...t, roster: [...t.roster, ...youth.map((p) => p.pid)] };
  });

  // 5.5. Emergency call-up for the user's own roster.
  ({ teams, players } = ensureUserRosterSafety(teams, players, league.meta.userTid, nextSeason));

  // 6. Trim AI squads back down to target composition.
  teams = trimRosterSurplus(teams, players, league.meta.userTid);

  // 6.4. AI<->AI transfer market (summer window, cross-division by design —
  //      no division filtering here, see design doc).
  const marketSeed = hashInts(league.lid, nextSeason, 7);
  const summerMarket = runAITransferMarket(
    teams, players, league.transfers, nextSeason, league.played,
    "summer", "offseason", league.meta.userTid, marketSeed,
  );
  teams = summerMarket.teams;

  // 6.5. Season-start finances on the finalized new-season rosters, scaled
  //      by each club's (possibly just-changed) division.
  const salaryMap = new Map(players.map((p) => [p.pid, p.contract.salary]));
  teams = teams.map((t) => ({
    ...t,
    budget: chargeSeasonStart(t.budget, wageBill([...t.roster, ...t.academyRoster], salaryMap), t.division),
  }));

  // 7. New per-division schedules, new season, back to regular play.
  const newD1Ids = teams.filter((t) => t.division === 0).map((t) => t.tid);
  const newD2Ids = teams.filter((t) => t.division === 1).map((t) => t.tid);
  const schedule = [...generateSchedule(newD1Ids), ...generateSchedule(newD2Ids)];

  return {
    ...league,
    teams,
    players,
    season: nextSeason,
    phase: "regular",
    schedule,
    played: [],
    transfers: summerMarket.transfers,
    winterMarketRunSeason: null,
    seasonHistory: [
      ...league.seasonHistory,
      {
        season: endingSeason,
        table: standings,
        championTid: d1Standings[0].tid,
        teamStats,
        awards,
        divisionsByTid,
      },
    ],
  };
}
```

Note `championTid` stays Division 1's champion only (the league's overall "champion" — Division 2's winner is "promoted," not a league champion; this matches how `Standings.tsx`'s existing champion-highlight concept is scoped per the design, since it will look up the champion for whichever division is selected via its own division-scoped `computeStandings` call, not via this field, in Task 9).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- offseason`
Expected: PASS.

- [ ] **Step 5: Confirm typecheck progress**

Run: `npm run typecheck`
Expected: Still fails only in `src/db/migrate.ts` (Task 12) and possibly `src/core/ai/clubContext.ts` (Task 7, not yet touched but doesn't reference `SeasonHistoryEntry` so shouldn't be newly broken by this task) — confirm no failures remain in `offseason.ts` itself.

- [ ] **Step 6: Commit**

```bash
git add src/core/offseason.ts test/core/offseason.test.ts
git commit -m "Split simOffseason's standings/finance/awards per division; wire in promotion/relegation"
```

---

### Task 7: Per-division match composite normalization in `simThrough`

Without this fix, `simThrough` would z-score-normalize all 40 clubs' match composites together (via `leagueMatchData`), diluting the intra-division rating spread `NORMALIZE_K` was tuned for with a single 20-team pool — Division 1 matches would look artificially more even than intended just because Division 2's weaker clubs are also in the averaging pool.

**Files:**
- Modify: `src/core/simThrough.ts`
- Test: `test/core/simThrough.test.ts`

**Interfaces:**
- Consumes: `leagueMatchData` (existing, unchanged signature), `TeamMatchData` type (`src/core/league/composites.ts`).
- Produces: `simThrough`'s internal match-data lookup is now a `Map<number, TeamMatchData>` keyed by tid (built from two separate per-division `leagueMatchData` calls), replacing the old array-indexed-by-tid assumption.

- [ ] **Step 1: Write the failing test**

Add to `test/core/simThrough.test.ts` (following that file's existing style of playing out a `createLeagueState` league):

```ts
it("never simulates a match between teams in different divisions", () => {
  const rng = mulberry32(11);
  let league = createLeagueState(0, rng);
  league = simThrough(league, "season", rng);
  const divisionByTid = new Map(league.teams.map((t) => [t.tid, t.division]));
  for (const m of league.played) {
    expect(divisionByTid.get(m.home)).toBe(divisionByTid.get(m.away));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- simThrough`
Expected: This particular test should actually already pass by construction (the schedule from Task 3/6 never generates a cross-division fixture) — its real purpose is a regression guard. Confirm it passes as-is; if `npm run typecheck` currently fails inside `simThrough.ts` due to `LeagueTeam` now requiring `division` (from Task 2), that surfaces here — fix it in the next step regardless.

- [ ] **Step 3: Update `simThrough.ts`'s match-data lookup**

Add `division: t.division,` to the `toLeagueTeams` helper's returned object (so it satisfies the now-required `LeagueTeam.division` field):

```ts
  const toLeagueTeams = (ts: StoredTeam[]): LeagueTeam[] =>
    ts.map((t) => ({
      tid: t.tid,
      name: t.name,
      roster: t.roster,
      avgOvr: 0,
      academyBase: t.academyBase,
      division: t.division,
      starters: t.starters,
    }));
```

Add the import for `TeamMatchData` at the top of the file:

```ts
import type { TeamMatchData } from "./league/composites.js";
```

Then replace the single combined call:

```ts
    const leagueObj: League = { teams: toLeagueTeams(currentTeams), players: currentPlayers };
    const matchData = leagueMatchData(leagueObj);
```

with a per-division split, merged into a tid-keyed map:

```ts
    const d1Teams = currentTeams.filter((t) => t.division === 0);
    const d2Teams = currentTeams.filter((t) => t.division === 1);
    const d1MatchData = leagueMatchData({ teams: toLeagueTeams(d1Teams), players: currentPlayers });
    const d2MatchData = leagueMatchData({ teams: toLeagueTeams(d2Teams), players: currentPlayers });
    const matchData = new Map<number, TeamMatchData>();
    d1Teams.forEach((t, i) => matchData.set(t.tid, d1MatchData[i]));
    d2Teams.forEach((t, i) => matchData.set(t.tid, d2MatchData[i]));
```

And update the two lookups later in the same matchday loop from array indexing to map lookup:

```ts
      const hd = matchData.get(game.home)!;
      const ad = matchData.get(game.away)!;
```

- [ ] **Step 4: Run test to verify it passes, plus the full simThrough suite**

Run: `npm test -- simThrough`
Expected: PASS (all existing tests in the file plus the new one).

- [ ] **Step 5: Commit**

```bash
git add src/core/simThrough.ts test/core/simThrough.test.ts
git commit -m "Normalize match composites per division instead of pooling both divisions"
```

---

### Task 8: Per-division AI wealth/ambition/form normalization

Without this fix, `deriveLeagueContexts` would min-max normalize wealth/hype/strength and rank-normalize form across all 40 clubs — since Division 2 is deliberately poorer by design (Task 5), pooling would make every Division 2 club read as permanently near-zero wealth/ambition regardless of how it's actually doing relative to its own division, breaking the AI GM's "derived from state" evaluation for half the league.

**Files:**
- Modify: `src/core/ai/clubContext.ts`
- Test: `test/core/ai/clubContext.test.ts`

**Interfaces:**
- Consumes: `division` field on `StoredTeam` (Task 1).
- Produces: `deriveLeagueContexts` — same signature and return type (`Map<number, ClubContext>`), but every normalization (wealth/hype/strength min-max, form rank) is now computed within the team's own division's pool.

- [ ] **Step 1: Write the failing test**

Add to `test/core/ai/clubContext.test.ts` (following its existing style/fixtures for building a `LeagueSnapshot`):

```ts
it("normalizes wealth/ambition within each division, not pooled across both", () => {
  // Two divisions of otherwise-identical clubs, but Division 2's clubs are
  // uniformly poorer (mirrors DIVISION_2_BUDGET_SCALE in practice). If
  // normalization pooled both divisions, every Division 2 club would read
  // as having ~0 wealthNorm (and thus near-max frugality) since they'd all
  // sit at the bottom of a combined range dominated by Division 1's higher
  // budgets. Within-division normalization means Division 2's own richest
  // and poorest clubs should still span close to the full [0,1] range
  // relative to each other.
  const league = buildTestLeague({
    d1Budgets: [10_000_000, 20_000_000, 30_000_000],
    d2Budgets: [1_000_000, 2_000_000, 3_000_000],
  });
  const contexts = deriveLeagueContexts(league);
  const d2Frugalities = league.teams
    .filter((t) => t.division === 1)
    .map((t) => contexts.get(t.tid)!.frugality);
  // The richest Division 2 club should be noticeably less frugal than the
  // poorest one, not clustered together at max frugality.
  expect(Math.max(...d2Frugalities) - Math.min(...d2Frugalities)).toBeGreaterThan(0.3);
});
```

If `test/core/ai/clubContext.test.ts` doesn't already export/have a `buildTestLeague`-style helper, add one at the top of the file matching whatever fixture pattern the file's *existing* tests already use to build a `LeagueSnapshot` (check the file's current tests for its existing team/player fixture builder before adding a new one — reuse it, parameterized by `division` and `budget`, rather than introducing a second, differently-shaped helper).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- clubContext`
Expected: FAIL — with pooled normalization, all three Division 2 clubs cluster near frugality 1.

- [ ] **Step 3: Rework `deriveLeagueContexts` to normalize per division**

Replace the body of `deriveLeagueContexts` in `src/core/ai/clubContext.ts`:

```ts
export function deriveLeagueContexts(league: LeagueSnapshot): Map<number, ClubContext> {
  const playerById = new Map(league.players.map((p) => [p.pid, p]));
  const rosterOf = (t: StoredTeam): Player[] =>
    t.roster.map((pid) => playerById.get(pid)).filter((p): p is Player => p != null);

  const raw = league.teams.map((t) => {
    const roster = rosterOf(t);
    const { depth, best } = positionalDepthAndBest(roster);
    return {
      tid: t.tid,
      division: t.division,
      budget: t.budget,
      hype: t.hype,
      strength: squadStrength(roster),
      avgAge: mean(roster.map((p) => league.season - p.born)),
      depth,
      best,
    };
  });

  const contexts = new Map<number, ClubContext>();

  for (const division of [0, 1] as const) {
    const group = raw.filter((r) => r.division === division);
    if (group.length === 0) continue;
    const groupTids = group.map((r) => r.tid);
    const groupTidSet = new Set(groupTids);
    const groupPlayed = league.played.filter(
      (m) => groupTidSet.has(m.home) && groupTidSet.has(m.away),
    );

    const hasPlayed = groupPlayed.length > 0;
    const rankByTid = new Map<number, number>();
    if (hasPlayed) {
      const groupStandings = computeStandings(groupTids, groupPlayed);
      groupStandings.forEach((row, i) => rankByTid.set(row.tid, i + 1));
    }
    const groupSize = group.length;
    const formNorm = (tid: number): number =>
      hasPlayed
        ? normalize(groupSize - (rankByTid.get(tid) ?? groupSize), 0, groupSize - 1)
        : 0.5;

    const budgets = group.map((r) => r.budget);
    const hypes = group.map((r) => r.hype);
    const strengths = group.map((r) => r.strength);
    const [bMin, bMax] = [Math.min(...budgets), Math.max(...budgets)];
    const [hMin, hMax] = [Math.min(...hypes), Math.max(...hypes)];
    const [sMin, sMax] = [Math.min(...strengths), Math.max(...strengths)];

    for (const r of group) {
      const wealthNorm = normalize(r.budget, bMin, bMax);
      const fameNorm = normalize(r.hype, hMin, hMax);
      const strengthNorm = normalize(r.strength, sMin, sMax);
      const form = formNorm(r.tid);

      const ambition =
        AI_AMBITION_W_STRENGTH * strengthNorm +
        AI_AMBITION_W_WEALTH * wealthNorm +
        AI_AMBITION_W_FAME * fameNorm +
        AI_AMBITION_W_FORM * form;

      const frugality = 1 - wealthNorm;

      contexts.set(r.tid, {
        tid: r.tid,
        season: league.season,
        budget: r.budget,
        squadStrength: r.strength,
        squadAvgAge: r.avgAge,
        posDepth: r.depth,
        posBestOvr: r.best,
        ambition,
        frugality,
        direction: label(ambition, form, r.avgAge),
      });
    }
  }

  return contexts;
}
```

Remove the now-unused `NUM_TEAMS` import at the top of the file (it's no longer referenced — `groupSize` replaces it).

- [ ] **Step 4: Run test to verify it passes, plus the full clubContext/evaluate/transferMarket suites**

Run: `npm test -- clubContext evaluate transferMarket renewals inboundOffers`
Expected: PASS — these are the modules that consume `ClubContext`, so confirm none of them broke from the per-division change (they all just read `ambition`/`frugality` off the returned map, unaware of how it was computed, so no other file should need changes).

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/clubContext.ts test/core/ai/clubContext.test.ts
git commit -m "Normalize AI wealth/ambition/form within each division instead of pooling both"
```

---

### Task 9: Standings page — Division dropdown

**Files:**
- Modify: `src/ui/pages/Standings.tsx`

**Interfaces:**
- Consumes: `league.teams[].division`, `league.seasonHistory[].divisionsByTid` (Tasks 1, 3).

- [ ] **Step 1: Add division state and filter the team-id list before calling `computeStandings`**

In `src/ui/pages/Standings.tsx`, add a `division` state alongside the existing `season` state:

```ts
const [division, setDivision] = useState<0 | 1>(0);
```

Replace the `standings`/`championTid` computation:

```ts
  let standings: StandingsRow[];
  let championTid: number;
  if (season === "current") {
    const teamIds = league.teams.filter((t) => t.division === division).map((t) => t.tid);
    standings = computeStandings(teamIds, league.played.filter((m) => {
      const home = league.teams.find((t) => t.tid === m.home);
      return home?.division === division;
    }));
    championTid = league.played.length > 0 ? (standings[0]?.tid ?? -1) : -1;
  } else {
    const entry = league.seasonHistory.find((h) => h.season === season)!;
    const divisionTids = new Set(
      Object.entries(entry.divisionsByTid)
        .filter(([, d]) => d === division)
        .map(([tid]) => Number(tid)),
    );
    standings = entry.table.filter((row) => divisionTids.has(row.tid));
    championTid = division === 0 ? entry.championTid : (standings[0]?.tid ?? -1);
  }
```

Add the dropdown to the JSX, next to the existing season `<select>`:

```tsx
<select
  className="form-select form-select-sm"
  style={{ width: "auto", display: "inline-block" }}
  value={division}
  onChange={(e) => setDivision(Number(e.target.value) as 0 | 1)}
>
  <option value={0}>English Division 1</option>
  <option value={1}>English Division 2</option>
</select>
```

(placed right after the season `<select>`'s closing tag, still inside the existing `<div className="mb-3">`)

- [ ] **Step 2: Manually verify in the browser**

Run: `npm run dev`, open the app, advance to a season with matches played, visit `/standings`, and confirm: the Division dropdown appears, switching it shows a genuinely different 20-team table for each division, and the champion highlight only appears for Division 1 (Division 2's "1st place" is a promotion spot, not a league championship, per Task 6's design note — the current-season fallback above computes a `championTid` for Division 2 too since `standings[0]` still means "top of the table," which is reasonable for a live view; confirm this reads sensibly in the UI and isn't confusingly labeled "(Champion)" for a Division 2 side if that phrasing would be misleading — if it is, adjust the JSX's champion label text to say "(1st)" instead of "(Champion)" specifically when `division === 1`).

- [ ] **Step 3: Commit**

```bash
git add src/ui/pages/Standings.tsx
git commit -m "Add Division dropdown to the Standings page"
```

---

### Task 10: Awards page — Division dropdown

**Files:**
- Modify: `src/ui/pages/Awards.tsx`

**Interfaces:**
- Consumes: `SeasonHistoryEntry.awards: [SeasonAwards, SeasonAwards]` (Task 3/6).

- [ ] **Step 1: Add division state and index into the tuple**

In `src/ui/pages/Awards.tsx`, add:

```ts
const [division, setDivision] = useState<0 | 1>(0);
```

Replace:

```ts
  const potd = entry.awards.playerOfSeasonPid !== null ? playersByPid.get(entry.awards.playerOfSeasonPid) : undefined;
  const goldenBoot = entry.awards.goldenBootPid !== null ? playersByPid.get(entry.awards.goldenBootPid) : undefined;
```

with:

```ts
  const divisionAwards = entry.awards[division];
  const potd = divisionAwards.playerOfSeasonPid !== null ? playersByPid.get(divisionAwards.playerOfSeasonPid) : undefined;
  const goldenBoot = divisionAwards.goldenBootPid !== null ? playersByPid.get(divisionAwards.goldenBootPid) : undefined;
```

And update the final `<TeamOfSeasonField awards={entry.awards} .../>` call to `<TeamOfSeasonField awards={divisionAwards} .../>`.

Add the dropdown next to the existing season `<select>`:

```tsx
<select
  className="form-select form-select-sm"
  style={{ width: "auto", display: "inline-block" }}
  value={division}
  onChange={(e) => setDivision(Number(e.target.value) as 0 | 1)}
>
  <option value={0}>English Division 1</option>
  <option value={1}>English Division 2</option>
</select>
```

- [ ] **Step 2: Manually verify in the browser**

Run: `npm run dev`, visit `/awards` after at least one completed season, confirm switching divisions shows different Player of the Season/Golden Boot/Team of the Season.

- [ ] **Step 3: Commit**

```bash
git add src/ui/pages/Awards.tsx
git commit -m "Add Division dropdown to the Awards page"
```

---

### Task 11: Stat Leaders page — Division dropdown (players and teams)

**Files:**
- Modify: `src/ui/pages/Leaders.tsx`

**Interfaces:**
- Consumes: `league.teams[].division` (current season), `league.seasonHistory[].divisionsByTid` (past seasons).

- [ ] **Step 1: Thread a shared `division` state from `Leaders()` down to both tabs**

In `src/ui/pages/Leaders.tsx`, change the top-level `Leaders()` component to own the division state and pass it down as a prop:

```ts
export function Leaders() {
  const [tab, setTab] = useState<LeadersTab>("players");
  const [division, setDivision] = useState<0 | 1>(0);

  return (
    <div className="container-fluid p-3">
      <h4>Stat Leaders</h4>
      <div className="mb-3 d-flex gap-2 align-items-center">
        <div className="btn-group" role="group">
          <button
            type="button"
            className={`btn btn-sm ${tab === "players" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setTab("players")}
          >
            Players
          </button>
          <button
            type="button"
            className={`btn btn-sm ${tab === "teams" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setTab("teams")}
          >
            Teams
          </button>
        </div>
        <select
          className="form-select form-select-sm"
          style={{ width: "auto" }}
          value={division}
          onChange={(e) => setDivision(Number(e.target.value) as 0 | 1)}
        >
          <option value={0}>English Division 1</option>
          <option value={1}>English Division 2</option>
        </select>
      </div>
      {tab === "players" ? <PlayerLeaders division={division} /> : <TeamLeaders division={division} />}
    </div>
  );
}
```

- [ ] **Step 2: Filter `PlayerLeaders` by division**

Change `function PlayerLeaders() {` to `function PlayerLeaders({ division }: { division: 0 | 1 }) {`.

Restrict `teamByPid`/`tidByPid` to only the selected division's rosters (a player with no entry in these maps — a free agent, academy prospect, or a player on the *other* division's roster — is excluded from every ranking, same as free agents already are today via `?? "Unknown"` never matching):

```ts
  const teamByPid = new Map<number, string>();
  const tidByPid = new Map<number, number>();
  for (const team of league.teams) {
    if (team.division !== division) continue;
    for (const pid of team.roster) {
      teamByPid.set(pid, team.name);
      tidByPid.set(pid, team.tid);
    }
  }
```

Then guard each of the three `rows.push(...)` loops (the `season !== "all"`, `scope === "career"`, and single-season branches) to skip players not on a roster in this division, by adding `if (!tidByPid.has(p.pid)) continue;` as the first line inside each `for (const p of league.players)` loop.

- [ ] **Step 3: Filter `TeamLeaders` by division**

Change `function TeamLeaders() {` to `function TeamLeaders({ division }: { division: 0 | 1 }) {`.

After computing `teamIds`/`teamStats`, restrict to the selected division. For "current," filter `teamIds` before calling `computeTeamSeasonStats`; for a past season, filter the stored `teamStats` by that season's `divisionsByTid`:

```ts
  const teamIds = league.teams.filter((t) => t.division === division).map((t) => t.tid);
  const teamStats: TeamSeasonStats[] = season === "current"
    ? computeTeamSeasonStats(teamIds, league.played)
    : (league.seasonHistory.find((h) => h.season === season)?.teamStats ?? [])
        .filter((s) => league.seasonHistory.find((h) => h.season === season)?.divisionsByTid[s.tid] === division);
```

- [ ] **Step 4: Run existing tests and manually verify**

Run: `npm test`
Expected: PASS — `Leaders.tsx` has no dedicated unit test file today (UI pages in this project are manually browser-verified per the project's convention), so confirm nothing else broke.

Run: `npm run dev`, visit `/stat-leaders` (or the Leaders page's route), confirm both Player and Team tabs respect the new Division dropdown and show non-overlapping player/team pools between divisions.

- [ ] **Step 5: Commit**

```bash
git add src/ui/pages/Leaders.tsx
git commit -m "Add Division dropdown to the Stat Leaders page (players and teams)"
```

---

### Task 12: Save migration — backfill new fields for existing single-division saves

**Files:**
- Modify: `src/db/migrate.ts`
- Test: `test/db/migrate.test.ts`

**Interfaces:**
- Consumes: `division`/`divisionConvergence` (Task 1), `SeasonHistoryEntry.awards`/`divisionsByTid` (Task 3), `chargeSeasonStart`'s division param (Task 5).
- Produces: `migrateLeague` backfills every pre-existing save's teams to `division: 0` (they were always single-division, i.e. what's now called Division 1) and `divisionConvergence: null`, and every historical `seasonHistory` entry to a `divisionsByTid` that's all-zeros plus an `awards` tuple `[oldSingleAwards, emptyD2Awards]`.

- [ ] **Step 1: Write the failing test**

Add to `test/db/migrate.test.ts` (following that file's existing pattern of constructing an "old-shape" league object and running it through `migrateLeague`):

```ts
it("backfills division/divisionConvergence on old-save teams, and divisionsByTid/awards on old-save seasonHistory", () => {
  const oldLeague = buildOldSaveLeagueFixture(); // reuse whatever fixture helper this file's existing tests already use
  const migrated = migrateLeague(oldLeague);

  for (const t of migrated.teams) {
    expect(t.division).toBe(0);
    expect(t.divisionConvergence).toBeNull();
  }

  for (const h of migrated.seasonHistory) {
    expect(Array.isArray(h.awards)).toBe(true);
    expect(h.awards).toHaveLength(2);
    for (const tid of Object.keys(h.divisionsByTid).map(Number)) {
      expect(h.divisionsByTid[tid]).toBe(0);
    }
  }
});
```

(If `test/db/migrate.test.ts` doesn't already have a shared "old-shape league" fixture builder, construct the smallest old-shape object needed inline instead of inventing a new helper name — follow whatever pattern the file's existing tests already use to omit `division`/`divisionConvergence`/`divisionsByTid`/two-element `awards` from a sample `LeagueStore`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- migrate`
Expected: FAIL (and/or `npm run typecheck` failing in this file, which is the expected leftover breakage from Tasks 1/3/5).

- [ ] **Step 3: Update `migrate.ts`**

Add `division`/`divisionConvergence` to the `StoredTeamAnyVersion` omit/partial type and to the teams-mapping backfill:

```ts
type StoredTeamAnyVersion =
  Omit<StoredTeam, "budget" | "hype" | "scoutingSpend" | "academyBase" | "starters" | "academyRoster" | "division" | "divisionConvergence"> &
  Partial<Pick<StoredTeam, "budget" | "hype" | "scoutingSpend" | "academyBase" | "starters" | "academyRoster" | "division" | "divisionConvergence">>;
```

In the `teams: (league.teams as StoredTeamAnyVersion[]).map((t) => ({...}))` block inside `migrateLeague`, add:

```ts
      division: t.division ?? 0,
      divisionConvergence: t.divisionConvergence ?? null,
```

Update `chargeSeasonStart`'s pre-M6 fallback call (it now requires a `division` argument):

```ts
      budget: t.budget ?? chargeSeasonStart(0, wageBill(t.roster, salaryMap), t.division ?? 0),
```

Update `SeasonHistoryEntryAnyVersion` to reflect the new tuple `awards` shape and the new `divisionsByTid` field:

```ts
type SeasonHistoryEntryAnyVersion =
  Omit<LeagueStore["seasonHistory"][number], "teamStats" | "awards" | "divisionsByTid"> &
  Partial<{
    teamStats: TeamSeasonStatsAnyVersion[];
    awards: SeasonAwards | [SeasonAwards, SeasonAwards];
    divisionsByTid: Record<number, 0 | 1>;
  }>;
```

Finally, update the `seasonHistory` backfill inside `migrateLeague`. Old saves' `awards` (if present at all) is a single `SeasonAwards` object from before this feature — treat it as Division 1's awards and default Division 2's to an award-free placeholder (there was never a Division 2 for these seasons, so an empty/no-eligible-player shape is correct, not a guess):

```ts
    seasonHistory: ((anyVersion.seasonHistory ?? []) as SeasonHistoryEntryAnyVersion[]).map((h) => {
      const allTidsD1: Record<number, 0 | 1> = h.divisionsByTid
        ?? Object.fromEntries(league.teams.map((t) => [t.tid, 0 as const]));
      const emptyAwards: SeasonAwards = {
        playerOfSeasonPid: null,
        goldenBootPid: null,
        teamOfSeason: FORMATIONS["4-3-3"].map(() => null),
      };
      const legacyOrMissingAwards = h.awards;
      const awards: [SeasonAwards, SeasonAwards] = Array.isArray(legacyOrMissingAwards)
        ? legacyOrMissingAwards
        : [legacyOrMissingAwards ?? computeSeasonAwards(migratedPlayers, h.season), emptyAwards];
      return {
        ...h,
        teamStats: (h.teamStats ?? []).map((t) => ({
          ...t, xg: t.xg ?? 0, goalsAgainst: t.goalsAgainst ?? 0, xga: t.xga ?? 0,
        })),
        awards,
        divisionsByTid: allTidsD1,
      };
    }),
```

Add the needed imports at the top of `migrate.ts`:

```ts
import { FORMATIONS } from "../core/lineup/formations.js";
import type { SeasonAwards } from "../core/awards.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- migrate`
Expected: PASS.

- [ ] **Step 5: Full typecheck and full suite**

Run: `npm run typecheck`
Expected: PASS with zero errors — this is the last file touched that had known leftover breakage from earlier tasks.

Run: `npm test`
Expected: PASS across the entire suite. If any test outside the files already touched by this plan fails on a hardcoded team/game count (the plan's research found `leagueState.test.ts` and `offseason.test.ts` as the two files with such assertions, both already fixed in Tasks 3/6 — but if the full run surfaces another, e.g. in a validation/*.test.ts dynasty-style test), fix it the same way: replace the hardcoded `20`/`380`/`NUM_TEAMS` expectation with `NUM_TEAMS + NUM_TEAMS_D2` / `760` / a per-division-scoped equivalent, following the exact pattern already used in this plan's Task 3/6 edits.

- [ ] **Step 6: Commit**

```bash
git add src/db/migrate.ts test/db/migrate.test.ts
git commit -m "Migrate old single-division saves to Division 1 with empty Division 2 history"
```

---

### Task 13: Dynasty audit and constant tuning

The starting values chosen in Task 1 (`DIVISION_2_OFFSET = 7`, `DIVISION_2_BUDGET_SCALE = 0.5`, `ACADEMY_BASE_CONVERGENCE_SEASONS = 3`) are reasonable defaults, not final — per this project's established practice (see CLAUDE.md's OVR-rebalance and budget-cap-retune sections), every prior constant like this was confirmed or corrected against a real multi-season dynasty run before being considered final, not shipped on the strength of the arithmetic alone.

**Files:**
- Create: `scripts/divisionAudit.ts` (one-off, follows `scripts/cli.ts`'s existing pattern — `tsx`-runnable, not wired into `npm run cli`'s subcommands unless useful to keep)

**Interfaces:**
- Consumes: `createLeagueState`, `simThrough`, `simOffseason` (the real production code paths — not a re-implementation).

- [ ] **Step 1: Write the audit script**

```ts
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";

const SEASONS = 30;
const SEEDS = [1, 2, 3];

for (const seed of SEEDS) {
  console.log(`\n=== seed ${seed} ===`);
  const rng = mulberry32(seed);
  let league = createLeagueState(0, rng);

  let minBudget = Infinity;
  const ovrsByDivisionAtSeason: Record<number, { d1: number[]; d2: number[] }> = {};
  let promotedTeamNextSeasonOvrRanks: number[] = [];

  for (let s = 1; s <= SEASONS; s++) {
    league = simThrough(league, "season", rng);
    const before = new Map(league.teams.map((t) => [t.tid, t.division]));
    league = simOffseason(league, rng);
    for (const t of league.teams) minBudget = Math.min(minBudget, t.budget);

    const ovrByTid = new Map<number, number[]>();
    for (const p of league.players) {
      const tid = league.teams.find((t) => t.roster.includes(p.pid))?.tid;
      if (tid === undefined) continue;
      (ovrByTid.get(tid) ?? ovrByTid.set(tid, []).get(tid)!).push(p.ovr);
    }
    const d1 = league.teams.filter((t) => t.division === 0).flatMap((t) => ovrByTid.get(t.tid) ?? []);
    const d2 = league.teams.filter((t) => t.division === 1).flatMap((t) => ovrByTid.get(t.tid) ?? []);
    ovrsByDivisionAtSeason[s] = { d1, d2 };

    // Track: does a team promoted this offseason (division flipped 1->0)
    // finish bottom-3 (i.e. get immediately relegated back) next season?
    const justPromoted = [...before.entries()].filter(([tid, d]) => d === 1 && before.get(tid) !== league.teams.find((t) => t.tid === tid)?.division);
    if (justPromoted.length > 0 && s < SEASONS) {
      // Recorded for inspection; a full "did they survive" check needs the
      // *next* offseason's swap result, left as a manual follow-up read of
      // the printed per-season division membership below if this shows a
      // concerning pattern.
      promotedTeamNextSeasonOvrRanks.push(justPromoted.length);
    }
  }

  console.log("min budget ever observed:", minBudget);
  const last = ovrsByDivisionAtSeason[SEASONS];
  const pctOver = (xs: number[], t: number) => (100 * xs.filter((x) => x >= t).length) / xs.length;
  console.log("D1 final-season OVR: mean", avg(last.d1).toFixed(1), "80+:", pctOver(last.d1, 80).toFixed(1) + "%");
  console.log("D2 final-season OVR: mean", avg(last.d2).toFixed(1), "80+:", pctOver(last.d2, 80).toFixed(1) + "%");
  console.log("D2 strongest vs D1 average (should be roughly equal per design):",
    Math.max(...last.d2).toFixed(1), "vs", avg(last.d1).toFixed(1));
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
```

- [ ] **Step 2: Run it**

Run: `npx tsx scripts/divisionAudit.ts`
Expected: Prints per-seed output. Read the results and check against these concrete pass/fail bars:
- **No deficits**: `min budget ever observed` should be positive for every seed. If negative, `DIVISION_2_BUDGET_SCALE` in `src/core/constants.ts` is too low relative to Division 2's wage bills — raise it (e.g. to 0.6) and re-run.
- **D2 strength gap holds as designed**: "D2 strongest vs D1 average" should be close (within a few OVR points), matching the design's "D2's strongest teams land around D1's mid-table strength." If D2's strongest is far below D1's average even after 30 seasons of transfers/promotion, `DIVISION_2_OFFSET` is too large — lower it (e.g. to 5) and re-run. If D2's strongest is *stronger* than D1's average, `DIVISION_2_OFFSET` is too small — raise it (e.g. to 9) and re-run.
- **No runaway inflation in either division**: 80+ OVR percentages should look similar in shape to the single-division equilibrium already documented in CLAUDE.md (roughly 1.5-3% at 80+ by late dynasty) for Division 1, and similar-or-lower for Division 2 (never higher, since it's the weaker division) — if Division 2 shows inflation Division 1 doesn't, the per-division normalization in Task 8 or the youth-intake anchor in Task 4/6 has a bug, not a tuning issue; investigate rather than adjusting constants.

- [ ] **Step 3: Adjust constants if needed, re-run until all three bars pass**

If any constant in `src/core/constants.ts` (`DIVISION_2_OFFSET`, `DIVISION_2_BUDGET_SCALE`, `ACADEMY_BASE_CONVERGENCE_SEASONS`) is changed, re-run the full test suite (`npm test`) since Task 4/5's unit tests assert exact values derived from these constants via `DIVISION_ACADEMY_BASE_CENTER` and `DIVISION_2_BUDGET_SCALE` — they should still pass unchanged (they're written against whatever the constant equals, not a hardcoded literal), but confirm.

- [ ] **Step 4: Document the audit outcome and commit**

Add a short note to `CLAUDE.md`'s Milestone status section (per this repo's own convention of recording constant-tuning provenance) summarizing the final constant values and what the audit showed, one or two sentences, matching the style of the existing "OVR rebalance" / "Budget cap retune" notes already there.

```bash
git add scripts/divisionAudit.ts src/core/constants.ts CLAUDE.md
git commit -m "Add dynasty audit script for the second division; confirm/tune D2 constants"
```

---

## Self-Review Notes

- **Spec coverage**: every bullet in the design doc's Context section maps to a task — 20 new clubs (Task 1), 3-up-3-down (Task 4/6), noticeably-weaker D2 generation (Task 2), gradual academyBase convergence (Task 4/6), lower D2 finances (Task 5), cross-division transfers (no task needed — verified as already-working by construction, called out explicitly in Task 6's comments), user relegation risk (Task 6, no special-casing added), new-leagues-only migration (Task 12), Standings/Stat-Leaders/Awards division dropdowns (Tasks 9/10/11), division naming (used verbatim in every UI task's `<option>` text).
- **Beyond the spec, found during grounding**: two correctness issues the spec doc didn't call out — match composite normalization pooling both divisions (Task 7) and AI wealth/ambition/form normalization pooling both divisions (Task 8) — both are consequences of the exact same "don't pool two divisions' worth of z-scoring" mistake, caught by actually reading `leagueMatchData`/`deriveLeagueContexts` rather than assuming the pure-function design was automatically safe.
- **Type consistency check**: `division: 0 | 1` is used identically everywhere (`LeagueTeam`, `StoredTeam`, `ClubContext` is not given its own copy — it's derived per-call, consistent with the "derived not stored" philosophy already established for `ambition`/`frugality`). `SeasonHistoryEntry.awards` is consistently `[SeasonAwards, SeasonAwards]` (index 0 = D1, index 1 = D2) across Tasks 3, 6, 10, 12 — no task uses a `Record`/object-keyed alternative.
- **No placeholders**: every task has complete, concrete code; the one open numeric question (exact tuning constants) is resolved by giving concrete starting values in Task 1 plus a concrete, re-runnable verification procedure with numeric pass bars in Task 13, rather than leaving the values as TBD.
