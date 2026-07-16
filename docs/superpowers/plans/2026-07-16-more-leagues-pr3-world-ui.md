# More Leagues PR 3 (World UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the already-built `generateWorld()`/`worldCompetitions()` (PR 2) into real new-save creation, and update every UI page that still assumes exactly two English divisions so a genuine England/Spain/Italy world is playable end to end.

**Architecture:** `createLeagueState` switches its generation call from `generateTwoDivisionLeague()`/`englandCompetitions()` to `generateWorld()`/`worldCompetitions()` — this is the one production code change that actually turns new saves into world saves; everything else in this plan is UI/test fallout from that switch. Pages that hardcoded a `0 | 1` "division" toggle become generic over `league.competitions`, grouped by country, defaulting to the user's own competition wherever a default is needed. Existing saves are untouched (they already migrated to a 2-entry England-only `competitions` table in PR 1 and `createLeagueState` is never called again on an existing save).

**Tech Stack:** TypeScript, React, Vitest. No new dependencies.

## Global Constraints

- Existing saves stay England-only forever — this plan only changes what a *new* save generates and how the UI displays an arbitrary-length `competitions` table. No migration changes.
- Equal siblings: no new tuning constants, no per-country UI differentiation beyond names/flags.
- Testing stays lean per the design spec: TDD for the one piece of new pure logic (`countryClubRanges`) and for `createLeagueState`'s new shape; everything else is UI wiring verified by a browser smoke test, not new component-test infrastructure (this repo has no React testing library installed — don't add one).
- Run only the directly-relevant test file(s) after each task; run the full suite once, at the end, as the final gate.
- The one dynasty audit the design spec calls for is explicitly deferred to *after* this PR lands — do not build it into this plan.

---

### Task 1: Wire `createLeagueState` to `generateWorld()`/`worldCompetitions()`

**Files:**
- Modify: `src/core/leagueState.ts:9,12,61-88` (imports + `createLeagueState` body)
- Modify: `test/core/leagueState.test.ts` (rewrite the count assertions for world scale)
- Modify: `test/core/offseason.test.ts:32,43,137` (three assertions that hardcode English-only totals)

**Interfaces:**
- Consumes: `generateWorld(rng, seed)` and `worldCompetitions()` from `src/core/league/generate.ts` / `src/core/competitions.ts` (both already exist, shipped in PR 2, unchanged by this task).
- Produces: `createLeagueState(userTid, rng, seed?)` now returns a 120-team, 6-competition `LeagueStore` for any `userTid` in `[0, 120)`. Every other exported symbol in `leagueState.ts` (`LeagueStore`, `buildCompetitionSchedule`) is unchanged.

- [ ] **Step 1: Update the failing test expectations first**

Replace the body of `test/core/leagueState.test.ts` with:

```typescript
import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";

describe("createLeagueState", () => {
  const state = createLeagueState(3, mulberry32(42));

  it("returns correct shape", () => {
    expect(state).toHaveProperty("lid");
    expect(state).toHaveProperty("meta");
    expect(state).toHaveProperty("teams");
    expect(state).toHaveProperty("players");
    expect(state).toHaveProperty("season");
    expect(state).toHaveProperty("phase");
    expect(state).toHaveProperty("schedule");
    expect(state).toHaveProperty("played");
    expect(state).toHaveProperty("competitions");
  });

  it("has 6 competitions (3 countries x 2 tiers) and 120 teams (20 per competition)", () => {
    expect(state.competitions).toHaveLength(6);
    expect(state.teams).toHaveLength(120);
    const validCompIds = new Set(state.competitions.map((c) => c.id));
    for (const t of state.teams) {
      expect(typeof t.name).toBe("string");
      expect(t.name.length).toBeGreaterThan(0);
      expect(typeof t.abbrev).toBe("string");
      expect(t.abbrev.length).toBeGreaterThan(0);
      expect(t.colors).toHaveLength(2);
      expect(typeof t.colors[0]).toBe("string");
      expect(typeof t.colors[1]).toBe("string");
      expect(t.roster.length).toBeGreaterThan(0);
      expect(validCompIds.has(t.compId)).toBe(true);
    }
    for (const comp of state.competitions) {
      expect(state.teams.filter((t) => t.compId === comp.id)).toHaveLength(20);
    }
  });

  it("has 3000 players (120 teams x 25 players)", () => {
    expect(state.players).toHaveLength(3000);
  });

  it("has 2280 scheduled games (380 per competition x 6), each within one competition", () => {
    expect(state.schedule).toHaveLength(2280);
    const compByTid = new Map(state.teams.map((t) => [t.tid, t.compId]));
    for (const g of state.schedule) {
      expect(g).toHaveProperty("matchday");
      expect(g).toHaveProperty("home");
      expect(g).toHaveProperty("away");
      expect(typeof g.matchday).toBe("number");
      expect(compByTid.get(g.home)).toBe(compByTid.get(g.away));
    }
  });

  it("phase is 'regular', season is 1, played is empty", () => {
    expect(state.phase).toBe("regular");
    expect(state.season).toBe(1);
    expect(state.played).toEqual([]);
  });

  it("meta.userTid matches the input", () => {
    expect(state.meta.userTid).toBe(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/core/leagueState.test.ts`
Expected: FAIL — `state.teams` has length 40, not 120 (createLeagueState still generates England-only).

- [ ] **Step 3: Switch `createLeagueState`'s generation call**

In `src/core/leagueState.ts`, change the imports on lines 9 and 12:

```typescript
import { generateWorld } from "./league/generate.js";
import { assignIdentities } from "./teams/clubs.js";
import { generateSchedule } from "./schedule.js";
import { worldCompetitions } from "./competitions.js";
```

