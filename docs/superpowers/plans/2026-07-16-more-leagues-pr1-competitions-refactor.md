# More Leagues PR 1: Competitions Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `division: 0 | 1` league model with a data-driven competitions table (England-only for now), behavior-identical, so PR 2 can add Spain/Italy as data.

**Architecture:** A new `Competition { id, country, tier, name }` type lives on `LeagueStore.competitions`. Teams point at a competition via `compId` (renamed from `division`). Every "division 0 vs division 1" hardcoded pair becomes a loop over the competitions table; finance takes `tier: 1 | 2` instead of `division: 0 | 1`. Old saves migrate by backfilling a 2-entry England table — their existing 0/1 values are already valid compIds.

**Tech Stack:** TypeScript, Vitest (`npm test`), no new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-16-more-leagues-design.md` (this plan is its "PR 1: Refactor").

## Global Constraints

- **Behavior-identical**: for the same seed, an England-only save must generate, simulate, and settle exactly as before this PR. No constant retuning.
- **Testing is deliberately lean (user's explicit instruction)**: update existing tests to new shapes; add new tests ONLY where this plan shows them (competitions helpers, migration backfill). Run scoped test files per task; the FULL suite (`npm test`) runs once, in the final task.
- Old saves: migrate mechanically in `src/db/migrate.ts`; never regenerate or re-stamp existing save content.
- No emoji in UI (existing house rule).
- Run all commands from the worktree root. Commit after every task.

## Reference: current shape (before this PR)

- `StoredTeam.division: 0 | 1` (`src/core/teams/clubs.ts:84`), `LeagueTeam.division: 0 | 1` (`src/core/league/generate.ts:27`).
- Finance functions take `division: 0 | 1` (`src/core/finance/budget.ts`: `clampBudget`, `successPayout`, `seasonRevenue`, `settleSeasonEnd`, `chargeSeasonStart`).
- Hardcoded pair loops: `src/core/offseason.ts` (d1/d2 standings, `settle(rows, 0|1)`, `awardsByDivision` returning a 2-tuple), `src/core/simThrough.ts:170-171` (d1Teams/d2Teams matchData), `src/core/ai/clubContext.ts:149` (`for (const division of [0, 1] as const)`), `src/core/leagueState.ts:50-52` (schedule generation), `src/core/promotion.ts` (one D1↔D2 swap).
- `SeasonHistoryEntry` (`src/core/standings.ts:51-60`): `awards: [SeasonAwards, SeasonAwards]`, `divisionsByTid: Record<number, 0 | 1>`, `championTid: number`.
- Other `division` readers: `src/core/ai/divisionCeiling.ts`, `src/core/ai/breakoutRefusal.ts:22`, `src/core/ai/transferMarket.ts:174`, `src/core/transfers/negotiation.ts:196`, `src/db/migrate.ts`, and UI pages `Standings.tsx, Leaders.tsx, Dashboard.tsx, Finance.tsx, Roster.tsx, PowerRankings.tsx, PlayerProfile.tsx`.
- Constants: `DIVISION_ACADEMY_BASE_CENTER: readonly [number, number]` (`src/core/constants.ts:111-113`), indexed by division today.

---

### Task 1: Competitions module

**Files:**
- Create: `src/core/competitions.ts`
- Test: `test/core/competitions.test.ts`

**Interfaces:**
- Produces (later tasks rely on these exact names):

```ts
export interface Competition {
  /** compId — what StoredTeam.compId points at. Stable forever within a save. */
  id: number;
  country: string; // "England" (PR 2 adds "Spain", "Italy")
  tier: 1 | 2;     // 1 = top flight, 2 = second division
  name: string;    // "English Division 1"
}
export function englandCompetitions(): Competition[];
export function competitionOf(competitions: Competition[], compId: number): Competition;
export function tierOf(competitions: Competition[], compId: number): 1 | 2;
/** The other tier's competition in the same country (D1↔D2 partner). */
export function partnerOf(competitions: Competition[], compId: number): Competition;
/** Unique country names, in table order. */
export function countriesOf(competitions: Competition[]): string[];
```

- [ ] **Step 1: Write the failing test**

```ts
// test/core/competitions.test.ts
import { describe, expect, it } from "vitest";
import {
  englandCompetitions, competitionOf, tierOf, partnerOf, countriesOf,
} from "../../src/core/competitions.js";

