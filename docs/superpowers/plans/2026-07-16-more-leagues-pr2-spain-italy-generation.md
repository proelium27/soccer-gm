# More Leagues PR 2: Spain/Italy Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real, fully-testable 3-country (England/Spain/Italy) world — generation, club identities, nationality flavor — as new, additive code, without changing what a new save looks like today.

**Architecture:** A new `worldCompetitions()` in `src/core/competitions.ts` (6 entries: 3 countries × 2 tiers) and a new `generateWorld()` in `src/core/league/generate.ts` that calls the existing `generateDivisionTeams` once per tier per country, sharing one rng stream (England first, so its block stays byte-identical to today's `generateTwoDivisionLeague`). `CLUBS` grows from 40 to 120 fictional identities. Player nationality generation becomes country-aware via a new optional parameter — safe to add because nationality/name generation already runs on an isolated per-player rng sub-stream, never the shared one. Everything from PR 1 (offseason loop, promotion/relegation, AI evaluation, the Division-2 ceiling sweep, finance) already loops over `league.competitions` generically, so none of it needs to change to support 6 competitions instead of 2 — this PR only needs to prove that empirically with one integration test.

**Tech Stack:** TypeScript, Vitest (`npm test`), no new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-16-more-leagues-design.md`. This is PR 2 of that spec's 3-PR rollout (PR 1 merged as `3afad87`).

## Global Constraints

- **Additive only — do not wire `createLeagueState` to the new world generator.** New saves must keep generating the England-only 40-team league exactly as today; PR 3 does the switch-over alongside the country-picker UI (explicit user decision, made mid-session — not in the original spec text, which had assumed PR 2 would wire this live).
- **Equal siblings**: Spain and Italy generate at the identical strength/budget bands as England (no new tuning constants) — this already falls out of PR 1's tier-based finance and the existing `DIVISION_2_OFFSET` formula; do not introduce country-specific scaling.
- **RNG-stream safety**: nationality/name generation must stay on the isolated `identityRng` sub-stream (seeded from `genSeed`+`pid`, never from the shared `rng`). Never let a per-country nationality change alter the shared `rng` sequence — that would shift every downstream roll (ratings, potential, positions) for every player generated after it, the exact bug class this codebase's CLAUDE.md repeatedly warns about.
- **Trademark caution**: club identities are fully invented (no real club names, no real small-town lookups) — same rule PR 1 and the original English `CLUBS` list already follow.
- **Testing is deliberately lean (user's explicit instruction, carried over from PR 1)**: one new test file per new module, scoped runs while building, full suite once at the end. No dynasty-audit script for this PR — that's deferred to after PR 3, once the world is actually live.
- Run all commands from the worktree root. Commit after every task.

## Reference: current shape (after PR 1, before this PR)

- `src/core/competitions.ts`: `Competition { id, country, tier, name }`, `englandCompetitions()` (2 entries), `competitionOf`/`tierOf`/`partnerOf`/`countriesOf`.
- `src/core/league/generate.ts`: `generateDivisionTeams(rng, tidStart, count, strengthOffset, compId, genSeed, pidStart)` (private), `generateLeague(rng, seed)` (single division, England D1 only), `generateTwoDivisionLeague(rng, seed)` (England D1+D2, tids 0-39, calls `generateDivisionTeams` twice sharing one rng stream — this is the function whose England-block output must stay byte-identical).
- `src/core/players/generate.ts`: `generatePlayer(rng, pos, base, pid, age, season, genSeed = 0)` — nationality drawn via `const identityRng = mulberry32(hashInts(genSeed, pid)); const nationality = pickNationality(identityRng);` (isolated sub-stream, confirmed by reading the function body).
- `src/core/players/nationalities.ts`: `NATIONALITIES: Record<string, NationalityDef>` (England weight 390 of a ~888 total incl. `OTHER_BUCKET_WEIGHT` 8; Spain already present at weight 33; Italy absent), `pickNationality(rng: () => number): string` (flat weighted draw), `namePoolFor(nationality)`.
- `src/core/players/flags.ts`: `FLAGS: Record<string, string>` emoji lookup, `flagFor(nationality)` (safe fallback `"🏳️"` for unknown nationalities — Italy's absence didn't crash anything, just showed the placeholder).
- `src/core/teams/clubs.ts`: `CLUBS: ClubIdentity[]` (40 entries, indices 0-39, England-flavored), `assignIdentities(league, competitions)` (already generic — zips `CLUBS[t.tid]` onto every team regardless of competition/country, needs no change).
- `src/core/leagueState.ts`: `createLeagueState(userTid, rng, seed)` calls `generateTwoDivisionLeague` + `englandCompetitions()` — **not touched by this plan**.
- `src/ui/pages/NewLeague.tsx`: renders `CLUBS.map(...)` as a flat, unfiltered list-group of every club in `CLUBS` — **this means growing `CLUBS` to 120 without any other change would let a user select a Spanish/Italian club tid that `createLeagueState` (still England-only) never actually generates, crashing the app on load.** Task 5 below adds a one-line safety clamp.

---

### Task 1: Italy nationality pool + flag

**Files:**
- Modify: `src/core/players/nationalities.ts`
- Modify: `src/core/players/flags.ts`
- Test: `test/core/nationalities.test.ts` (new file)

**Interfaces:**
- Produces: `NATIONALITIES.Italy: NationalityDef` (weight 30, 30 first names, 30 last names), `FLAGS.Italy: "🇮🇹"`.

**Note for the implementer: this task's code changes were already made and verified during planning research (RNG-isolation and flag-fallback behavior were confirmed by reading the source first) — apply them exactly as shown, they are not hypothetical.**

- [ ] **Step 1: Write the failing test**

```typescript
// test/core/nationalities.test.ts
import { describe, it, expect } from "vitest";
import { NATIONALITIES, namePoolFor } from "../../src/core/players/nationalities.js";
import { flagFor } from "../../src/core/players/flags.js";

describe("Italy nationality pool", () => {
  it("has a name pool with at least 20 first and 20 last names", () => {
    const pool = namePoolFor("Italy");
    expect(pool).toBeDefined();
    expect(pool!.first.length).toBeGreaterThanOrEqual(20);
    expect(pool!.last.length).toBeGreaterThanOrEqual(20);
  });

  it("has a positive weight comparable to Spain's", () => {
    expect(NATIONALITIES.Italy.weight).toBeGreaterThan(0);
    expect(NATIONALITIES.Italy.weight).toBeCloseTo(NATIONALITIES.Spain.weight, -1);
  });

  it("has a flag emoji, not the unknown-nationality placeholder", () => {
    expect(flagFor("Italy")).toBe("🇮🇹");
    expect(flagFor("Italy")).not.toBe("🏳️");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/nationalities.test.ts`
Expected: FAIL — `NATIONALITIES.Italy` is undefined (or the file doesn't exist yet if Step 1's edits aren't applied).

- [ ] **Step 3: Add the Italy entry to `nationalities.ts`**

Insert immediately before the existing `Portugal:` entry (after `Spain:`), matching the file's existing style exactly:

```typescript
  Italy: {
    weight: 30,
    first: [
      "Marco", "Luca", "Matteo", "Alessandro", "Davide", "Simone", "Andrea", "Francesco",
      "Lorenzo", "Riccardo", "Federico", "Gianluca", "Stefano", "Fabio", "Roberto", "Paolo",
      "Giovanni", "Antonio", "Nicola", "Emanuele", "Daniele", "Cristian", "Filippo", "Enrico",
      "Salvatore", "Massimo", "Vincenzo", "Domenico", "Pietro", "Angelo",
    ],
    last: [
      "Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci",
      "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Costa", "Giordano",
      "Mancini", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana", "Santoro", "Mariani",
      "Rinaldi", "Caruso", "Ferrara", "Galli", "Martini", "Leone",
    ],
  },
```

- [ ] **Step 4: Add the Italy flag to `flags.ts`**

Insert immediately after the existing `Spain: "🇪🇸",` line:

```typescript
  Italy: "🇮🇹",
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/core/nationalities.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/core/players/nationalities.ts src/core/players/flags.ts test/core/nationalities.test.ts
git commit -m "Add Italy nationality pool and flag"
```

---

### Task 2: Country-aware nationality weighting

**Files:**
- Modify: `src/core/players/nationalities.ts`
- Modify: `src/core/players/generate.ts`
- Test: `test/core/nationalities.test.ts` (extend)

**Interfaces:**
- Consumes: `NATIONALITIES`, `OTHER_NATIONS` (already private to `nationalities.ts`).
- Produces:
  - `pickNationality(rng: () => number, homeCountry?: string): string` — signature change, `homeCountry` optional and defaults to today's exact unparameterized behavior.
  - `generatePlayer(rng, pos, base, pid, age, season, genSeed = 0, homeCountry?: string): Player` — new optional trailing parameter; every existing call site (youth intake, free agency, etc.) is unaffected since it stays undefined there.

- [ ] **Step 1: Write the failing test**

```typescript
// append to test/core/nationalities.test.ts
import { pickNationality } from "../../src/core/players/nationalities.js";
import { mulberry32 } from "../../src/engine/rng.js";

describe("pickNationality home-country weighting", () => {
  it("with no home country, matches today's flat distribution (England is the plurality)", () => {
    const rng = mulberry32(1);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      const n = pickNationality(rng);
      counts[n] = (counts[n] ?? 0) + 1;
    }
    const england = counts.England ?? 0;
    for (const [country, count] of Object.entries(counts)) {
      if (country !== "England") expect(england).toBeGreaterThan(count);
    }
  });

  it("with homeCountry 'Spain', Spain becomes the plurality instead of England", () => {
    const rng = mulberry32(2);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      const n = pickNationality(rng, "Spain");
      counts[n] = (counts[n] ?? 0) + 1;
    }
    const spain = counts.Spain ?? 0;
    for (const [country, count] of Object.entries(counts)) {
      if (country !== "Spain") expect(spain).toBeGreaterThan(count);
    }
  });

  it("homeCountry 'England' behaves identically to no homeCountry", () => {
    const rngA = mulberry32(3);
    const rngB = mulberry32(3);
    const seqA = Array.from({ length: 50 }, () => pickNationality(rngA));
    const seqB = Array.from({ length: 50 }, () => pickNationality(rngB, "England"));
    expect(seqA).toEqual(seqB);
  });

  it("an unrecognized homeCountry falls back to the flat distribution instead of throwing", () => {
    const rng = mulberry32(4);
    expect(() => pickNationality(rng, "Atlantis")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/nationalities.test.ts`
Expected: FAIL — `pickNationality(rng, "Spain")` still ignores the second argument, so Spain isn't the plurality.

- [ ] **Step 3: Rewrite `pickNationality` in `nationalities.ts`**

Replace the existing `totalWeight`/`pickNationality` pair with:

```typescript
const OTHER_BUCKET_WEIGHT = 8;

/**
 * The weight a home country's own nationality gets in its own leagues,
 * matching England's existing dominant share in the original flat
 * distribution (so "Spanish leagues draw mostly Spanish names" has the same
 * intensity "English leagues draw mostly English names" always has).
 */
const HOME_NATION_WEIGHT = 390;

function totalWeight(table: Record<string, NationalityDef>): number {
  let sum = OTHER_BUCKET_WEIGHT;
  for (const def of Object.values(table)) sum += def.weight;
  return sum;
}

function pickFromTable(rng: () => number, table: Record<string, NationalityDef>): string {
  let roll = rng() * totalWeight(table);
  for (const [country, def] of Object.entries(table)) {
    if (roll < def.weight) return country;
    roll -= def.weight;
  }
  const others = Object.keys(OTHER_NATIONS);
  return others[Math.floor(rng() * others.length)];
}

/**
 * Weighted-random nationality draw. With no homeCountry (or "England"),
 * matches the original flat Premier-League-flavored distribution exactly.
 * With a homeCountry that has its own NATIONALITIES entry, that country's
 * weight is boosted to HOME_NATION_WEIGHT (England's weight drops to what
 * the home country's own weight normally is — a straight swap, so the total
 * weight pool is unchanged) — every other country's weight is untouched,
 * so the "realistic foreign mix" flavor carries over unmodified.
 */
export function pickNationality(rng: () => number, homeCountry?: string): string {
  if (!homeCountry || homeCountry === "England" || !(homeCountry in NATIONALITIES)) {
    return pickFromTable(rng, NATIONALITIES);
  }
  const homeDef = NATIONALITIES[homeCountry];
  const table: Record<string, NationalityDef> = {
    ...NATIONALITIES,
    [homeCountry]: { ...homeDef, weight: HOME_NATION_WEIGHT },
    England: { ...NATIONALITIES.England, weight: homeDef.weight },
  };
  return pickFromTable(rng, table);
}
```

- [ ] **Step 4: Thread `homeCountry` through `generatePlayer` in `src/core/players/generate.ts`**

Change the signature and the nationality draw (the two-line diff below is the entire change — everything else in the function is untouched):

```typescript
export function generatePlayer(
  rng: () => number,
  pos: Position,
  base: number,
  pid: number,
  age: number,
  season: number,
  genSeed = 0,
  homeCountry?: string,
): Player {
```

```typescript
  const identityRng = mulberry32(hashInts(genSeed, pid));
  const nationality = pickNationality(identityRng, homeCountry);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/core/nationalities.test.ts`
Expected: PASS (7 tests total).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (the new `homeCountry` parameter is optional, so no existing call site breaks).

- [ ] **Step 7: Commit**

```bash
git add src/core/players/nationalities.ts src/core/players/generate.ts test/core/nationalities.test.ts
git commit -m "Make nationality generation country-aware, isolated to the identity rng sub-stream"
```

---

### Task 3: `worldCompetitions()` — the 6-entry competitions table

**Files:**
- Modify: `src/core/competitions.ts`
- Test: `test/core/competitions.test.ts` (extend)

**Interfaces:**
- Consumes: `Competition` interface (unchanged).
- Produces: `worldCompetitions(): Competition[]` (6 entries, ids 0-5, matching the tid-block layout Task 4 relies on: England D1=0/D2=1, Spain D1=2/D2=3, Italy D1=4/D2=5).

- [ ] **Step 1: Write the failing test**

```typescript
// append to test/core/competitions.test.ts
import { worldCompetitions } from "../../src/core/competitions.js";

describe("worldCompetitions", () => {
  const comps = worldCompetitions();

  it("has 6 entries: 3 countries x 2 tiers", () => {
    expect(comps).toHaveLength(6);
  });

  it("starts with England, matching englandCompetitions() exactly", () => {
    expect(comps.slice(0, 2)).toEqual(englandCompetitions());
  });

  it("has Spain and Italy each with one tier-1 and one tier-2 competition", () => {
    for (const country of ["Spain", "Italy"]) {
      const group = comps.filter((c) => c.country === country);
      expect(group).toHaveLength(2);
      expect(group.map((c) => c.tier).sort()).toEqual([1, 2]);
    }
  });

  it("every id is unique", () => {
    const ids = comps.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("partnerOf works across all 3 countries", () => {
    for (const comp of comps) {
      const partner = partnerOf(comps, comp.id);
      expect(partner.country).toBe(comp.country);
      expect(partner.tier).not.toBe(comp.tier);
    }
  });
});
```

Add `englandCompetitions` and `partnerOf` to the existing test file's import line (they're already exported; only the import statement needs the two extra names).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/competitions.test.ts`
Expected: FAIL — `worldCompetitions` is not exported.

- [ ] **Step 3: Add `worldCompetitions()` to `competitions.ts`**

Insert immediately after `englandCompetitions`:

```typescript
export function worldCompetitions(): Competition[] {
  return [
    ...englandCompetitions(),
    { id: 2, country: "Spain", tier: 1, name: "Spanish Division 1" },
    { id: 3, country: "Spain", tier: 2, name: "Spanish Division 2" },
    { id: 4, country: "Italy", tier: 1, name: "Italian Division 1" },
    { id: 5, country: "Italy", tier: 2, name: "Italian Division 2" },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/competitions.test.ts`
Expected: PASS (all tests, old and new).

- [ ] **Step 5: Commit**

```bash
git add src/core/competitions.ts test/core/competitions.test.ts
git commit -m "Add worldCompetitions(): the 6-competition England/Spain/Italy table"
```

---

### Task 4: `generateWorld()` — generate all 120 clubs in one rng pass

**Files:**
- Modify: `src/core/league/generate.ts`
- Test: `test/core/generate.test.ts` (extend)

**Interfaces:**
- Consumes: `worldCompetitions`, `partnerOf` from `../competitions.js`; `NUM_TEAMS`, `NUM_TEAMS_D2`, `DIVISION_2_OFFSET` (already imported in this file).
- Produces: `generateWorld(rng: () => number, seed?: number): League` (same `League` shape as `generateLeague`/`generateTwoDivisionLeague`: `{ teams: LeagueTeam[]; players: Player[] }`). Tid layout: England 0-39 (tier-1 0-19, tier-2 20-39), Spain 40-79 (tier-1 40-59, tier-2 60-79), Italy 80-119 (tier-1 80-99, tier-2 100-119) — this exact layout is what Task 5's `CLUBS` array indices must match.

- [ ] **Step 1: Write the failing test**

```typescript
// append to test/core/generate.test.ts
import { generateWorld } from "../../src/core/league/generate.js";
import { worldCompetitions } from "../../src/core/competitions.js";

describe("generateWorld", () => {
  it("produces 120 teams across 6 competitions, 20 per competition", () => {
    const world = generateWorld(mulberry32(42));
    expect(world.teams).toHaveLength(120);
    for (const comp of worldCompetitions()) {
      expect(world.teams.filter((t) => t.compId === comp.id)).toHaveLength(20);
    }
  });

  it("assigns tid blocks in country order: England 0-39, Spain 40-79, Italy 80-119", () => {
    const world = generateWorld(mulberry32(42));
    const tidsFor = (compId: number) => world.teams.filter((t) => t.compId === compId).map((t) => t.tid);
    expect(Math.min(...tidsFor(0), ...tidsFor(1))).toBe(0);
    expect(Math.max(...tidsFor(0), ...tidsFor(1))).toBe(39);
    expect(Math.min(...tidsFor(2), ...tidsFor(3))).toBe(40);
    expect(Math.max(...tidsFor(2), ...tidsFor(3))).toBe(79);
    expect(Math.min(...tidsFor(4), ...tidsFor(5))).toBe(80);
    expect(Math.max(...tidsFor(4), ...tidsFor(5))).toBe(119);
  });

  it("has ~3000 players (120 teams x 25)", () => {
    const world = generateWorld(mulberry32(42));
    expect(world.players).toHaveLength(3000);
  });

  it("has unique pids across the whole world", () => {
    const world = generateWorld(mulberry32(42));
    const pids = world.players.map((p) => p.pid);
    expect(new Set(pids).size).toBe(pids.length);
  });

  it("England's block is byte-identical to generateTwoDivisionLeague for the same seed", () => {
    const world = generateWorld(mulberry32(9));
    const plain = generateTwoDivisionLeague(mulberry32(9));
    const englandFromWorld = world.teams.filter((t) => t.tid < 40);
    expect(englandFromWorld.map((t) => t.roster)).toEqual(plain.teams.map((t) => t.roster));
  });

  it("each country's tier-2 strongest team is no stronger than its own tier-1 average (equal-sibling generation)", () => {
    const world = generateWorld(mulberry32(42));
    for (const country of ["England", "Spain", "Italy"]) {
      const comps = worldCompetitions().filter((c) => c.country === country);
      const d1 = world.teams.filter((t) => t.compId === comps.find((c) => c.tier === 1)!.id);
      const d2 = world.teams.filter((t) => t.compId === comps.find((c) => c.tier === 2)!.id);
      const d1Avg = d1.reduce((s, t) => s + t.avgOvr, 0) / d1.length;
      const d2Best = Math.max(...d2.map((t) => t.avgOvr));
      expect(d2Best).toBeLessThanOrEqual(d1Avg + 0.5);
    }
  });

  it("majority nationality among Spain's players is Spain more often than among England's players", () => {
    const world = generateWorld(mulberry32(42));
    const spainComp = worldCompetitions().find((c) => c.country === "Spain" && c.tier === 1)!;
    const englandComp = worldCompetitions().find((c) => c.country === "England" && c.tier === 1)!;
    const spainTids = new Set(world.teams.filter((t) => t.compId === spainComp.id).map((t) => t.tid));
    const englandTids = new Set(world.teams.filter((t) => t.compId === englandComp.id).map((t) => t.tid));
    const nationalityShare = (tids: Set<number>, nationality: string) => {
      const rosterPids = new Set(world.teams.filter((t) => tids.has(t.tid)).flatMap((t) => t.roster));
      const players = world.players.filter((p) => rosterPids.has(p.pid));
      return players.filter((p) => p.nationality === nationality).length / players.length;
    };
    expect(nationalityShare(spainTids, "Spain")).toBeGreaterThan(nationalityShare(englandTids, "Spain"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/generate.test.ts`
Expected: FAIL — `generateWorld` is not exported.

- [ ] **Step 3: Thread `country` through `generateDivisionTeams` and add `generateWorld`**

In `src/core/league/generate.ts`, add the country parameter to the private helper and its one internal `generatePlayer` call:

```typescript
function generateDivisionTeams(
  rng: () => number,
  tidStart: number,
  count: number,
  strengthOffset: number,
  compId: number,
  genSeed: number,
  pidStart: number,
  country: string,
): { teams: LeagueTeam[]; players: Player[]; nextPid: number } {
```

```typescript
        const p = generatePlayer(rng, pos, base, pid++, age, STARTING_SEASON, genSeed, country);
```

Update the two existing callers to pass `"England"` explicitly (behavior-identical — `pickNationality`'s "England" branch is a no-op per Task 2):

```typescript
export function generateLeague(rng: () => number, seed = 0): League {
  const genSeed = hashInts(seed, 1);
  const { teams, players } = generateDivisionTeams(rng, 0, NUM_TEAMS, 0, 0, genSeed, 0, "England");
  return { teams, players };
}
```

```typescript
export function generateTwoDivisionLeague(rng: () => number, seed = 0): League {
  const genSeed = hashInts(seed, 1);
  const d1 = generateDivisionTeams(rng, 0, NUM_TEAMS, 0, 0, genSeed, 0, "England");
  const d2 = generateDivisionTeams(rng, NUM_TEAMS, NUM_TEAMS_D2, DIVISION_2_OFFSET, 1, genSeed, d1.nextPid, "England");
  return {
    teams: [...d1.teams, ...d2.teams],
    players: [...d1.players, ...d2.players],
  };
}
```

Add the new import and `generateWorld` function at the end of the file:

```typescript
import { worldCompetitions, partnerOf } from "../competitions.js";
```

```typescript
/**
 * Generate all 3 countries' worth of teams/players in one rng pass, sharing
 * one shared stream — countries process in worldCompetitions() order
 * (England, Spain, Italy), each country's tier-1 block generated before its
 * tier-2 block, exactly mirroring generateTwoDivisionLeague's own order.
 * England's block is therefore byte-identical to a plain
 * generateTwoDivisionLeague call for the same seed. Equal-sibling by
 * construction: every country uses the identical strength bands
 * (strengthOffset 0 for tier 1, DIVISION_2_OFFSET for tier 2) — no
 * per-country tuning.
 */
export function generateWorld(rng: () => number, seed = 0): League {
  const genSeed = hashInts(seed, 1);
  const comps = worldCompetitions();
  let pid = 0;
  let tidCursor = 0;
  const teams: LeagueTeam[] = [];
  const players: Player[] = [];
  for (const d1 of comps.filter((c) => c.tier === 1)) {
    const d2 = partnerOf(comps, d1.id);
    const d1Result = generateDivisionTeams(rng, tidCursor, NUM_TEAMS, 0, d1.id, genSeed, pid, d1.country);
    pid = d1Result.nextPid;
    tidCursor += NUM_TEAMS;
    const d2Result = generateDivisionTeams(
      rng, tidCursor, NUM_TEAMS_D2, DIVISION_2_OFFSET, d2.id, genSeed, pid, d2.country,
    );
    pid = d2Result.nextPid;
    tidCursor += NUM_TEAMS_D2;
    teams.push(...d1Result.teams, ...d2Result.teams);
    players.push(...d1Result.players, ...d2Result.players);
  }
  return { teams, players };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/core/generate.test.ts`
Expected: PASS (all tests, old and new — 7 new `generateWorld` tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/core/league/generate.ts test/core/generate.test.ts
git commit -m "Add generateWorld(): generate England/Spain/Italy in one rng pass"
```

---

### Task 5: 80 new club identities (Spain + Italy) + `NewLeague.tsx` safety clamp

**Files:**
- Modify: `src/core/teams/clubs.ts`
- Modify: `src/ui/pages/NewLeague.tsx`
- Test: `test/core/clubs.test.ts` (update existing length assertions)

**Interfaces:**
- Consumes: none new.
- Produces: `CLUBS` grows from 40 to 120 entries. Indices 40-79 are Spanish-flavored, 80-119 Italian-flavored — matching Task 4's tid layout exactly.

**Why the `NewLeague.tsx` change is in this task, not deferred to PR 3**: `NewLeague.tsx` renders `CLUBS.map(...)` as a flat, unfiltered picker with no bounds check. `createLeagueState` (untouched by this PR, per the global constraint) still only ever generates tids 0-39. The instant `CLUBS` has 120 entries, a user could pick tid 45 from the existing picker and get a save whose `userTid` doesn't exist in its own `league.teams` — an immediate crash on the Dashboard (`league.teams.find(t => t.tid === userTid)!`). This is a regression this PR would introduce, not a UI feature this PR is building — a one-line clamp to the first 40 entries prevents it. PR 3 replaces this clamp with a real country-aware picker.

- [ ] **Step 1: Write the failing test**

```typescript
// modify test/core/clubs.test.ts — replace the three `toHaveLength(40)` assertions
import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generateLeague } from "../../src/core/league/generate.js";
import { CLUBS, assignIdentities } from "../../src/core/teams/clubs.js";
import { englandCompetitions } from "../../src/core/competitions.js";

describe("CLUBS", () => {
  it("has exactly 120 entries", () => {
    expect(CLUBS).toHaveLength(120);
  });

  it("has all unique abbreviations that are exactly 3 characters", () => {
    const abbrevs = CLUBS.map((c) => c.abbrev);
    expect(new Set(abbrevs).size).toBe(120);
    for (const a of abbrevs) {
      expect(a).toHaveLength(3);
    }
  });

  it("has all unique names", () => {
    const names = CLUBS.map((c) => c.name);
    expect(new Set(names).size).toBe(120);
  });
});

describe("assignIdentities", () => {
  const league = generateLeague(mulberry32(42));
  const stored = assignIdentities(league, englandCompetitions());

  it("maps tids correctly (tid N gets CLUBS[N])", () => {
    for (const st of stored) {
      const club = CLUBS[st.tid];
      expect(st.name).toBe(club.name);
      expect(st.abbrev).toBe(club.abbrev);
      expect(st.colors).toEqual(club.colors);
    }
  });

  it("preserves the roster from the original LeagueTeam", () => {
    for (const st of stored) {
      const original = league.teams.find((t) => t.tid === st.tid)!;
      expect(st.roster).toEqual(original.roster);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/clubs.test.ts`
Expected: FAIL — `CLUBS` still has 40 entries.

- [ ] **Step 3: Append the 80 new club identities to `CLUBS` in `src/core/teams/clubs.ts`**

Insert immediately after the existing 40th entry (`{ name: "Vaultbridge", ... }`), before the closing `];`:

```typescript
  // Spanish-flavored fictional identities (tids 40-79), same invented-place-name
  // convention as the English list above — no real club names.
  { name: "Montebrisa Deportivo", abbrev: "MBR", colors: ["#c0392b", "#f1c40f"] },
  { name: "Riolindo CF",          abbrev: "RLN", colors: ["#1a5276", "#ffffff"] },
  { name: "Valdesierra Atletico", abbrev: "VDS", colors: ["#e74c3c", "#1a1a1a"] },
  { name: "Puertoclaro Union",    abbrev: "PCL", colors: ["#154360", "#f4d03f"] },
  { name: "Sierrablanca CD",      abbrev: "SBL", colors: ["#ffffff", "#2874a6"] },
  { name: "Casanegra Real",       abbrev: "CNG", colors: ["#1a1a1a", "#f0f3f4"] },
  { name: "Torrefuego CF",        abbrev: "TFG", colors: ["#d35400", "#1a1a1a"] },
  { name: "Almadera Deportivo",   abbrev: "ALM", colors: ["#7d6608", "#f7dc6f"] },
  { name: "Vegaoscura Atletico",  abbrev: "VOS", colors: ["#212f3d", "#e74c3c"] },
  { name: "Cantoverde Union",     abbrev: "CVR", colors: ["#196f3d", "#ffffff"] },
  { name: "Riobello CF",          abbrev: "RBL", colors: ["#a04000", "#f5b7b1"] },
  { name: "Monteclaro Deportivo", abbrev: "MCL", colors: ["#5b2c6f", "#f4d03f"] },
  { name: "Puertosueno CD",       abbrev: "PSU", colors: ["#0b5345", "#f8c471"] },
  { name: "Sierradulce Real",     abbrev: "SDU", colors: ["#943126", "#ecf0f1"] },
  { name: "Casaviento CF",        abbrev: "CVT", colors: ["#1b4f72", "#e67e22"] },
  { name: "Torresombra Atletico", abbrev: "TSB", colors: ["#17202a", "#c0392b"] },
  { name: "Almaverde Union",      abbrev: "AVE", colors: ["#145a32", "#f1c40f"] },
  { name: "Vegadorada Deportivo", abbrev: "VDO", colors: ["#b7950b", "#1a1a1a"] },
  { name: "Cantobravo CF",        abbrev: "CBR", colors: ["#78281f", "#f0f3f4"] },
  { name: "Riosanto CD",          abbrev: "RST", colors: ["#ffffff", "#922b21"] },
  { name: "Montefiel Deportivo",  abbrev: "MFL", colors: ["#2e4053", "#f39c12"] },
  { name: "Puertohondo CF",       abbrev: "PHD", colors: ["#0e6251", "#ecf0f1"] },
  { name: "Sierraluna Atletico",  abbrev: "SLU", colors: ["#4a235a", "#f7dc6f"] },
  { name: "Casadulce Union",      abbrev: "CDU", colors: ["#e67e22", "#1a1a1a"] },
  { name: "Torreverde CD",        abbrev: "TVR", colors: ["#186a3b", "#f4f6f6"] },
  { name: "Almasol Real",         abbrev: "AMS", colors: ["#f1c40f", "#212f3d"] },
  { name: "Vegabravo CF",         abbrev: "VBR", colors: ["#641e16", "#f0f3f4"] },
  { name: "Cantoclaro Deportivo", abbrev: "CCL", colors: ["#1a5276", "#f5b041"] },
  { name: "Riofiel CF",           abbrev: "RFL", colors: ["#6e2c00", "#ffffff"] },
  { name: "Montesombra Atletico", abbrev: "MSB", colors: ["#1c2833", "#e74c3c"] },
  { name: "Puertobello Union",    abbrev: "PBL", colors: ["#0b5345", "#f8c471"] },
  { name: "Sierrasueno CD",       abbrev: "SSU", colors: ["#512e5f", "#f0f3f4"] },
  { name: "Casafuego Real",       abbrev: "CFU", colors: ["#a93226", "#f4d03f"] },
  { name: "Torrebravo CF",        abbrev: "TBR", colors: ["#154360", "#e67e22"] },
  { name: "Almadorado Deportivo", abbrev: "ADO", colors: ["#7d6608", "#ffffff"] },
  { name: "Vegaclara CF",         abbrev: "VCL", colors: ["#117864", "#f7dc6f"] },
  { name: "Cantosanto Atletico",  abbrev: "CST", colors: ["#78281f", "#ecf0f1"] },
  { name: "Riohondo Union",       abbrev: "RHD", colors: ["#1b2631", "#f39c12"] },
  { name: "Monteveloz CD",        abbrev: "MVL", colors: ["#0e6251", "#f5b7b1"] },
  { name: "Sierrafiel Real",      abbrev: "SFL", colors: ["#283747", "#f8f9f9"] },
  // Italian-flavored fictional identities (tids 80-119), same convention.
  { name: "Montefosca Calcio",       abbrev: "MFO", colors: ["#1e8449", "#ffffff"] },
  { name: "Riondato AC",             abbrev: "RDT", colors: ["#154360", "#f1c40f"] },
  { name: "Vallescura Unione",       abbrev: "VSC", colors: ["#78281f", "#1a1a1a"] },
  { name: "Portofiero FC",           abbrev: "PFR", colors: ["#1a1a1a", "#f4d03f"] },
  { name: "Serracalda AC",           abbrev: "SCA", colors: ["#c0392b", "#f0f3f4"] },
  { name: "Casanera Sportiva",       abbrev: "CNR", colors: ["#212f3d", "#e67e22"] },
  { name: "Torresole Calcio",        abbrev: "TSL", colors: ["#d68910", "#1a1a1a"] },
  { name: "Almafiore AC",            abbrev: "AFI", colors: ["#7d3c98", "#f7dc6f"] },
  { name: "Valdombra Unione",        abbrev: "VDM", colors: ["#0b5345", "#e74c3c"] },
  { name: "Cantogrande FC",          abbrev: "CGR", colors: ["#1b4f72", "#f0f3f4"] },
  { name: "Rionero Calcio",          abbrev: "RNR", colors: ["#943126", "#ecf0f1"] },
  { name: "Montesalvo AC",           abbrev: "MSV", colors: ["#186a3b", "#f4d03f"] },
  { name: "Portovento Sportiva",     abbrev: "PVN", colors: ["#5b2c6f", "#f8c471"] },
  { name: "Serradolce FC",           abbrev: "SDL", colors: ["#b03a2e", "#ffffff"] },
  { name: "Casaluna Calcio",         abbrev: "CLN", colors: ["#17202a", "#e67e22"] },
  { name: "Torreombra AC",           abbrev: "TOM", colors: ["#0e6251", "#f5b041"] },
  { name: "Almaverdi Unione",        abbrev: "AVD", colors: ["#196f3d", "#f1c40f"] },
  { name: "Vegadorato FC",           abbrev: "VGD", colors: ["#b7950b", "#1a1a1a"] },
  { name: "Cantobruno Calcio",       abbrev: "CBN", colors: ["#6e2c00", "#f4f6f6"] },
  { name: "Riosanto AC",             abbrev: "RSA", colors: ["#ffffff", "#78281f"] },
  { name: "Montefiero Sportiva",     abbrev: "MFR", colors: ["#2e4053", "#f39c12"] },
  { name: "Portoprofondo FC",        abbrev: "PPR", colors: ["#0b5345", "#ecf0f1"] },
  { name: "Serraluna Calcio",        abbrev: "SRL", colors: ["#4a235a", "#f7dc6f"] },
  { name: "Casadolce AC",            abbrev: "CDL", colors: ["#e67e22", "#1a1a1a"] },
  { name: "Torreverdi Unione",       abbrev: "TVD", colors: ["#186a3b", "#f8f9f9"] },
  { name: "Almasole FC",             abbrev: "AMO", colors: ["#f1c40f", "#1a1a1a"] },
  { name: "Vegabruno Calcio",        abbrev: "VBN", colors: ["#641e16", "#f4f6f6"] },
  { name: "Cantochiaro AC",          abbrev: "CCH", colors: ["#1a5276", "#f5b041"] },
  { name: "Riofiero Sportiva",       abbrev: "RFR", colors: ["#6e2c00", "#ecf0f1"] },
  { name: "Monteombra FC",           abbrev: "MOM", colors: ["#1c2833", "#e74c3c"] },
  { name: "Portobello Calcio",       abbrev: "PBE", colors: ["#0b5345", "#f8c471"] },
  { name: "Serrasogno AC",           abbrev: "SSG", colors: ["#512e5f", "#f4f6f6"] },
  { name: "Casafuoco Unione",        abbrev: "CFO", colors: ["#a93226", "#f4d03f"] },
  { name: "Torrebruno FC",           abbrev: "TBN", colors: ["#154360", "#e67e22"] },
  { name: "Almadorato Calcio",       abbrev: "AMD", colors: ["#7d6608", "#ffffff"] },
  { name: "Vegachiara AC",           abbrev: "VCH", colors: ["#117864", "#f7dc6f"] },
  { name: "Cantosanto Sportiva",     abbrev: "CTS", colors: ["#78281f", "#f0f3f4"] },
  { name: "Riofondo FC",             abbrev: "RFN", colors: ["#1b2631", "#f39c12"] },
  { name: "Montevelo Calcio",        abbrev: "MVO", colors: ["#0e6251", "#f5b7b1"] },
  { name: "Serrafiera AC",           abbrev: "SFR", colors: ["#283747", "#f8f9f9"] },
```

- [ ] **Step 4: Clamp `NewLeague.tsx`'s club picker to the England block**

In `src/ui/pages/NewLeague.tsx`, import `NUM_TEAMS` and `NUM_TEAMS_D2` from `../../core/constants.js` and change the list rendering:

```typescript
import { NUM_TEAMS, NUM_TEAMS_D2 } from "../../core/constants.js";
```

```typescript
      <div className="list-group mb-3">
        {CLUBS.slice(0, NUM_TEAMS + NUM_TEAMS_D2).map((club, i) => (
```

(The `key={club.abbrev}` and `onClick={() => setSelectedTid(i)}` lines below are unchanged — `i` is still the correct tid since `.slice(0, 40)` preserves index alignment with the original array.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/core/clubs.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/core/teams/clubs.ts src/ui/pages/NewLeague.tsx test/core/clubs.test.ts
git commit -m "Add 80 Spanish/Italian club identities; clamp NewLeague picker to England until PR 3"
```

---

### Task 6: Integration smoke test — prove PR 1's machinery is genuinely cross-border

**Files:**
- Test: `test/core/worldIntegration.test.ts` (new file)

**Interfaces:**
- Consumes: `generateWorld`, `worldCompetitions`, `assignIdentities`, `generateSchedule` (from `../../src/core/schedule.js`), `simThrough`, `simOffseason`, `LeagueStore` shape (all existing).
- Produces: nothing new — this is a proof, not a feature. It builds one `LeagueStore` entirely by hand from `generateWorld`/`worldCompetitions` (the way `createLeagueState` will once PR 3 wires it up) and runs one season + one offseason through it, without touching `createLeagueState` itself.

**Why this task exists**: PR 1's offseason loop, promotion/relegation, AI evaluation, and Division-2 ceiling sweep were all built to iterate `league.competitions` generically, with no changes needed for this PR — that claim is currently only supported by reading the code. This test proves it by actually running 6 competitions through the real pipeline once.

- [ ] **Step 1: Write the test**

```typescript
// test/core/worldIntegration.test.ts
import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generateWorld } from "../../src/core/league/generate.js";
import { worldCompetitions } from "../../src/core/competitions.js";
import { assignIdentities } from "../../src/core/teams/clubs.js";
import { generateSchedule } from "../../src/core/schedule.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import type { LeagueStore } from "../../src/core/leagueState.js";

function buildWorldLeague(seed: number): LeagueStore {
  const rng = mulberry32(seed);
  const world = generateWorld(rng, seed);
  const competitions = worldCompetitions();
  const teams = assignIdentities(world, competitions);
  const schedule = competitions.flatMap((comp) =>
    generateSchedule(teams.filter((t) => t.compId === comp.id).map((t) => t.tid)),
  );
  return {
    lid: 1,
    meta: { name: "World Test League", created: Date.now(), userTid: 0 },
    competitions,
    teams,
    players: world.players,
    season: 1,
    phase: "regular",
    schedule,
    played: [],
    negotiations: [],
    inboundOffers: [],
    transfers: [],
    winterMarketRunSeason: null,
    seasonHistory: [],
    newsEvents: [],
  };
}

describe("world integration (generateWorld through the real season/offseason pipeline)", () => {
  it("simulates a full season across all 6 competitions without crashing", () => {
    const rng = mulberry32(100);
    let league = buildWorldLeague(100);
    league = simThrough(league, "season", rng);
    expect(league.played.length).toBeGreaterThan(0);
    // Every played match is within one competition — no cross-competition fixtures.
    const compByTid = new Map(league.teams.map((t) => [t.tid, t.compId]));
    for (const m of league.played) {
      expect(compByTid.get(m.home)).toBe(compByTid.get(m.away));
    }
  });

  it("runs a full offseason: promotion/relegation happens independently per country", () => {
    const rng = mulberry32(101);
    let league = buildWorldLeague(101);
    league = simThrough(league, "season", rng);
    const beforeCompByTid = new Map(league.teams.map((t) => [t.tid, t.compId]));
    league = simOffseason(league, rng);
    expect(league.teams).toHaveLength(120);
    // Every competition still has exactly 20 teams after the swap.
    for (const comp of league.competitions) {
      expect(league.teams.filter((t) => t.compId === comp.id)).toHaveLength(20);
    }
    // At least one country actually swapped teams (statistically near-certain
    // across 3 countries x 3 promotions each) — proves the per-country loop
    // from PR 1 (computeCountrySwaps/applyCompetitionSwaps) is actually firing
    // for Spain and Italy, not just England.
    let anySwapped = false;
    for (const t of league.teams) {
      if (beforeCompByTid.get(t.tid) !== t.compId) anySwapped = true;
    }
    expect(anySwapped).toBe(true);
  });

  it("the Division-2 ceiling sweep moves a qualifying player to tier 1 in ANY country, not just England", () => {
    const rng = mulberry32(102);
    let league = buildWorldLeague(102);
    league = simThrough(league, "season", rng);
    // Force a non-English tier-2 (Spain D1's partner, i.e. Spain D2, compId 3)
    // AI player to a qualifying OVR.
    const spainD2Team = league.teams.find((t) => t.compId === 3 && t.tid !== league.meta.userTid)!;
    const targetPid = spainD2Team.roster[0];
    league = {
      ...league,
      players: league.players.map((p) => (p.pid === targetPid ? { ...p, ovr: 95 } : p)),
    };
    const next = simOffseason(league, rng);
    const newTeam = next.teams.find((t) => t.roster.includes(targetPid))!;
    const newComp = next.competitions.find((c) => c.id === newTeam.compId)!;
    expect(newComp.tier).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run test/core/worldIntegration.test.ts`
Expected: PASS (3 tests). If a test fails, this is the plan's one genuine risk point — re-read the failure carefully before changing anything in Tasks 1-5; the most likely cause is a tid/compId misalignment between `generateWorld`'s tid layout and `CLUBS`' index layout (unlikely to affect this test, which doesn't touch `CLUBS`) or an off-by-one in `worldCompetitions()`'s id assignment.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add test/core/worldIntegration.test.ts
git commit -m "Add integration test proving PR 1's per-competition machinery is cross-border by construction"
```

---

### Task 7: Full-suite gate, CLAUDE.md, PR

**Files:**
- Modify: `CLAUDE.md` (append to the "More leagues around the world" section PR 1 added).

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all tests pass (426 from before + the ~20 new ones this plan adds). Runtime should stay close to PR 1's baseline (~80s) since no existing dynasty-scale test was made to run over 120 teams — only the new, small `worldIntegration.test.ts` adds meaningfully more work (single season + single offseason, not a multi-season loop).

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: clean production build (this PR touches no UI rendering paths beyond the one-line `NewLeague.tsx` clamp).

- [ ] **Step 3: Update CLAUDE.md**

Append a new paragraph to the existing "## More leagues around the world (competitions-as-data refactor, in progress)" section (added by PR 1), directly after its one existing paragraph:

```markdown

**PR 2 — Spain/Italy generation, additive only (merged).** `worldCompetitions()` (`src/core/competitions.ts`) adds Spain and Italy as 4 more competitions (ids 2-5) alongside England's existing 0/1. `generateWorld()` (`src/core/league/generate.ts`) generates all 3 countries' 120 clubs in one rng pass — England first, so its block stays byte-identical to `generateTwoDivisionLeague` for the same seed — with every country using identical strength/budget bands (equal siblings, no new tuning constants; PR 1's tier-based finance already scales correctly with zero changes here). `CLUBS` grew 40 → 120 with fictional Spanish/Italian club identities (same invented-name, no-real-clubs convention as the English set). Nationality generation became country-aware (`pickNationality(rng, homeCountry?)`, `NATIONALITIES.Italy` added) — safe to change because nationality/name generation already ran on an isolated per-player rng sub-stream (confirmed by reading `generatePlayer` before touching it), so this could never perturb the shared rng sequence that ratings/potential/positions depend on. **Deliberately not wired up**: `createLeagueState` still only generates the England-only 40-team league — a mid-session user decision moved the actual switch-over to PR 3 (alongside the country-picker UI) rather than PR 2, to avoid updating ~15 existing test fixtures and tripling per-test runtime for a change nobody could see yet. One integration test (`test/core/worldIntegration.test.ts`) builds a `LeagueStore` from `generateWorld`/`worldCompetitions` by hand and runs a real season + offseason through it, confirming PR 1's offseason loop, promotion/relegation, and Division-2 ceiling sweep are genuinely cross-border by construction — no code changes were needed in any of them. One necessary side effect: growing `CLUBS` to 120 would have let the existing (unfiltered) `NewLeague.tsx` club picker offer a Spanish/Italian club that `createLeagueState` can't yet generate, crashing on load — clamped to the first 40 entries until PR 3 replaces the picker.
```

- [ ] **Step 4: Commit, push, open the PR**

```bash
git add CLAUDE.md
git commit -m "Update CLAUDE.md for PR 2 (Spain/Italy generation)"
git push -u origin HEAD
gh pr create --title "Spain/Italy generation (more-leagues PR 2/3): additive, not yet wired to new saves" \
  --body "Second of the more-leagues rollout's 3 PRs, per docs/superpowers/specs/2026-07-16-more-leagues-design.md and docs/superpowers/plans/2026-07-16-more-leagues-pr2-spain-italy-generation.md.

Builds generateWorld()/worldCompetitions() (Spain + Italy, 80 new club identities, country-aware nationality flavor) as new, independently-tested code. Does NOT change what a new save looks like — createLeagueState is untouched by design (a mid-session user decision); PR 3 wires the switch-over up alongside the country-picker UI.

One integration test proves PR 1's offseason/promotion/AI/ceiling-sweep machinery already works across all 6 competitions with zero further changes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Not in this plan (PR 3, per the spec)

- Wiring `createLeagueState` to `generateWorld()`/`worldCompetitions()`.
- The country step in the new-league creation flow (a real picker replacing this PR's clamp).
- Competition dropdowns on Standings/Awards/Stat Leaders grouped by country.
- Finance's league-wide table competition filter.
- The Manual's "The World" section.
- The one dynasty-scale audit the original spec called for — now scoped to run after PR 3, once the world is actually live in new saves.