(`generateTwoDivisionLeague` and `englandCompetitions` are no longer used in this file — remove those two named imports entirely rather than leaving them unused.)

Then in `createLeagueState` (currently lines 61-88), change the first two lines of the body:

```typescript
export function createLeagueState(userTid: number, rng: () => number, seed = 0): LeagueStore {
  const league = generateWorld(rng, seed);
  const competitions = worldCompetitions();
  const teams = assignIdentities(league, competitions);
  const schedule = buildCompetitionSchedule(teams, competitions);
  // ... rest of the function body is unchanged
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/core/leagueState.test.ts`
Expected: PASS (all 6 tests)

- [ ] **Step 5: Fix the three now-broken assertions in `offseason.test.ts`**

In `test/core/offseason.test.ts`:

Line 32, inside `"advances the season, resets schedule/played, and returns to regular phase"`:
```typescript
    expect(next.schedule).toHaveLength(2280);
```

Line 43, inside `"every team still fields a full 25-man roster after progression/retirement/FA/youth"`:
```typescript
    expect(next.teams).toHaveLength(3 * (NUM_TEAMS + NUM_TEAMS_D2));
```

Line 137, inside `"settles every team's budget and hype, and resets scouting spend to the default for the new season"`:
```typescript
    expect(next.teams).toHaveLength(3 * (NUM_TEAMS + NUM_TEAMS_D2));
```

(`NUM_TEAMS` and `NUM_TEAMS_D2` are already imported at the top of this file — no import changes needed. The `d1Before`/`d2Before`/`d1After`/`d2After` assertions elsewhere in this file that check `=== 20` for `compId === 0` / `compId === 1` stay correct unchanged: England's D1/D2 still have exactly 20 teams each in a 120-team world.)

- [ ] **Step 6: Run the full offseason test file to verify it passes**

Run: `npx vitest run test/core/offseason.test.ts`
Expected: PASS (all tests). This file now runs at world scale (120 teams instead of 40), so expect it to take noticeably longer than before — that's an accepted cost of the switch, not a bug.

- [ ] **Step 7: Commit**

```bash
git add src/core/leagueState.ts test/core/leagueState.test.ts test/core/offseason.test.ts
git commit -m "Wire createLeagueState to generateWorld/worldCompetitions"
```

---

### Task 2: Country-scoped club picker on New League

**Files:**
- Create: `src/core/competitions.ts` — add `countryClubRanges()` (pure helper)
- Test: `test/core/competitions.test.ts` — add tests for `countryClubRanges()`
- Modify: `src/ui/pages/NewLeague.tsx` — country step before the club list; remove the old `CLUBS.slice` clamp

**Interfaces:**
- Consumes: `worldCompetitions()`, `tier1Pairs()`, `countriesOf()` (all already exist in `src/core/competitions.ts`); `NUM_TEAMS`, `NUM_TEAMS_D2` from `src/core/constants.ts`; `CLUBS` from `src/core/teams/clubs.ts`.
- Produces: `countryClubRanges(competitions: Competition[], teamsPerTier1: number, teamsPerTier2: number): { country: string; start: number; end: number }[]` — one entry per country, `start`/`end` being the half-open `[start, end)` tid range (and therefore `CLUBS` index range) that country occupies. Used by `NewLeague.tsx` to slice `CLUBS` per country without hardcoding "40 tids per country" in a UI file.

- [ ] **Step 1: Write the failing test**

Add to `test/core/competitions.test.ts`:

```typescript
import { countryClubRanges, worldCompetitions } from "../../src/core/competitions.js";
import { NUM_TEAMS, NUM_TEAMS_D2 } from "../../src/core/constants.js";

describe("countryClubRanges", () => {
  it("splits the world into 3 contiguous 40-wide ranges, in table order", () => {
    const ranges = countryClubRanges(worldCompetitions(), NUM_TEAMS, NUM_TEAMS_D2);
    expect(ranges).toEqual([
      { country: "England", start: 0, end: 40 },
      { country: "Spain", start: 40, end: 80 },
      { country: "Italy", start: 80, end: 120 },
    ]);
  });

  it("matches generateWorld's actual tid layout", () => {
    // Cross-check against the real generator rather than re-deriving the
    // layout by hand — a regression guard, same spirit as clubs.test.ts's
    // CLUBS/tid regression test.
    const ranges = countryClubRanges(worldCompetitions(), NUM_TEAMS, NUM_TEAMS_D2);
    expect(ranges.reduce((sum, r) => sum + (r.end - r.start), 0)).toBe(120);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/core/competitions.test.ts`
Expected: FAIL with `countryClubRanges is not a function`

- [ ] **Step 3: Implement `countryClubRanges`**

Add to `src/core/competitions.ts`, after `tier1Pairs`:

```typescript
export interface CountryClubRange {
  country: string;
  /** Inclusive start tid (== CLUBS index) for this country's block. */
  start: number;
  /** Exclusive end tid (== CLUBS index) for this country's block. */
  end: number;
}

/**
 * The tid/CLUBS-index range each country occupies, derived the same way
 * generateWorld() assigns tids (tier1Pairs() order, tier-1 block then
 * tier-2 block per country) rather than a hardcoded "40 per country"
 * literal — so a future country added to worldCompetitions() is picked up
 * automatically. teamsPerTier1/teamsPerTier2 are passed in (NUM_TEAMS/
 * NUM_TEAMS_D2 from constants.ts) rather than imported here to keep this
 * file free of a dependency on team-count constants it otherwise has no
 * reason to know about.
 */
export function countryClubRanges(
  competitions: Competition[],
  teamsPerTier1: number,
  teamsPerTier2: number,
): CountryClubRange[] {
  const ranges: CountryClubRange[] = [];
  let cursor = 0;
  for (const { d1 } of tier1Pairs(competitions)) {
    const count = teamsPerTier1 + teamsPerTier2;
    ranges.push({ country: d1.country, start: cursor, end: cursor + count });
    cursor += count;
  }
  return ranges;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/core/competitions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the helper**

```bash
git add src/core/competitions.ts test/core/competitions.test.ts
git commit -m "Add countryClubRanges helper for the New League country picker"
```

- [ ] **Step 6: Add a country step to `NewLeague.tsx`**

Replace the full contents of `src/ui/pages/NewLeague.tsx` with:

```tsx
import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CLUBS } from "../../core/teams/clubs.js";
import { createLeagueState, type LeagueStore } from "../../core/leagueState.js";
import { applyTeamIdentities } from "../../core/teams/customize.js";
import { mulberry32 } from "../../engine/rng.js";
import { useLeague } from "../context/LeagueContext.js";
import { NUM_TEAMS, NUM_TEAMS_D2 } from "../../core/constants.js";
import { worldCompetitions, countryClubRanges, countriesOf } from "../../core/competitions.js";
import { TeamIdentityEditor, type EditableTeam } from "../components/TeamIdentityEditor.js";