describe("competitions", () => {
  const comps = englandCompetitions();

  it("england table has ids 0/1 matching the legacy division values", () => {
    expect(comps).toEqual([
      { id: 0, country: "England", tier: 1, name: "English Division 1" },
      { id: 1, country: "England", tier: 2, name: "English Division 2" },
    ]);
  });

  it("helpers look up by compId", () => {
    expect(competitionOf(comps, 1).name).toBe("English Division 2");
    expect(tierOf(comps, 0)).toBe(1);
    expect(tierOf(comps, 1)).toBe(2);
    expect(partnerOf(comps, 0).id).toBe(1);
    expect(partnerOf(comps, 1).id).toBe(0);
    expect(countriesOf(comps)).toEqual(["England"]);
  });

  it("competitionOf throws on an unknown compId", () => {
    expect(() => competitionOf(comps, 99)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/competitions.test.ts`
Expected: FAIL — cannot resolve `src/core/competitions.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/core/competitions.ts
/**
 * A competition is one league a set of clubs plays in — one entry per
 * division per country. Teams point at a competition via StoredTeam.compId.
 * England-only today; PR 2 ("the world") adds Spain and Italy as more rows.
 * Ids are stable forever within a save: an old save's legacy division values
 * (0 = English D1, 1 = English D2) are already valid compIds by construction.
 */
export interface Competition {
  id: number;
  country: string;
  tier: 1 | 2;
  name: string;
}

export function englandCompetitions(): Competition[] {
  return [
    { id: 0, country: "England", tier: 1, name: "English Division 1" },
    { id: 1, country: "England", tier: 2, name: "English Division 2" },
  ];
}

export function competitionOf(competitions: Competition[], compId: number): Competition {
  const comp = competitions.find((c) => c.id === compId);
  if (!comp) throw new Error(`Unknown compId ${compId}`);
  return comp;
}

export function tierOf(competitions: Competition[], compId: number): 1 | 2 {
  return competitionOf(competitions, compId).tier;
}

export function partnerOf(competitions: Competition[], compId: number): Competition {
  const comp = competitionOf(competitions, compId);
  const partner = competitions.find((c) => c.country === comp.country && c.id !== comp.id);
  if (!partner) throw new Error(`No partner competition for compId ${compId}`);
  return partner;
}

export function countriesOf(competitions: Competition[]): string[] {
  return [...new Set(competitions.map((c) => c.country))];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/competitions.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/competitions.ts test/core/competitions.test.ts
git commit -m "Add competitions module: leagues as data instead of hardcoded 0/1"
```

---

### Task 2: Finance takes tier, not division

**Files:**
- Modify: `src/core/finance/budget.ts` (all five exported functions' `division` params)
- Modify callers: `src/core/teams/clubs.ts:109`, `src/core/offseason.ts:112,210`, `src/core/transfers/negotiation.ts:196`, `src/db/migrate.ts:144`
- Test: existing `test/core/finance/*.test.ts` (update call sites only — no new tests)

**Interfaces:**
- Produces: `budget.ts` signatures change `division: 0 | 1` → `tier: 1 | 2` (same order, same position):
  - `clampBudget(budget: number, tier: 1 | 2): number`
  - `successPayout(rank: number, tier: 1 | 2): number`
  - `seasonRevenue(rank: number, hype: number, tier: 1 | 2): SeasonRevenue`
  - `settleSeasonEnd(currentBudget, rank, hype, scoutingSpend, tier: 1 | 2): number`
  - `chargeSeasonStart(currentBudget: number, wages: number, tier: 1 | 2): number`
- Consumes: nothing from Task 1 yet — callers in this task translate mechanically (`t.division === 0 ? 1 : 2`); Task 3 replaces those expressions with `tierOf(...)`.

- [ ] **Step 1: Change `budget.ts`**

Rename the private `divisionScale` to `tierScale` and flip the comparison; change every exported signature's `division: 0 | 1` to `tier: 1 | 2` and pass `tier` through:

```ts
function tierScale(tier: 1 | 2): number {
  return tier === 1 ? 1 : DIVISION_2_BUDGET_SCALE;
}
```

Every body change is mechanical: `divisionScale(division)` → `tierScale(tier)`, `successPayout(rank, division)` → `successPayout(rank, tier)`, etc. Keep all constants and doc comments (update the words "Division 2" → "tier 2" only where they describe the parameter).

- [ ] **Step 2: Update the four callers**

At each site, translate the legacy 0/1 value inline (temporary until Task 3):

- `src/core/teams/clubs.ts:109`: `chargeSeasonStart(0, wageBill(...), t.division === 0 ? 1 : 2)`
- `src/core/offseason.ts:112`: `settleSeasonEnd(t.budget, rank, t.hype, t.scoutingSpend, division === 0 ? 1 : 2)`
- `src/core/offseason.ts:210`: `chargeSeasonStart(t.budget, wageBill(...), t.division === 0 ? 1 : 2)`
- `src/core/transfers/negotiation.ts:196`: `clampBudget(t.budget + fee, t.division === 0 ? 1 : 2)`
- `src/db/migrate.ts:144`: `chargeSeasonStart(0, wageBill(t.roster, salaryMap), (t.division ?? 0) === 0 ? 1 : 2)`

Also grep for any other caller this list missed and translate it the same way:

Run: `grep -rn "clampBudget\|successPayout\|seasonRevenue\|settleSeasonEnd\|chargeSeasonStart" src test --include="*.ts" --include="*.tsx" -l`

Update every test file in that list to pass `1`/`2` where it passed `0`/`1` (the meaning maps 0→1, 1→2).

- [ ] **Step 3: Typecheck and run finance tests**

Run: `npx tsc --noEmit && npx vitest run test/core/finance`
Expected: clean typecheck, finance tests PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Finance functions take tier (1|2) instead of division (0|1)"
```

---

### Task 3: Rename division → compId and thread the competitions table

This is the big mechanical task. It must land as one commit because the type rename doesn't compile halfway.

**Files:**
- Modify: `src/core/league/generate.ts`, `src/core/teams/clubs.ts`, `src/core/leagueState.ts`, `src/core/offseason.ts`, `src/core/simThrough.ts`, `src/core/promotion.ts`, `src/core/ai/clubContext.ts`, `src/core/ai/divisionCeiling.ts`, `src/core/ai/breakoutRefusal.ts`, `src/core/ai/transferMarket.ts`, `src/core/transfers/negotiation.ts`, `src/db/migrate.ts`, `src/core/constants.ts`, UI pages (`src/ui/pages/Standings.tsx, Leaders.tsx, Dashboard.tsx, Finance.tsx, Roster.tsx, PowerRankings.tsx, PlayerProfile.tsx`), and any file the compiler flags.
- Test: all existing suites (scoped runs below), no new tests.

**Interfaces:**
- Produces:
  - `LeagueTeam.compId: number` and `StoredTeam.compId: number` (renamed from `division`; `divisionConvergence` keeps its name — it describes academyBase convergence, still accurate).
  - `LeagueStore.competitions: Competition[]` — new persisted field, first field after `players`.
  - `createLeagueState` builds `competitions: englandCompetitions()` and generates one schedule per competition.
  - `assignIdentities(league: League, competitions: Competition[]): StoredTeam[]` — gains the table to compute tier for `chargeSeasonStart`.
  - `wouldRefuseExtension(player: Player, currentTeam: StoredTeam, competitions: Competition[]): boolean` — tier-2 check via `tierOf`.
  - `enforceDivision2Ceiling(teams, players, transfers, season, userTid, competitions: Competition[])` — sweeps ALL tier-2 comps into ALL tier-1 clubs (cross-border by spec; England-only today so behavior-identical).
  - `deriveLeagueContexts` groups by `compId` (loop over `league.competitions` instead of `[0, 1] as const`).
- Consumes: `Competition`, `englandCompetitions`, `tierOf`, `competitionOf` from Task 1.

- [ ] **Step 1: Rename the fields**

In `src/core/league/generate.ts`: rename `LeagueTeam.division` → `compId` (and the `division` parameter of `generateDivisionTeams` → `compId`). In `src/core/teams/clubs.ts`: rename `StoredTeam.division` → `compId`; update its doc comment to "Which competition this club currently plays in (see src/core/competitions.ts). Changes on promotion/relegation."

- [ ] **Step 2: Add `competitions` to `LeagueStore` and creation**

In `src/core/leagueState.ts`:

```ts
import { englandCompetitions, type Competition } from "./competitions.js";

export interface LeagueStore {
  // ... existing fields ...
  /** The leagues in this save's world, one entry per division per country (see competitions.ts). */
  competitions: Competition[];
  // ... rest unchanged ...
}

export function createLeagueState(userTid: number, rng: () => number, seed = 0): LeagueStore {
  const league = generateTwoDivisionLeague(rng, seed);
  const competitions = englandCompetitions();
  const teams = assignIdentities(league, competitions);
  const schedule = competitions.flatMap((comp) =>
    generateSchedule(teams.filter((t) => t.compId === comp.id).map((t) => t.tid)),
  );
  return { /* existing literal */, competitions, teams, schedule };
}
```

In `src/core/teams/clubs.ts`, `assignIdentities` gains the parameter and uses `tierOf`:

```ts
export function assignIdentities(league: League, competitions: Competition[]): StoredTeam[] {
  // ...
  const budget = chargeSeasonStart(0, wageBill(t.roster, salaryMap), tierOf(competitions, t.compId));
  // ... compId: t.compId instead of division: t.division ...
}
```

- [ ] **Step 3: Chase the compiler through core**

Run `npx tsc --noEmit` repeatedly; at each error site apply the matching translation (all behavior-identical for the 2-entry England table):

- **`src/core/simThrough.ts:170-176`** — replace the d1/d2 pair with a loop:

```ts
const matchData = new Map<number, TeamMatchData>();
for (const comp of league.competitions) {
  const compTeams = currentTeams.filter((t) => t.compId === comp.id);
  const compMatchData = leagueMatchData({ teams: toLeagueTeams(compTeams), players: currentPlayers });
  compTeams.forEach((t, i) => matchData.set(t.tid, compMatchData[i]));
}
```

(`toLeagueTeams` line 113: `division: t.division` → `compId: t.compId`.)

- **`src/core/ai/clubContext.ts:149-150`** — `deriveLeagueContexts` already receives the whole `league`; replace `for (const division of [0, 1] as const)` with `for (const comp of league.competitions)` and `raw.filter((r) => r.division === division)` with `raw.filter((r) => r.compId === comp.id)` (rename the `division` field in the internal `raw` row type to `compId`).

- **`src/core/ai/breakoutRefusal.ts`** — new signature; "tier 2 player wants top-flight football":

```ts
export function wouldRefuseExtension(
  player: Player, currentTeam: StoredTeam, competitions: Competition[],
): boolean {
  return tierOf(competitions, currentTeam.compId) === 2
    && player.ovr >= DIVISION_2_REFUSAL_OVR_THRESHOLD;
}
```

Update its callers (grep `wouldRefuseExtension`; they live in `src/core/transfers/negotiation.ts`, `src/core/transfers/recommendations.ts`, `src/ui/context/LeagueContext.tsx`, and UI pages) to pass `league.competitions` — every caller has a `LeagueStore` in scope.

- **`src/core/ai/divisionCeiling.ts`** — add the `competitions: Competition[]` parameter (last). Replace the two division checks with tier checks so the sweep is cross-border-by-construction (identical behavior with England only):

```ts
const tierByTid = new Map(teams.map((t) => [t.tid, tierOf(competitions, t.compId)]));
// qualifying filter: tierByTid.get(tid) === 2 && tid !== userTid
// d1Candidates filter: tier === 1 && tid !== userTid
```

- **`src/core/ai/transferMarket.ts:174`** — `sellerDivision` is only used for `clampBudget`; replace with `const sellerTier = tierOf(competitions, teams.find((t) => t.tid === c.sellerTid)!.compId)` — `runAITransferMarket` must gain a `competitions: Competition[]` parameter (thread from both callers: `simOffseason` and `simThrough`'s winter block).

- **`src/core/transfers/negotiation.ts:196`** — replace Task 2's temporary ternary with `tierOf(competitions, t.compId)`; `executeTransfer` gains a `competitions` parameter, threaded from its callers (grep `executeTransfer`).

- **`src/core/promotion.ts` + `src/core/offseason.ts` + `src/core/constants.ts`** — handled in Task 4; for THIS task only make them compile with minimal edits: `t.division` → `t.compId`, `division: 0 as const` → `compId: 0`, and `DIVISION_ACADEMY_BASE_CENTER[t.division]` → `DIVISION_ACADEMY_BASE_CENTER[t.compId]` (valid for England-only ids 0/1; Task 4 replaces it properly). `awardsByDivision`'s `rosterOf` filter becomes `t.compId === division`.

- **`src/db/migrate.ts`** — old saves store `division`/no `competitions`. The legacy type keeps `division?: 0 | 1`; the migrated output maps it:

```ts
competitions: stored.competitions ?? englandCompetitions(),
// per team:
compId: t.compId ?? t.division ?? 0,
```

(Add `compId` to the Partial in the legacy team type. `divisionsByTid` in history entries: leave as-is this task; Task 5 renames it.)

- [ ] **Step 4: Chase the compiler through the UI**

Mechanical in every page: `t.division` → `t.compId`, `userTeam.division` → `userTeam.compId`, dropdown state `useState<0 | 1>(0)` → `useState<number>(0)` with options built from `league.competitions` (`comp.name` as the label — replaces hardcoded "Division 1"/"Division 2" strings; `PowerRankings.tsx:91` and `PlayerProfile.tsx:115` use `competitionOf(league.competitions, team.compId).name`). `Roster.tsx:203`'s `userTeam.division !== 1` becomes `tierOf(league.competitions, userTeam.compId) !== 2`. `PowerRankings.tsx:89`'s badge class keys off `tierOf(...) === 1`. Visual output must be unchanged.

- [ ] **Step 5: Typecheck, update test fixtures, run core suites**

Run: `npx tsc --noEmit`
Expected: clean. Then fix test fixtures the same mechanical way (`division:` → `compId:` in team literals; add `competitions: englandCompetitions()` to any hand-built `LeagueStore` fixture; add the new params to direct calls of `assignIdentities`/`wouldRefuseExtension`/`enforceDivision2Ceiling`/`runAITransferMarket`/`executeTransfer`).

Run: `npx vitest run test/core test/db`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Rename division to compId; add LeagueStore.competitions; thread table to consumers"
```

---

### Task 4: Generalize promotion/relegation and the offseason loop

**Files:**
- Modify: `src/core/promotion.ts`, `src/core/offseason.ts`, `src/core/constants.ts:111-113`
- Test: existing `test/core/promotion.test.ts`, `test/core/offseason.test.ts` (update signatures; no new tests)

**Interfaces:**
- Produces:

```ts
// promotion.ts — replaces computeDivisionSwap/applyDivisionSwap
export interface CompetitionSwap {
  d1CompId: number;  // the country's tier-1 competition
  d2CompId: number;  // the country's tier-2 competition
  promoted: number[]; // tids moving d2 -> d1
  relegated: number[]; // tids moving d1 -> d2
}
export function computeCountrySwaps(
  competitions: Competition[],
  tablesByCompId: Map<number, StandingsRow[]>,
): CompetitionSwap[];
export function applyCompetitionSwaps(teams: StoredTeam[], swaps: CompetitionSwap[]): StoredTeam[];
export function stepAcademyBaseConvergence(teams: StoredTeam[], competitions: Competition[]): StoredTeam[];
```

```ts
// constants.ts — replace the division-indexed pair with a tier-keyed lookup (same values)
/** Center strength each tier's academyBase converges toward after a swap. */
export const ACADEMY_BASE_CENTER_BY_TIER: Record<1 | 2, number> = {
  1: LEAGUE_BASE,
  2: LEAGUE_BASE - DIVISION_2_OFFSET,
};
```

- Consumes: `partnerOf`, `tierOf` (Task 1); `compId` fields (Task 3).

- [ ] **Step 1: Rewrite `promotion.ts`**

```ts
export function computeCountrySwaps(
  competitions: Competition[],
  tablesByCompId: Map<number, StandingsRow[]>,
): CompetitionSwap[] {
  return competitions
    .filter((c) => c.tier === 1)
    .map((d1) => {
      const d2 = partnerOf(competitions, d1.id);
      const d1Table = tablesByCompId.get(d1.id)!;
      const d2Table = tablesByCompId.get(d2.id)!;
      return {
        d1CompId: d1.id,
        d2CompId: d2.id,
        promoted: d2Table.slice(0, PROMOTION_RELEGATION_COUNT).map((r) => r.tid),
        relegated: d1Table.slice(-PROMOTION_RELEGATION_COUNT).map((r) => r.tid),
      };
    });
}

export function applyCompetitionSwaps(teams: StoredTeam[], swaps: CompetitionSwap[]): StoredTeam[] {
  const moveTo = new Map<number, number>(); // tid -> new compId
  for (const s of swaps) {
    for (const tid of s.promoted) moveTo.set(tid, s.d1CompId);
    for (const tid of s.relegated) moveTo.set(tid, s.d2CompId);
  }
  return teams.map((t) =>
    moveTo.has(t.tid)
      ? { ...t, compId: moveTo.get(t.tid)!, divisionConvergence: { seasonsRemaining: ACADEMY_BASE_CONVERGENCE_SEASONS } }
      : t,
  );
}

export function stepAcademyBaseConvergence(teams: StoredTeam[], competitions: Competition[]): StoredTeam[] {
  return teams.map((t) => {
    if (!t.divisionConvergence) return t;
    const center = ACADEMY_BASE_CENTER_BY_TIER[tierOf(competitions, t.compId)];
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

Keep the existing doc comments (the "must NEVER pull every team toward the average" warning on `stepAcademyBaseConvergence` in particular).

- [ ] **Step 2: Rewrite `simOffseason`'s pair-hardcoded steps as competition loops**

In `src/core/offseason.ts`, replacing steps 3.5-3.7 and 7's d1/d2 literals:

```ts
// 3.5 per-competition standings + settlement
const tablesByCompId = new Map<number, StandingsRow[]>();
for (const comp of league.competitions) {
  const compTids = teams.filter((t) => t.compId === comp.id).map((t) => t.tid);
  const compTidSet = new Set(compTids);
  tablesByCompId.set(comp.id, computeStandings(compTids, league.played.filter((m) => compTidSet.has(m.home))));
}
const standings = [...tablesByCompId.values()].flat();

const settle = (rows: StandingsRow[], tier: 1 | 2, compSize: number): void => {
  // identical to today, with `division` replaced by `tier` and defaultRank = compSize
};
for (const comp of league.competitions) {
  const table = tablesByCompId.get(comp.id)!;
  settle(table, comp.tier, table.length);
}

// 3.6
const swaps = computeCountrySwaps(league.competitions, tablesByCompId);
teams = applyCompetitionSwaps(teams, swaps);
teams = stepAcademyBaseConvergence(teams, league.competitions);
```

Leave `awardsByDivision` returning its tuple in this task (its filters were already switched to `compId` in Task 3) — Task 5 rewrites it together with the history-entry shape, so each task compiles on its own.

Step 7's schedule: `const schedule = league.competitions.flatMap((comp) => generateSchedule(teams.filter((t) => t.compId === comp.id).map((t) => t.tid)));`

The `NUM_TEAMS`/`NUM_TEAMS_D2` defaultRank import usage disappears (covered by `compSize`); drop the now-unused imports if the compiler agrees.

- [ ] **Step 3: Typecheck and run scoped tests**

Run: `npx tsc --noEmit && npx vitest run test/core/promotion.test.ts test/core/offseason.test.ts`
Expected: PASS after mechanically updating the two test files to the new function names/signatures.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Generalize promotion/relegation and offseason settlement to N competitions"
```

---

### Task 5: SeasonHistoryEntry shape + save migration

**Files:**
- Modify: `src/core/standings.ts:51-60`, `src/core/offseason.ts` (history append), `src/db/migrate.ts`, UI consumers (`src/ui/pages/Standings.tsx`, `src/ui/pages/Leaders.tsx`, `src/ui/pages/PlayerProfile.tsx`, grep `divisionsByTid\|\.awards\|championTid` across `src/ui`)
- Test: existing `test/db/migrate.test.ts` — extend ONE existing backfill test case to assert the new fields (do not add a new test file)

**Interfaces:**
- Produces (new `SeasonHistoryEntry`):

```ts
export interface SeasonHistoryEntry {
  season: number;
  table: StandingsRow[];          // all competitions' rows concatenated (as today)
  teamStats: TeamSeasonStats[];
  /** Awards per competition, keyed by compId. */
  awards: Record<number, SeasonAwards>;
  /** Each team's compId during this season (snapshotted before any swap). */
  compsByTid: Record<number, number>;
  /** Each tier-1 competition's champion, keyed by compId. */
  championTidByCompId: Record<number, number>;
}
```

(`championTid` and `divisionsByTid` are removed; `awards` changes from a 2-tuple to a Record.)

- [ ] **Step 1: Change the type and the producer**

Update `standings.ts` to the interface above. In `simOffseason`: `compsByTid` snapshot replaces `divisionsByTid` (same loop, `t.compId`); rewrite `awardsByDivision` as `awardsByCompetition` returning the Record shape:

```ts
function awardsByCompetition(
  players: Player[], teams: StoredTeam[], competitions: Competition[], season: number,
): Record<number, SeasonAwards> {
  const result: Record<number, SeasonAwards> = {};
  for (const comp of competitions) {
    const roster = new Set(teams.filter((t) => t.compId === comp.id).flatMap((t) => t.roster));
    result[comp.id] = computeSeasonAwards(players.filter((p) => roster.has(p.pid)), season);
  }
  return result;
}
```

The history append becomes:

```ts
const championTidByCompId: Record<number, number> = {};
for (const comp of league.competitions) {
  if (comp.tier === 1) championTidByCompId[comp.id] = tablesByCompId.get(comp.id)![0].tid;
}
// ... in seasonHistory push: { season: endingSeason, table: standings, teamStats, awards, compsByTid, championTidByCompId }
```

- [ ] **Step 2: Migrate old entries**

In `src/db/migrate.ts`, the legacy history type keeps optional `divisionsByTid`, `championTid`, and tuple `awards`; migration maps them (England-only ids, so division === compId):

```ts
const compsByTid: Record<number, number> =
  h.compsByTid ?? h.divisionsByTid ?? backfilledFromTeams; // existing division backfill logic, renamed
const awards: Record<number, SeasonAwards> = Array.isArray(h.awards)
  ? { 0: h.awards[0], 1: h.awards[1] }
  : h.awards;
const championTidByCompId: Record<number, number> =
  h.championTidByCompId ?? { 0: h.championTid ?? h.table[0].tid };
```

(Preserve the existing recompute-awards fallback path for pre-awards saves, producing the Record shape directly.)

- [ ] **Step 3: Update UI consumers**

- `Standings.tsx:40-46`: filter history rows by `entry.compsByTid[tid] === selectedCompId`; champion is `entry.championTidByCompId[selectedCompId] ?? standings[0]?.tid` (tier-2 comps have no stored champion — keep today's "(1st)" label behavior for tier 2 via `tierOf`).
- `Leaders.tsx:333`: `divisionsByTid[s.tid] === division` → `compsByTid[s.tid] === compId`.
- `PlayerProfile.tsx:86`: `for (const divisionAwards of entry.awards)` → `for (const compAwards of Object.values(entry.awards))`.

- [ ] **Step 4: Extend the migration test**

In `test/db/migrate.test.ts`, find the existing test that feeds a pre-second-division save through `migrateLeague` and add assertions to it:

```ts
expect(migrated.competitions).toEqual([
  { id: 0, country: "England", tier: 1, name: "English Division 1" },
  { id: 1, country: "England", tier: 2, name: "English Division 2" },
]);
expect(migrated.teams.every((t) => t.compId === 0 || t.compId === 1)).toBe(true);
// on a fixture with seasonHistory:
expect(migrated.seasonHistory[0].championTidByCompId[0]).toBe(/* fixture's old championTid */);
expect(Array.isArray(migrated.seasonHistory[0].awards)).toBe(false);
```

- [ ] **Step 5: Typecheck and run scoped tests**

Run: `npx tsc --noEmit && npx vitest run test/db test/core/offseason.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "SeasonHistoryEntry: per-competition awards/champions, compsByTid; migrate old saves"
```

---

### Task 6: Full-suite gate, behavior spot-check, PR

**Files:**
- Modify: `CLAUDE.md` (milestone note), possibly stragglers the suite finds.

- [ ] **Step 1: Full test suite (the one full run for this PR)**

Run: `npm test`
Expected: all tests pass (423 pre-existing, adjusted, + the ~4 new ones from Tasks 1 and 5). Fix any straggler mechanically (they'll all be signature/fixture drift from Tasks 2-5, not behavior).

- [ ] **Step 2: Behavior-identical spot-check**

The refactor's core promise. Verify the app boots and an old save loads:

Run: `npm run build`
Expected: clean production build. Then a single quick browser pass (use the project's `verify` skill): open the app, load an existing save (exercises migration), check Standings shows both divisions with correct names and the Dashboard renders. No dynasty audit for this PR — nothing numeric changed by design.

- [ ] **Step 3: Update CLAUDE.md**

Add one paragraph to the "Second division (promotion/relegation)" section (or a new "More leagues" section stub): competitions are now data (`src/core/competitions.ts`, `LeagueStore.competitions`), `division` is renamed `compId`, finance keys off tier — pointing at the spec for the Spain/Italy follow-up. This is a milestone-significant architectural change per the file's own rules.

- [ ] **Step 4: Commit and open the PR**

```bash
git add -A && git commit -m "Update CLAUDE.md for competitions-as-data refactor"
git push -u origin HEAD
gh pr create --title "Competitions as data (more-leagues PR 1/3): division -> compId refactor" \
  --body "Behavior-identical refactor per docs/superpowers/specs/2026-07-16-more-leagues-design.md. England-only competitions table; PR 2 adds Spain/Italy.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Not in this plan (later PRs per the spec)

- **PR 2 (the world)**: `generateWorld` over 6 competitions, 80 new club identities, per-competition nationality weighting, the one 20-season dynasty audit.
- **PR 3 (UI)**: creation-flow country step, competition dropdowns grouped by country, Finance filter, Manual section.
Their plans get written after PR 1 merges, against the post-refactor code.