const COUNTRY_RANGES = countryClubRanges(worldCompetitions(), NUM_TEAMS, NUM_TEAMS_D2);
const COUNTRIES = countriesOf(worldCompetitions());

export function NewLeague() {
  const [country, setCountry] = useState<string | null>(null);
  const [selectedTid, setSelectedTid] = useState<number | null>(null);
  const [pending, setPending] = useState<LeagueStore | null>(null);
  const [saving, setSaving] = useState(false);
  const { setLeague, importJSON } = useLeague();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customize = searchParams.get("customize") === "1";
  const fileInputRef = useRef<HTMLInputElement>(null);

  function buildLeague(tid: number): LeagueStore {
    const seed = Date.now();
    const rng = mulberry32(seed);
    const league = createLeagueState(tid, rng, seed);
    return {
      ...league,
      meta: { ...league.meta, name: CLUBS[tid].name },
    };
  }

  async function handleStart() {
    if (selectedTid === null) return;
    const league = buildLeague(selectedTid);
    if (customize) {
      // Hold the generated league in memory and let the user edit team
      // identities before anything is persisted.
      setPending(league);
      return;
    }
    await setLeague(league);
    navigate("/dashboard");
  }

  async function handleSaveCustomized(teams: EditableTeam[]) {
    if (!pending) return;
    setSaving(true);
    await setLeague(applyTeamIdentities(pending, teams));
    navigate("/dashboard");
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      await importJSON(file);
      e.target.value = "";
      navigate("/dashboard");
    }
  }

  if (pending) {
    return (
      <div className="container py-4" style={{ maxWidth: 700 }}>
        <h2 className="mb-1">Customize Teams</h2>
        <p className="text-muted mb-3">
          Rename any club, change its abbreviation or colors, then start your league.
        </p>
        <TeamIdentityEditor
          initialTeams={pending.teams.map((t) => ({
            tid: t.tid,
            compId: t.compId,
            name: t.name,
            abbrev: t.abbrev,
            colors: [...t.colors] as [string, string],
          }))}
          competitions={pending.competitions}
          userTid={pending.meta.userTid}
          saveLabel="Start League"
          savingLabel="Starting..."
          saving={saving}
          onSave={handleSaveCustomized}
          onCancel={() => setPending(null)}
        />
      </div>
    );
  }

  if (country === null) {
    return (
      <div className="container py-4" style={{ maxWidth: 600 }}>
        <h2 className="mb-3">New League</h2>
        <p className="text-muted">Choose a country to play in.</p>
        <div className="list-group mb-3">
          {COUNTRIES.map((c) => (
            <button
              key={c}
              type="button"
              className="list-group-item list-group-item-action"
              onClick={() => setCountry(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const range = COUNTRY_RANGES.find((r) => r.country === country)!;
  const countryClubs = CLUBS.slice(range.start, range.end).map((club, i) => ({
    club,
    tid: range.start + i,
  }));

  return (
    <div className="container py-4" style={{ maxWidth: 600 }}>
      <h2 className="mb-3">New League</h2>
      <p className="text-muted">
        {customize
          ? `Choose your ${country} club, then customize every club before starting.`
          : `Choose your ${country} club to get started.`}
      </p>

      <div className="list-group mb-3">
        {countryClubs.map(({ club, tid }) => (
          <button
            key={club.abbrev}
            type="button"
            className={`list-group-item list-group-item-action d-flex align-items-center${
              selectedTid === tid ? " active" : ""
            }`}
            onClick={() => setSelectedTid(tid)}
          >
            <span
              className="color-swatch"
              style={{ background: club.colors[0] }}
            />
            <span
              className="color-swatch"
              style={{ background: club.colors[1] }}
            />
            {club.name}
          </button>
        ))}
      </div>

      <div className="d-flex gap-2">
        <button className="btn btn-outline-secondary" onClick={() => { setCountry(null); setSelectedTid(null); }}>
          Back
        </button>
        <button
          className="btn btn-primary"
          disabled={selectedTid === null}
          onClick={handleStart}
        >
          {customize ? "Next: Customize Teams" : "Start League"}
        </button>

        <button className="btn btn-outline-secondary" onClick={handleImportClick}>
          Import League
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="d-none"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
```

Note this passes `competitions={pending.competitions}` and `compId: t.compId` into `TeamIdentityEditor` — those props don't exist yet on that component. That's Task 3; this file will not typecheck until Task 3 lands. That's expected — the two tasks are a matched pair (this task's customize-flow call site, Task 3's component change) and should be committed together or in immediate succession. If you're executing tasks strictly in order, proceed straight to Task 3 before running a typecheck.

- [ ] **Step 7: Commit (paired with Task 3 — see note above)**

Hold this commit until Task 3's component change is also in place; then commit both together (see Task 3 Step 5).

---

### Task 3: `TeamIdentityEditor` — flip between competitions, one shown at a time

**Files:**
- Modify: `src/ui/components/TeamIdentityEditor.tsx`
- Modify: `src/ui/pages/Leagues.tsx` (existing-save Customize Teams entry point)
- Modify: `src/ui/pages/NewLeague.tsx` (new-save customize entry point — already updated in Task 2 to call this with the new props)

**Interfaces:**
- Consumes: nothing new from core — this is a pure presentational change.
- Produces: `TeamIdentityEditor` now requires two new props: `competitions: { id: number; name: string }[]` (for the picker) and each `EditableTeam` now carries `compId: number`. `onSave` still receives the *full* edited team list across every competition, unchanged in shape from before (so `applyTeamIdentities` in `src/core/teams/customize.ts` needs no changes — it already ignores unknown extra fields on each edit object).

- [ ] **Step 1: Update `TeamIdentityEditor.tsx`**

Replace the full contents of `src/ui/components/TeamIdentityEditor.tsx` with:

```tsx
import { useState } from "react";

export interface EditableTeam {
  tid: number;
  compId: number;
  name: string;
  abbrev: string;
  colors: [string, string];
}

interface Props {
  initialTeams: EditableTeam[];
  competitions: { id: number; name: string }[];
  userTid: number;
  saveLabel: string;
  savingLabel: string;
  saving: boolean;
  onSave: (teams: EditableTeam[]) => void;
  onCancel: () => void;
}

/**
 * Editable list of club identities (name/abbrev/colors), shared by the
 * Customize Teams editor on the Leagues page and the customized-league
 * creation flow on the New League page. Edits to every competition are kept
 * in state at once (so switching which one is shown never loses work) —
 * only the currently selected competition's teams are rendered.
 */
export function TeamIdentityEditor({
  initialTeams,
  competitions,
  userTid,
  saveLabel,
  savingLabel,
  saving,
  onSave,
  onCancel,
}: Props) {
  const [teams, setTeams] = useState(initialTeams);
  const userCompId = initialTeams.find((t) => t.tid === userTid)?.compId ?? competitions[0].id;
  const [activeCompId, setActiveCompId] = useState(userCompId);

  function updateTeam(tid: number, patch: Partial<EditableTeam>) {
    setTeams((ts) => ts.map((t) => (t.tid === tid ? { ...t, ...patch } : t)));
  }

  const valid = teams.every((t) => t.name.trim() !== "" && t.abbrev.trim() !== "");
  const visibleTeams = teams.filter((t) => t.compId === activeCompId);

  return (
    <>
      <select
        className="form-select form-select-sm mb-3"
        style={{ width: "auto" }}
        value={activeCompId}
        onChange={(e) => setActiveCompId(Number(e.target.value))}
      >
        {competitions.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <div className="list-group mb-3">
        {visibleTeams.map((t) => (
          <div key={t.tid} className="list-group-item d-flex align-items-center gap-2">
            <input
              type="color"
              className="form-control form-control-color"
              title="Primary color"
              value={t.colors[0]}
              onChange={(e) => updateTeam(t.tid, { colors: [e.target.value, t.colors[1]] })}
            />
            <input
              type="color"
              className="form-control form-control-color"
              title="Secondary color"
              value={t.colors[1]}
              onChange={(e) => updateTeam(t.tid, { colors: [t.colors[0], e.target.value] })}
            />
            <input
              type="text"
              className="form-control"
              value={t.name}
              onChange={(e) => updateTeam(t.tid, { name: e.target.value })}
            />
            <input
              type="text"
              className="form-control text-uppercase"
              style={{ width: 80, flex: "0 0 auto" }}
              maxLength={3}
              value={t.abbrev}
              onChange={(e) => updateTeam(t.tid, { abbrev: e.target.value.toUpperCase() })}
            />
            {t.tid === userTid && (
              <span className="badge bg-primary" style={{ flex: "0 0 auto" }}>
                You
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="d-flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!valid || saving}
          onClick={() => onSave(teams)}
        >
          {saving ? savingLabel : saveLabel}
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Update `Leagues.tsx`'s customize entry point**

In `src/ui/pages/Leagues.tsx`:

Update the `TeamEditor` interface (currently lines 13-18) to add `competitions`:

```typescript
interface TeamEditor {
  lid: number;
  leagueName: string;
  userTid: number;
  teams: EditableTeam[];
  competitions: { id: number; name: string }[];
}
```

Update `handleCustomize` (currently lines 46-60) to populate `compId` on each team and pass `competitions`:

```typescript
  async function handleCustomize(lid: number) {
    const league = await loadLeague(lid);
    if (!league) return;
    setEditor({
      lid,
      leagueName: league.meta.name,
      userTid: league.meta.userTid,
      teams: league.teams.map((t) => ({
        tid: t.tid,
        compId: t.compId,
        name: t.name,
        abbrev: t.abbrev,
        colors: [...t.colors] as [string, string],
      })),
      competitions: league.competitions,
    });
  }
```

Update the `<TeamIdentityEditor>` usage (currently around line 81) to pass the new prop:

```tsx
        <TeamIdentityEditor
          initialTeams={editor.teams}
          competitions={editor.competitions}
          userTid={editor.userTid}
          saveLabel="Save"
          savingLabel="Saving..."
          saving={saving}
          onSave={handleSaveTeams}
          onCancel={() => setEditor(null)}
        />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. This confirms Task 2's `NewLeague.tsx` change (which already passed `compId`/`competitions`, anticipating this task) now matches the component's real prop types.

- [ ] **Step 4: Manual smoke check**

Run: `npm run dev`, navigate to `/leagues` on an existing save, click "Customize Teams", confirm:
- A competition dropdown appears, defaulted to the club's own competition.
- Switching the dropdown shows a different 20-team list.
- Editing a name in one competition, then switching away and back, keeps the edit.
- Saving persists correctly (name shows updated on the Leagues list).

Then go to `/new-league?customize=1`, pick a country and club, confirm the customize step shows a competition dropdown scoped to the 6 world competitions, defaulted to the chosen club's own competition.

- [ ] **Step 5: Commit (this task + Task 2 together, since they're a matched pair)**

```bash
git add src/ui/components/TeamIdentityEditor.tsx src/ui/pages/Leagues.tsx src/ui/pages/NewLeague.tsx src/core/competitions.ts test/core/competitions.test.ts
git commit -m "New League country step; TeamIdentityEditor flips between competitions"
```

---

### Task 4: Standings, Awards, Stat Leaders — generic competition dropdown

**Files:**
- Modify: `src/ui/pages/Standings.tsx`
- Modify: `src/ui/pages/Awards.tsx`
- Modify: `src/ui/pages/Leaders.tsx`

**Interfaces:**
- Consumes: `countriesOf(competitions)` from `src/core/competitions.ts` (already exists) for `<optgroup>` grouping.
- Produces: no new exports — internal component state changes only. Each page's `division: 0 | 1` state becomes a `number` (a real `compId`), defaulting to the user's own competition on first render.

- [ ] **Step 1: Rewrite `Standings.tsx`**

Replace the full contents of `src/ui/pages/Standings.tsx` with:

```tsx
import { useState } from "react";
import { useLeague } from "../context/LeagueContext.js";
import { computeStandings, type StandingsRow } from "../../core/standings.js";
import { computeTeamRating } from "../../core/teams/teamRating.js";
import { countriesOf, tierOf } from "../../core/competitions.js";
import { seasonYear } from "../format.js";

export function Standings() {
  const { league } = useLeague();
  const [season, setSeason] = useState<number | "current">("current");
  const [compIdOverride, setCompIdOverride] = useState<number | null>(null);

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  if (league.played.length === 0 && league.seasonHistory.length === 0) {
    return (
      <div className="container-fluid p-3">
        <h4>Standings</h4>
        <p>No matches played yet.</p>
      </div>
    );
  }

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  const compId = compIdOverride ?? userTeam?.compId ?? league.competitions[0].id;
  const countries = countriesOf(league.competitions);
  const isTier1 = tierOf(league.competitions, compId) === 1;

  const seasonOptions = [...league.seasonHistory.map((h) => h.season)].sort((a, b) => b - a);

  let standings: StandingsRow[];
  let championTid: number;
  if (season === "current") {
    const teamIds = league.teams.filter((t) => t.compId === compId).map((t) => t.tid);
    standings = computeStandings(teamIds, league.played.filter((m) => {
      const home = league.teams.find((t) => t.tid === m.home);
      return home?.compId === compId;
    }));
    // A "champion" only means something once the season has actually been
    // decided by played matches, not an arbitrary tid=0 tie at kickoff.
    championTid = league.played.length > 0 ? (standings[0]?.tid ?? -1) : -1;
  } else {
    const entry = league.seasonHistory.find((h) => h.season === season)!;
    const compTids = new Set(
      Object.entries(entry.compsByTid)
        .filter(([, c]) => c === compId)
        .map(([tid]) => Number(tid)),
    );
    standings = entry.table.filter((row) => compTids.has(row.tid));
    championTid = entry.championTidByCompId[compId] ?? (standings[0]?.tid ?? -1);
  }

  return (
    <div className="container-fluid p-3">
      <h4>Standings</h4>
      <div className="mb-3">
        <select
          className="form-select form-select-sm"
          style={{ width: "auto", display: "inline-block" }}
          value={season}
          onChange={(e) => setSeason(e.target.value === "current" ? "current" : Number(e.target.value))}
        >
          <option value="current">Current Season ({seasonYear(league.season)})</option>
          {seasonOptions.map((s) => (
            <option key={s} value={s}>{seasonYear(s)}</option>
          ))}
        </select>{" "}
        <select
          className="form-select form-select-sm"
          style={{ width: "auto", display: "inline-block" }}
          value={compId}
          onChange={(e) => setCompIdOverride(Number(e.target.value))}
        >
          {countries.map((country) => (
            <optgroup key={country} label={country}>
              {league.competitions.filter((c) => c.country === country).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {standings.length === 0 ? (
        <p>No matches played yet.</p>
      ) : (
        <table className="table table-striped table-sm">
          <thead>
            <tr>
              <th className="text-end">#</th>
              <th>Team</th>
              <th className="text-end">P</th>
              <th className="text-end">W</th>
              <th className="text-end">D</th>
              <th className="text-end">L</th>
              <th className="text-end">GF</th>
              <th className="text-end">GA</th>
              <th className="text-end">GD</th>
              <th className="text-end">Pts</th>
              {season === "current" && <th className="text-end">OVR</th>}
              {season === "current" && <th className="text-end">POT</th>}
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => {
              const team = league.teams.find((t) => t.tid === row.tid);
              const isUser = row.tid === league.meta.userTid;
              const isChampion = row.tid === championTid;
              const rowClass = [isUser && "team-highlight", isChampion && "champion-highlight"]
                .filter(Boolean)
                .join(" ") || undefined;
              const rating =
                season === "current" && team
                  ? computeTeamRating(
                      league.players.filter((p) => team.roster.includes(p.pid)),
                      team.starters,
                    )
                  : null;
              return (
                <tr key={row.tid} className={rowClass}>
                  <td className="text-end">{i + 1}</td>
                  <td>
                    <span className="d-inline-flex align-items-center gap-1">
                      <span
                        className="color-swatch"
                        style={{ backgroundColor: team?.colors[0] }}
                      />
                      {team?.name ?? `Team ${row.tid}`}
                      {isChampion && (
                        <span className="text-muted small"> {isTier1 ? "🏆 (Champion)" : "(1st)"}</span>
                      )}
                    </span>
                  </td>
                  <td className="text-end">{row.played}</td>
                  <td className="text-end">{row.won}</td>
                  <td className="text-end">{row.drawn}</td>
                  <td className="text-end">{row.lost}</td>
                  <td className="text-end">{row.gf}</td>
                  <td className="text-end">{row.ga}</td>
                  <td className="text-end">{row.gd}</td>
                  <td className="text-end">{row.points}</td>
                  {season === "current" && <td className="text-end">{rating?.ovr ?? "-"}</td>}
                  {season === "current" && <td className="text-end">{rating?.pot ?? "-"}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `Awards.tsx`**

In `src/ui/pages/Awards.tsx`, apply the equivalent change: replace the import line and the `division` state, then the two spots that reference it.

Change the import line (currently line 4) to add `countriesOf`:

```typescript
import { countriesOf } from "../../core/competitions.js";
```

Change lines 82-84 from:

```typescript
  const { league } = useLeague();
  const [season, setSeason] = useState<number | null>(null);
  const [division, setDivision] = useState<0 | 1>(0);
```

to:

```typescript
  const { league } = useLeague();
  const [season, setSeason] = useState<number | null>(null);
  const [compIdOverride, setCompIdOverride] = useState<number | null>(null);
```

After the existing `if (league.seasonHistory.length === 0)` early return (so `league` is guaranteed non-null), add before the `seasonOptions` line:

```typescript
  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  const compId = compIdOverride ?? userTeam?.compId ?? league.competitions[0].id;
  const countries = countriesOf(league.competitions);
```

Change `const divisionAwards = entry.awards[division];` to:

```typescript
  const divisionAwards = entry.awards[compId];
```

Replace the division `<select>` block (currently lines 125-133):

```tsx
        <select
          className="form-select form-select-sm"
          style={{ width: "auto", display: "inline-block" }}
          value={compId}
          onChange={(e) => setCompIdOverride(Number(e.target.value))}
        >
          {countries.map((country) => (
            <optgroup key={country} label={country}>
              {league.competitions.filter((c) => c.country === country).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
```

- [ ] **Step 3: Rewrite `Leaders.tsx`**

In `src/ui/pages/Leaders.tsx`:

Add the import:

```typescript
import { countriesOf } from "../../core/competitions.js";
```

Change the `Leaders()` component (currently lines 68-105) to fetch `league` itself and default the competition, then pass `compId: number` down instead of `division: 0 | 1`:

```typescript
export function Leaders() {
  const { league } = useLeague();
  const [tab, setTab] = useState<LeadersTab>("players");
  const [compIdOverride, setCompIdOverride] = useState<number | null>(null);

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
  const compId = compIdOverride ?? userTeam?.compId ?? league.competitions[0].id;
  const countries = countriesOf(league.competitions);

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
          value={compId}
          onChange={(e) => setCompIdOverride(Number(e.target.value))}
        >
          {countries.map((country) => (
            <optgroup key={country} label={country}>
              {league.competitions.filter((c) => c.country === country).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {tab === "players" ? <PlayerLeaders compId={compId} /> : <TeamLeaders compId={compId} />}
    </div>
  );
}
```

Change `PlayerLeaders`'s signature and every use of `division` inside it (currently `function PlayerLeaders({ division }: { division: 0 | 1 })`, line 107, and the `team.compId !== division` check at line 138):

```typescript
function PlayerLeaders({ compId }: { compId: number }) {
```

```typescript
  for (const team of league.teams) {
    if (team.compId !== compId) continue;
```

Change `TeamLeaders`'s signature and body the same way (currently `function TeamLeaders({ division }: { division: 0 | 1 })`, line 314, and the two `t.compId === division` / `s.tid` filters at lines 329 and 333):

```typescript
function TeamLeaders({ compId }: { compId: number }) {
```

```typescript
  const teamIds = league.teams.filter((t) => t.compId === compId).map((t) => t.tid);
  const teamStats: TeamSeasonStats[] = season === "current"
    ? computeTeamSeasonStats(teamIds, league.played)
    : (league.seasonHistory.find((h) => h.season === season)?.teamStats ?? [])
        .filter((s) => league.seasonHistory.find((h) => h.season === season)?.compsByTid[s.tid] === compId);
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`, on a world save (create one via the new country step from Task 2), visit `/standings`, `/awards`, `/leaders`:
- Each page's competition dropdown is grouped into England/Spain/Italy `<optgroup>`s.
- Each defaults to the user's own competition on first load.
- Switching competitions shows that competition's own table/awards/leaders, not stale data from the default.
- Standings' champion trophy only shows for a tier-1 (Division 1) competition; a Division 2 competition's leader shows "(1st)" as before.

- [ ] **Step 6: Commit**

```bash
git add src/ui/pages/Standings.tsx src/ui/pages/Awards.tsx src/ui/pages/Leaders.tsx
git commit -m "Standings/Awards/Stat Leaders: generic competition dropdown grouped by country"
```

---

### Task 5: Power Rankings and Player Profile — competition name/badge fixes

**Files:**
- Modify: `src/ui/pages/PowerRankings.tsx`
- Modify: `src/ui/pages/PlayerProfile.tsx`

**Interfaces:**
- Consumes: `competitionOf`, `tierOf` from `src/core/competitions.ts` (already exist).
- Produces: no new exports.

- [ ] **Step 1: Fix the Power Rankings division badge**

In `src/ui/pages/PowerRankings.tsx`, add the import:

```typescript
import { competitionOf, tierOf } from "../../core/competitions.js";
```

Replace the badge `<td>` (currently lines 85-95):

```tsx
                  <td className="text-end">
                    {(() => {
                      const comp = competitionOf(league.competitions, team.compId);
                      const tier = tierOf(league.competitions, team.compId);
                      return (
                        <span
                          className={
                            "division-badge " +
                            (tier === 1 ? "division-badge--d1" : "division-badge--d2")
                          }
                          title={comp.name}
                        >
                          {comp.country.slice(0, 3).toUpperCase()} D{tier} #{divisionRanks.get(team.tid)}
                        </span>
                      );
                    })()}
                  </td>
```

Update the page's intro copy (currently line 51) from "across both divisions" / "its division" to generic wording:

```tsx
      <p className="text-muted small mb-3">
        Teams ranked by squad OVR (Starting XI + bench, depth-weighted) across every competition in
        the world. Click a team to see its roster.
      </p>
```

- [ ] **Step 2: Fix the Player Profile division label**

In `src/ui/pages/PlayerProfile.tsx`, add the import:

```typescript
import { competitionOf } from "../../core/competitions.js";
```

Replace line 117:

```tsx
            {teamName(team.tid)} <small className="text-muted">({competitionOf(league.competitions, team.compId).name})</small>
```

(`league` is already in scope at that point in the component — this is a like-for-like swap, no new hooks or guards needed.)

Update the stale comment on line 80 ("scan every completed season's Division 1/2 award entries") to:

```typescript
  // Career awards: scan every completed season's per-competition award entries.
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke check**

Run: `npm run dev`, visit `/power-rankings` on a world save — confirm badges read like "ESP D1 #3" / "ITA D2 #14" rather than "D1"/"D2". Click through to a Spanish or Italian player's Player Profile — confirm the club line shows the real competition name (e.g. "Spanish Division 1"), not "Division 2" mislabeled.

- [ ] **Step 5: Commit**

```bash
git add src/ui/pages/PowerRankings.tsx src/ui/pages/PlayerProfile.tsx
git commit -m "Power Rankings and Player Profile: real competition names instead of hardcoded Division 1/2"
```

---

### Task 6: Finance — competition filter on the league-wide table

**Files:**
- Modify: `src/ui/pages/Finance.tsx`

**Interfaces:**
- Consumes: `countriesOf` from `src/core/competitions.ts`.
- Produces: no new exports.

- [ ] **Step 1: Add the filter state and dropdown**

In `src/ui/pages/Finance.tsx`, add the import:

```typescript
import { countriesOf } from "../../core/competitions.js";
```

After the existing `const [scoutingDraft, setScoutingDraft] = useState<number | null>(null);` line, add:

```typescript
  const [compFilterOverride, setCompFilterOverride] = useState<number | "all" | null>(null);
```

After the `if (!userTeam) { ... }` guard (so `league`/`userTeam` are both guaranteed), add:

```typescript
  const compFilter = compFilterOverride ?? userTeam.compId;
  const countries = countriesOf(league.competitions);
```

Change the `clubRows` computation (currently `const clubRows = league.teams.map(...)`) to filter first:

```typescript
  const clubRows = league.teams
    .filter((t) => compFilter === "all" || t.compId === compFilter)
    .map((t) => ({ team: t, wages: wageBill([...t.roster, ...t.academyRoster], salaryMap) }))
    .sort((a, b) => b.team.budget - a.team.budget);
```

- [ ] **Step 2: Add the dropdown to the League Finances card**

In the "League Finances" card (currently starting `{/* League finances */}`), add a dropdown next to the `<h5>`:

```tsx
      <div className="card mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="card-title mb-0">League Finances</h5>
            <select
              className="form-select form-select-sm"
              style={{ width: "auto" }}
              value={compFilter}
              onChange={(e) => setCompFilterOverride(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              <option value="all">All Competitions</option>
              {countries.map((country) => (
                <optgroup key={country} label={country}>
                  {league.competitions.filter((c) => c.country === country).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <table className="table table-striped table-sm align-middle mb-0">
```

(This replaces the existing `<h5 className="card-title">League Finances</h5>` line — the rest of the card's `<table>...</table>` markup is unchanged, just now reading from the filtered `clubRows`.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke check**

Run: `npm run dev`, visit `/finance` on a world save — confirm the League Finances table defaults to just the user's own 20-club competition (not all 120 rows), and that switching the dropdown (including "All Competitions") changes the table correctly.

- [ ] **Step 5: Commit**

```bash
git add src/ui/pages/Finance.tsx
git commit -m "Finance: competition filter on the league-wide table"
```

---

### Task 7: Manual — "The World" section

**Files:**
- Modify: `src/ui/pages/Manual.tsx`

**Interfaces:** None — content-only change.

- [ ] **Step 1: Add the section to the table of contents**

In the `SECTIONS` array (currently lines 14-29), add a new entry right after `["season", ...]`:

```typescript
const SECTIONS: [id: string, title: string][] = [
  ["overview", "Overview"],
  ["pages", "The Pages"],
  ["season", "The Season & Simming"],
  ["world", "The World"],
  ["players", "Players: Ratings, OVR & Potential"],
  ["development", "Player Development & Aging"],
  ["matches", "The Match Engine"],
  ["squad", "Your Squad: Lineups, Depth & the Roster Cap"],
  ["transfers", "Transfers & Negotiation"],
  ["contracts", "Contracts, Wages & Free Agents"],
  ["finance", "Finance"],
  ["youth", "The Youth Academy"],
  ["ai", "How AI Clubs Think"],
  ["strategy", "Strategy"],
  ["faq", "FAQ & Known Quirks"],
];
```

- [ ] **Step 2: Add the section body**

Immediately after the closing `</Section>` of the `"season"` section (currently ending at line 138), insert:

```tsx
        <Section id="world" title="The World">
          <p>
            A new save is set in one shared world: three countries — <strong>England</strong>,{" "}
            <strong>Spain</strong>, and <strong>Italy</strong> — each with its own two-division
            pyramid (Division 1 and Division 2, 20 clubs apiece), for 6 leagues and 120 clubs total.
            You pick any club in any country and division when you start a new save.
          </p>
          <p>
            Every country is generated to the same strength and budget bands — there's no
            "flagship league" richer or stronger than the others. Division 2 in any country
            generates weaker than its own Division 1, exactly like the domestic second division
            always has; a real, structural gap is deliberately maintained across a whole dynasty
            (see the ceiling mechanism below), not just at creation.
          </p>
          <p>
            <strong>One global transfer market.</strong> The AI transfer market, free agency,
            recommended transfers, and inbound offers for your own players all operate across every
            country with no home-country bias — an Italian club can and will buy a Spanish player,
            sign an English free agent, or bid on one of yours, exactly as if they shared a single
            league. A strong Division 2 player anywhere in the world can also be pulled up to a
            Division 1 club by the same mechanism that already applies domestically (see the
            "Wants a move to Division 1" note in <a href="#ai">How AI Clubs Think</a>) — it isn't
            limited to his own country.
          </p>
          <p>
            Promotion and relegation (3 up, 3 down) runs independently within each country at the
            end of every season — a poor season in Spain's top flight has no effect on England's or
            Italy's tables. Standings, Awards, and Stat Leaders each have a competition dropdown,
            grouped by country, to browse any of the 6 leagues; it defaults to whichever one your
            own club currently plays in.
          </p>
          <p className="text-muted small">
            Existing saves created before this feature shipped stay England-only forever — there's
            no mid-save world expansion.
          </p>
        </Section>

```

- [ ] **Step 3: Fix the Power Rankings description in "The Pages"**

Replace the Power Rankings bullet (currently line 91):

```tsx
            <li><strong>Power Rankings</strong> — every club in the world ranked by squad OVR (Starting XI plus bench, depth-weighted, same formula as Standings' OVR column), with a badge showing each club's competition and its rank within it. Click a team to expand its full roster in place.</li>
```

- [ ] **Step 4: Manual review**

Run: `npm run dev`, visit `/manual`, confirm "The World" appears in the table of contents between "The Season & Simming" and "Players", and that its content renders correctly (including the two internal links to `#ai`).

- [ ] **Step 5: Commit**

```bash
git add src/ui/pages/Manual.tsx
git commit -m "Manual: add The World section, fix Power Rankings description"
```

---

### Task 8: Full suite gate + end-to-end browser smoke test

**Files:** None (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass. Note the suite will run noticeably slower than before this PR (Task 1 tripled `createLeagueState`'s scale, and every test file that builds a league via `createLeagueState` inherits that) — that's an accepted, known cost of the switch, not a regression to chase down.

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Full end-to-end browser smoke test**

Run: `npm run dev`. Walk through, in order:

1. `/leagues` → "Start New League" → pick "Spain" → pick a Division 2 club → confirm it lands on `/dashboard` with that club's name/colors.
2. Sim a few matchdays from the Dashboard.
3. `/standings` — confirm it defaults to Spanish Division 2, and that switching to English Division 1 (via the grouped dropdown) shows a different, populated table.
4. `/leaders` and `/awards` — same dropdown check (awards will be empty until a season completes; that's expected, not a bug).
5. `/finance` — League Finances defaults to Spanish Division 2 only; switch to "All Competitions" and confirm all 120 rows appear.
6. `/power-rankings` — confirm badges show country-aware labels (e.g. "ESP D2 #7").
7. `/leagues` → "Customize Teams" on the new save → confirm the competition dropdown lets you flip through all 6 leagues, with edits preserved across switches.
8. `/manual` → confirm "The World" section reads correctly.

Report any visual bugs found and fix them before considering this task done; this step has no automated pass/fail, only your own judgment against the checklist above.

- [ ] **Step 4: Update CLAUDE.md**

Per this repo's own convention (documented in its "In-game Manual" and general instructions), add a short paragraph to CLAUDE.md's "More leagues around the world" section documenting that PR 3 landed: `createLeagueState` now generates the full world for new saves, the country step exists on New League, and the UI (Standings/Awards/Stat Leaders/Finance/Power Rankings/Player Profile) is fully competition-generic. Mention the one deferred follow-up: the dynasty-scale audit the original design spec called for is still outstanding, now unblocked since the world is live.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "Document more-leagues PR 3 completion in CLAUDE.md"
```

---

## Self-Review Notes (from the plan author, not a task to execute)

- **Spec coverage:** every item in the design spec's "UI" section (creation flow country step, Standings/Awards/Stat Leaders dropdowns, Finance filter, Manual) has a task. Two items not named in the original spec but found during file exploration — Power Rankings' hardcoded division badge and PlayerProfile's hardcoded division label — got their own task (5) since they're real hardcoded-`0|1` sites the spec's author couldn't have known about (Power Rankings and the customize-flow's `TeamIdentityEditor` both postdate the spec).
- **The one open product question** (how Customize Teams should scope when there are 120 clubs) was resolved with the user before writing this plan: flip between competitions one at a time, edits preserved across switches (Task 3).
- **Type consistency check:** `EditableTeam.compId`, `TeamIdentityEditor`'s `competitions` prop shape (`{id, name}[]`), and `countryClubRanges`'s return shape (`{country, start, end}[]`) are each defined once (Tasks 2/3) and used identically at every call site in later tasks.
