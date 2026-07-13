# Tackle/Interception Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the engine's single, over-crediting `tackles` stat into two realistically-sized stats, `tackles` and `interceptions`, without changing match flow/possession/scoring, fixing both the Box Score's unrealistic per-match counts and the match-rating system's center-back-dominated leaderboard.

**Architecture:** `matchSim.ts`'s existing turnover roll (`turnoverP`) and the player-selection weighting it already uses are left completely untouched. A new second roll, made only after a turnover already fires, decides whether that turnover is credited as a tackle, an interception, or nothing — mirroring how a real box score doesn't log every stoppage as a defensive action. Tackle credit continues to use the existing tackling-weighted selection (`pickTackler`); interception credit uses a new `pickInterceptor`, weighted by the player's previously-unused `interceptions` skill rating rather than reusing `tackling` for both. The change threads through the full data pipeline: `PlayerMatchLine` → `SeasonStats` rollup → match rating → migration → UI.

**Tech Stack:** TypeScript, Vitest (`vitest run`), React (UI pages), IndexedDB via `src/db` (migration).

## Global Constraints

- `turnoverP` and its position-weighted player selection (`pickTackler`, `TACKLE_WEIGHTS`) must not change — match flow, possession, and scoring stay exactly as they are today (per user decision during brainstorming).
- No new `MatchEventType`/`MatchEvent` shape — the existing `"turnover"` event and its `pids` attribution stay as-is; only the stat credit resulting from a turnover is split three ways.
- Interception credit is weighted by the player's dedicated `interceptions` skill rating (`src/core/players/types.ts:8`), not by reusing `tackling` (per user decision during plan review) — this rating already exists on every `Player` but was previously unused in match simulation.
- Every new persisted field (`PlayerMatchLine.interceptions`, `SeasonStats.interceptions`) needs an old-save migration default of `0`, following the exact pattern already used for `minutesPlayed`/`rating` in `src/db/migrate.ts`.
- Run `npm test` (→ `vitest run`) after every task; all existing tests must keep passing alongside new ones.

---

### Task 1: `MatchPlayer.interceptions` + `pickInterceptor`

**Files:**
- Modify: `src/engine/attribution.ts:6-16` (`MatchPlayer` interface), `:67-69` (add new weight usage), after `:125` (add `pickInterceptor`)
- Modify: `src/core/league/matchPlayers.ts:4-16` (`toMatchPlayer`)
- Modify: `test/engine/attribution.test.ts:8-22` (`makeSquad` fixture — add the new required field)
- Modify: `test/engine/matchRating.test.ts:9-39` (`makeSquad`/`makeBench` fixtures — add the new required field)
- Test: `test/engine/attribution.test.ts` (new `pickInterceptor` cases)

**Interfaces:**
- Produces: `MatchPlayer.interceptions: number` (new required field), `pickInterceptor(rng: () => number, players: MatchPlayer[]): MatchPlayer` (exported from `src/engine/attribution.ts`, same shape as the existing `pickTackler`).
- Consumes: existing `weightedPick`, `TACKLE_WEIGHTS` (both already in `attribution.ts`).

`MatchPlayer` is a required-fields interface consumed by every match-sim test fixture in the repo, so adding a field means every object literal of that shape needs updating — this task fixes all of them (there are exactly two: the fixtures in `attribution.test.ts` and `matchRating.test.ts`).

- [ ] **Step 1: Add the field to `MatchPlayer`**

In `src/engine/attribution.ts`, change the interface (lines 6-16):

```ts
export interface MatchPlayer {
  pid: number;
  pos: MatchPosition;
  shooting: number;
  dribbling: number;
  tackling: number;
  keeping: number;
  positioning: number;
  heading: number;
  stamina: number;
  interceptions: number;
}
```

- [ ] **Step 2: Update the two test fixtures to include the new field (compile fix, no behavior change yet)**

In `test/engine/attribution.test.ts`, `makeSquad` (lines 8-22), add `interceptions` to every object literal — set it equal to `tackling` for now (a neutral placeholder value; the point of this step is only to keep the fixture compiling, not to test interception behavior yet):

```ts
function makeSquad(pidOffset = 0): MatchPlayer[] {
  return [
    { pid: pidOffset + 1, pos: "GK", shooting: 10, dribbling: 10, tackling: 10, keeping: 80, positioning: 50, heading: 40, stamina: 60, interceptions: 10 },
    { pid: pidOffset + 2, pos: "CB", shooting: 20, dribbling: 30, tackling: 75, keeping: 5, positioning: 70, heading: 65, stamina: 60, interceptions: 75 },
    { pid: pidOffset + 3, pos: "CB", shooting: 15, dribbling: 25, tackling: 72, keeping: 5, positioning: 68, heading: 60, stamina: 60, interceptions: 72 },
    { pid: pidOffset + 4, pos: "FB", shooting: 25, dribbling: 50, tackling: 60, keeping: 5, positioning: 55, heading: 40, stamina: 60, interceptions: 60 },
    { pid: pidOffset + 5, pos: "FB", shooting: 30, dribbling: 55, tackling: 58, keeping: 5, positioning: 52, heading: 38, stamina: 60, interceptions: 58 },
    { pid: pidOffset + 6, pos: "DM", shooting: 35, dribbling: 45, tackling: 70, keeping: 5, positioning: 65, heading: 50, stamina: 60, interceptions: 70 },
    { pid: pidOffset + 7, pos: "CM", shooting: 50, dribbling: 60, tackling: 50, keeping: 5, positioning: 60, heading: 45, stamina: 60, interceptions: 50 },
    { pid: pidOffset + 8, pos: "CM", shooting: 55, dribbling: 62, tackling: 48, keeping: 5, positioning: 58, heading: 42, stamina: 60, interceptions: 48 },
    { pid: pidOffset + 9, pos: "W", shooting: 65, dribbling: 75, tackling: 25, keeping: 5, positioning: 55, heading: 35, stamina: 60, interceptions: 25 },
    { pid: pidOffset + 10, pos: "W", shooting: 60, dribbling: 70, tackling: 28, keeping: 5, positioning: 53, heading: 33, stamina: 60, interceptions: 28 },
    { pid: pidOffset + 11, pos: "ST", shooting: 82, dribbling: 65, tackling: 15, keeping: 5, positioning: 60, heading: 55, stamina: 60, interceptions: 15 },
  ];
}
```

In `test/engine/matchRating.test.ts`, `makeSquad` (lines 9-24) and `makeBench` (lines 26-39), add `interceptions: pos === "CB" || pos === "DM" ? 70 : 40` inside each returned object (same conditional already used for `tackling` in `makeSquad`; for `makeBench`, which has no such conditional, just use the flat `interceptions: 40` matching its flat `tackling: 40`):

```ts
function makeSquad(pidOffset: number): MatchPlayer[] {
  const positions: MatchPlayer["pos"][] = [
    "GK", "CB", "CB", "FB", "FB", "DM", "CM", "CM", "W", "W", "ST",
  ];
  return positions.map((pos, i) => ({
    pid: pidOffset + i + 1,
    pos,
    shooting: pos === "ST" ? 80 : 40,
    dribbling: 50,
    tackling: pos === "CB" || pos === "DM" ? 70 : 40,
    keeping: pos === "GK" ? 80 : 5,
    positioning: 55,
    heading: pos === "CB" || pos === "ST" ? 70 : 40,
    stamina: 50,
    interceptions: pos === "CB" || pos === "DM" ? 70 : 40,
  }));
}

function makeBench(pidOffset: number): MatchPlayer[] {
  const positions: MatchPlayer["pos"][] = ["GK", "CB", "FB", "CM", "ST"];
  return positions.map((pos, i) => ({
    pid: pidOffset + i + 1,
    pos,
    shooting: 40,
    dribbling: 50,
    tackling: 40,
    keeping: pos === "GK" ? 80 : 5,
    positioning: 55,
    heading: 40,
    stamina: 60,
    interceptions: 40,
  }));
}
```

- [ ] **Step 3: Run the full suite to confirm it still compiles and passes**

Run: `npm test`
Expected: PASS (no behavioral change yet — `interceptions` exists on the type but nothing reads it).

- [ ] **Step 4: Write the failing test for `pickInterceptor`**

Add to `test/engine/attribution.test.ts`, inside the `describe("attribution helpers", ...)` block, alongside the existing `pickTackler` test:

```ts
  it("pickInterceptor favors center-backs and defensive midfielders, weighted by the interceptions rating", () => {
    const rng = mulberry32(42);
    const squad = makeSquad();
    const picks = new Map<number, number>();
    for (let i = 0; i < 1000; i++) {
      const p = pickInterceptor(rng, squad);
      picks.set(p.pid, (picks.get(p.pid) ?? 0) + 1);
    }
    const cbPicks = (picks.get(2) ?? 0) + (picks.get(3) ?? 0);
    const stPicks = picks.get(11) ?? 0;
    expect(cbPicks).toBeGreaterThan(stPicks);
  });

  it("pickInterceptor is driven by the interceptions rating, not tackling", () => {
    // Give a winger a much higher interceptions rating than a center-back's,
    // while keeping tackling the same as the base squad — pickInterceptor
    // should now favor the winger for interception credit even though
    // pickTackler still favors the center-back.
    const rng = mulberry32(7);
    const squad = makeSquad().map((p) =>
      p.pid === 9 ? { ...p, interceptions: 95 } : p,
    );
    const picks = new Map<number, number>();
    for (let i = 0; i < 2000; i++) {
      const p = pickInterceptor(rng, squad);
      picks.set(p.pid, (picks.get(p.pid) ?? 0) + 1);
    }
    const boostedWingerPicks = picks.get(9) ?? 0;
    const otherWingerPicks = picks.get(10) ?? 0;
    expect(boostedWingerPicks).toBeGreaterThan(otherWingerPicks * 3);
  });
```

Update the existing import line near the top of `test/engine/attribution.test.ts`:

```ts
import { pickShooter, pickAssister, pickTackler, pickInterceptor } from "../../src/engine/attribution.js";
```

- [ ] **Step 5: Run the new tests to verify they fail**

Run: `npx vitest run test/engine/attribution.test.ts`
Expected: FAIL with `pickInterceptor is not defined` / `does not provide an export named 'pickInterceptor'`.

- [ ] **Step 6: Implement `pickInterceptor` and wire it through `toMatchPlayer`**

In `src/engine/attribution.ts`, after `pickTackler` (after line 125), add:

```ts
/**
 * Picks who wins a clean interception. Reuses TACKLE_WEIGHTS' CB/DM/FB-leaning
 * position shape (the same positions that read the game well also tend to
 * make clean interceptions), but keyed to the player's own `interceptions`
 * rating rather than `tackling` — a distinct skill previously unused in match
 * simulation.
 */
export function pickInterceptor(rng: () => number, players: MatchPlayer[]): MatchPlayer {
  const outfield = players.filter((p) => p.pos !== "GK");
  if (outfield.length === 0) return players[0];
  return weightedPick(rng, outfield, TACKLE_WEIGHTS, "interceptions");
}
```

In `src/core/league/matchPlayers.ts`, add the new field to `toMatchPlayer` (the existing `tackling` field stays exactly as its current blend — only a new, separate field is added):

```ts
export function toMatchPlayer(p: Player): MatchPlayer {
  return {
    pid: p.pid,
    pos: p.pos,
    shooting: (p.ratings.finishing + p.ratings.longShot) / 2,
    dribbling: p.ratings.dribbling,
    tackling: (p.ratings.tackling + p.ratings.interceptions) / 2,
    keeping: p.ratings.goalkeeping,
    positioning: p.ratings.positioning,
    heading: p.ratings.jumping,
    stamina: p.ratings.stamina,
    interceptions: p.ratings.interceptions,
  };
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run test/engine/attribution.test.ts`
Expected: PASS

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/engine/attribution.ts src/core/league/matchPlayers.ts test/engine/attribution.test.ts test/engine/matchRating.test.ts
git commit -m "Add MatchPlayer.interceptions and pickInterceptor"
```

---

### Task 2: `PlayerMatchLine.interceptions` + three-way turnover credit roll in `matchSim.ts`

**Files:**
- Modify: `src/engine/attribution.ts:38-51` (`PlayerMatchLine`), `:157-162` (`emptyLine`)
- Modify: `src/engine/constants.ts` (new constants, after `TURNOVER_BASE` at line 13-14)
- Modify: `src/engine/matchSim.ts:41-50` (imports), `:511-534` (turnover handling)
- Test: `test/engine/attribution.test.ts` (new `describe` block — this repo's `simMatchDetailed` tests live here, not in a separate `matchSim.test.ts`; the top-level `test/matchSim.test.ts` only covers the composite-only, no-player-identity `simMatch`/`resolveShot`/`clamp`, which this task's turnover-block edit does not touch, so its golden-snapshot seed-999 test is unaffected)

**Interfaces:**
- Consumes: `pickInterceptor` from Task 1.
- Produces: `PlayerMatchLine.interceptions: number`, `TACKLE_CREDIT_PROB`/`INTERCEPTION_CREDIT_PROB` (exported `number` constants from `src/engine/constants.ts`).

- [ ] **Step 1: Add the field to `PlayerMatchLine` and `emptyLine`**

In `src/engine/attribution.ts`, update the interface (lines 38-51):

```ts
export interface PlayerMatchLine {
  pid: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  saves: number;
  tackles: number;
  interceptions: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  /** FotMob-style 1-10 match performance rating; see engine/matchRating.ts. */
  rating: number;
}
```

And `emptyLine` (lines 157-162):

```ts
export function emptyLine(pid: number): PlayerMatchLine {
  return {
    pid, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, saves: 0, tackles: 0,
    interceptions: 0, yellowCards: 0, redCards: 0, minutesPlayed: 0, rating: 6.0,
  };
}
```

- [ ] **Step 2: Run the full suite to confirm it still compiles**

Run: `npm test`
Expected: PASS (`interceptions` exists but stays 0 everywhere — `emptyLine` never sets it non-zero yet).

- [ ] **Step 3: Add the new tuning constants**

In `src/engine/constants.ts`, after line 14 (`REBOUND_PROB`), add:

```ts
// Of every turnover (see TURNOVER_BASE above), the share credited as a
// stat-worthy tackle vs. a clean interception vs. no credit at all (a real
// match has plenty of misplaced passes/loose balls no box score attributes
// to anyone). Split roughly in half between the two credited outcomes;
// starting values chosen so a busy center-back lands in the real-world
// plausible ~2-6 tackles and ~2-5 interceptions per match instead of the
// pre-fix high-teens blowout — pending audit-tuning per the design doc.
export const TACKLE_CREDIT_PROB = 0.2;
export const INTERCEPTION_CREDIT_PROB = 0.2;
```

- [ ] **Step 4: Write the failing tests for the categorical split**

Add to `test/engine/attribution.test.ts`, as a new `describe` block after the existing `describe("simMatchDetailed", ...)` block. This file already imports `mulberry32`, `makeTeam` (from `../../src/engine/composites.js`), `simMatchDetailed`, and defines the `makeSquad` fixture used above — no new imports needed:

```ts
describe("tackle/interception credit split", () => {
  it("produces both tackles and interceptions across many matches, each far below the old high-teens-per-match volume", () => {
    let maxTackles = 0;
    let maxInterceptions = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const rng = mulberry32(seed);
      const result = simMatchDetailed(
        rng, makeTeam("Home"), makeTeam("Away"), makeSquad(0), makeSquad(100),
      );
      for (const line of [...result.boxScore.home, ...result.boxScore.away]) {
        maxTackles = Math.max(maxTackles, line.tackles);
        maxInterceptions = Math.max(maxInterceptions, line.interceptions);
      }
    }
    expect(maxTackles).toBeGreaterThan(0);
    expect(maxInterceptions).toBeGreaterThan(0);
    // The pre-fix behavior could produce mid-teens tackles for one CB in a
    // single match; both credited stats must now stay well under that.
    expect(maxTackles).toBeLessThan(12);
    expect(maxInterceptions).toBeLessThan(12);
  });

  it("never credits a tackle and an interception from the same turnover", () => {
    // Every single turnover's credit is exclusive (tackle XOR interception
    // XOR neither) by construction — verified indirectly: the sum of all
    // tackles+interceptions across the match never exceeds the number of
    // turnover events logged.
    const rng = mulberry32(99);
    const result = simMatchDetailed(
      rng, makeTeam("Home"), makeTeam("Away"), makeSquad(0), makeSquad(100),
    );
    const turnoverEvents = result.boxScore.events.filter((e) => e.type === "turnover");
    const totalCredited = [...result.boxScore.home, ...result.boxScore.away]
      .reduce((s, l) => s + l.tackles + l.interceptions, 0);
    expect(totalCredited).toBeLessThanOrEqual(turnoverEvents.length);
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npx vitest run test/engine/attribution.test.ts`
Expected: FAIL — `maxInterceptions` stays `0` (nothing increments `interceptions` yet), so the first new test's `expect(maxInterceptions).toBeGreaterThan(0)` fails.

- [ ] **Step 6: Implement the three-way credit roll in `matchSim.ts`**

Update the import block (lines 41-50) to add `pickInterceptor`:

```ts
import {
  pickShooter,
  pickAssister,
  pickTackler,
  pickInterceptor,
  pickFouler,
  pickHeader,
  pickCarrier,
  eventTypeFromShot,
  emptyLine,
} from "./attribution.js";
```

Add `TACKLE_CREDIT_PROB, INTERCEPTION_CREDIT_PROB` to the existing constants import block (the one starting at line 1, importing from `./constants.js`) — insert them alphabetically-adjacent to `TURNOVER_BASE`:

```ts
  TURNOVER_BASE,
  TACKLE_CREDIT_PROB,
  INTERCEPTION_CREDIT_PROB,
  REBOUND_PROB,
```

Replace the turnover block (lines 521-524):

```ts
    if (rng() < turnoverP) {
      const tackler = pickTackler(rng, onPitch[defSide]);
      lines.get(tackler.pid)!.tackles++;
      events.push({ clock, type: "turnover", side: defSide, pids: [tackler.pid] });
```

with:

```ts
    if (rng() < turnoverP) {
      const creditRoll = rng();
      let tackler: MatchPlayer;
      if (creditRoll < TACKLE_CREDIT_PROB) {
        tackler = pickTackler(rng, onPitch[defSide]);
        lines.get(tackler.pid)!.tackles++;
      } else if (creditRoll < TACKLE_CREDIT_PROB + INTERCEPTION_CREDIT_PROB) {
        tackler = pickInterceptor(rng, onPitch[defSide]);
        lines.get(tackler.pid)!.interceptions++;
      } else {
        tackler = pickTackler(rng, onPitch[defSide]);
      }
      events.push({ clock, type: "turnover", side: defSide, pids: [tackler.pid] });
```

(The rest of the block — the injury-on-tackle check and `poss = defSide; continue;` — is unchanged; only these four lines are replaced.) Note this shifts the in-match RNG stream by one extra draw per turnover (the new `creditRoll`) — every existing test in the repo asserts on statistical properties or ranges (e.g. "greater than 100 picks", "sums equal team totals"), not exact seeded output values, so none should break from the shift; if any test elsewhere does assert an exact value tied to a specific seed's play-by-play, re-verify it in Step 8.

- [ ] **Step 7: Run the new tests to verify they pass**

Run: `npx vitest run test/engine/attribution.test.ts`
Expected: PASS

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS. `test/matchSim.test.ts`'s golden-snapshot test (seed 999, exact `home`/`away`/`possessionHome`/`shots` values) exercises `simMatch`, the composite-only path that never calls `pickTackler`/`pickInterceptor` or touches `lines`, so it is unaffected by the RNG-stream shift from Step 6 and should still pass unchanged. If any *other* test does assert an exact value tied to a specific seed's `simMatchDetailed` play-by-play, its expected values (not the new credit-roll logic) would need updating, since the one-draw shift is an accepted, understood side effect confined to `simMatchDetailed`.

- [ ] **Step 9: Commit**

```bash
git add src/engine/attribution.ts src/engine/constants.ts src/engine/matchSim.ts test/engine/attribution.test.ts
git commit -m "Split tackles into tackles/interceptions via a post-turnover credit roll"
```

---

### Task 3: `SeasonStats.interceptions` + rollup

**Files:**
- Modify: `src/core/players/types.ts:14-35` (`SeasonStats`, `emptySeasonStats`)
- Modify: `src/core/simThrough.ts:44-53` (`accumulateStats`)
- Test: `test/core/simThrough.test.ts` (`accumulateStats` is private/unexported, so it's exercised black-box via `simThrough`, matching every other test in this file — note `test/core/rollup.test.ts` is unrelated, it tests team-composite roll-up (`rollupComposites`), not player season-stat accumulation)

**Interfaces:**
- Consumes: `PlayerMatchLine.interceptions` from Task 2.
- Produces: `SeasonStats.interceptions: number`.

- [ ] **Step 1: Add the field**

In `src/core/players/types.ts`, update `SeasonStats` (lines 14-28):

```ts
export interface SeasonStats {
  season: number;
  appearances: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  saves: number;
  tackles: number;
  interceptions: number;
  minutesPlayed: number;
  /** Sum of per-match ratings across appearances; divide by `appearances` for the average. */
  ratingSum: number;
  /** Kept alongside ratingSum (rather than derived on read) so Leaders.tsx can sort/index it like any other stat. */
  avgRating: number;
}
```

And `emptySeasonStats` (lines 30-35):

```ts
export function emptySeasonStats(season: number): SeasonStats {
  return {
    season, appearances: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, saves: 0, tackles: 0,
    interceptions: 0, minutesPlayed: 0, ratingSum: 0, avgRating: 0,
  };
}
```

- [ ] **Step 2: Run the full suite to confirm it still compiles**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Write the failing test**

Add to `test/core/simThrough.test.ts`, inside the existing `describe("simThrough", ...)` block, reusing the file's own `makeLeagueStore` fixture:

```ts
  it("rolls up interceptions into season stats alongside tackles", () => {
    const store = makeLeagueStore(42);
    const rng = mulberry32(700);
    const result = simThrough(store, "month", rng);

    const withInterceptions = result.players.find((p) =>
      p.stats.some((s) => s.season === store.season && s.interceptions > 0),
    );
    expect(withInterceptions).toBeDefined();
    const ss = withInterceptions!.stats.find((s) => s.season === store.season)!;
    expect(ss.interceptions).toBeGreaterThan(0);
    expect(ss.appearances).toBeGreaterThan(0);
  });
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run test/core/simThrough.test.ts`
Expected: FAIL — `withInterceptions` is `undefined` (`expect(withInterceptions).toBeDefined()` fails), since `SeasonStats.interceptions` was added in Step 1 but `accumulateStats` doesn't populate it yet, so every player's `interceptions` stays at `emptySeasonStats`'s default of `0`.

- [ ] **Step 5: Implement the rollup**

In `src/core/simThrough.ts`, update `accumulateStats` (inside the `if (line)` block, lines 44-53), adding one line next to the existing `ss.tackles += line.tackles;`:

```ts
    const line = allLines.find((l) => l.pid === p.pid);
    if (line) {
      ss.appearances++;
      ss.goals += line.goals;
      ss.assists += line.assists;
      ss.shots += line.shots;
      ss.shotsOnTarget += line.shotsOnTarget;
      ss.saves += line.saves;
      ss.tackles += line.tackles;
      ss.interceptions += line.interceptions;
      ss.minutesPlayed += line.minutesPlayed;
      ss.ratingSum += line.rating;
      ss.avgRating = ss.ratingSum / ss.appearances;
    }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run test/core/simThrough.test.ts`
Expected: PASS

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/core/players/types.ts src/core/simThrough.ts test/core/simThrough.test.ts
git commit -m "Roll up interceptions into SeasonStats"
```

---

### Task 4: `INTERCEPTION_WEIGHT` in match rating

**Files:**
- Modify: `src/engine/matchRating.ts:21` area (new weight table), `:52` area (apply it)
- Test: `test/engine/matchRating.test.ts` (new cases)

**Interfaces:**
- Consumes: `PlayerMatchLine.interceptions` from Task 2.
- Produces: `INTERCEPTION_WEIGHT: Record<PositionGroup, number>` (internal to `matchRating.ts`, not exported — matches how `TACKLE_WEIGHT` isn't exported today).

- [ ] **Step 1: Write the failing tests**

Add to `test/engine/matchRating.test.ts`, inside `describe("computeMatchRating", ...)`:

```ts
  it("rewards interceptions like tackles, more for a defender than a forward", () => {
    const line = { ...emptyLine(1), interceptions: 5 };
    const defRating = computeMatchRating(line, "CB", 90, 0);
    const fwdRating = computeMatchRating(line, "ST", 90, 0);
    expect(defRating).toBeGreaterThan(6.8); // above the CB clean-sheet-bonus baseline
    expect(defRating).toBeGreaterThan(fwdRating);
  });

  it("does not let a realistic interception count alone push a scoreless CB above 8", () => {
    // Regression guard for the original bug report: a busy-but-scoreless CB
    // (5 interceptions, the top end of the new realistic per-match range)
    // should not rating-farm into the 9s the way high-teens tackles used to.
    const line = { ...emptyLine(1), interceptions: 5 };
    expect(computeMatchRating(line, "CB", 90, 0)).toBeLessThan(8);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/engine/matchRating.test.ts`
Expected: FAIL — interceptions currently add nothing to the rating, so `defRating` equals the clean-sheet-bonus-only baseline (~6.8), failing `toBeGreaterThan(6.8)`.

- [ ] **Step 3: Implement the weight table and apply it**

In `src/engine/matchRating.ts`, add after `TACKLE_WEIGHT` (line 21):

```ts
const INTERCEPTION_WEIGHT: Record<PositionGroup, number> = { FWD: 0.05, MID: 0.15, DEF: 0.2, GK: 0 };
```

In `computeMatchRating`, add one line next to the existing tackle weighting (line 52):

```ts
  rating += line.goals * GOAL_WEIGHT[group];
  rating += line.assists * ASSIST_WEIGHT[group];
  rating += line.shotsOnTarget * SOT_WEIGHT[group];
  rating += line.tackles * TACKLE_WEIGHT[group];
  rating += line.interceptions * INTERCEPTION_WEIGHT[group];
  if (group === "GK") rating += line.saves * 0.25;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/engine/matchRating.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/engine/matchRating.ts test/engine/matchRating.test.ts
git commit -m "Add INTERCEPTION_WEIGHT to match rating"
```

---

### Task 5: Migration backfill for old saves

**Files:**
- Modify: `src/db/migrate.ts:31-64` (types + `migrateLine`/`migratePlayer`)
- Test: `test/db/migrate.test.ts`

**Interfaces:**
- Consumes: `PlayerMatchLine.interceptions`/`SeasonStats.interceptions` from Tasks 2/3.

- [ ] **Step 1: Write the failing test**

Add to `test/db/migrate.test.ts`, inside `describe("migrateLeague", ...)`:

```ts
  it("backfills interceptions to 0 on pre-existing box-score lines and season stats", () => {
    const league = createLeagueState(0, mulberry32(5));
    const preInterceptions = {
      ...league,
      players: league.players.map((p) => ({
        ...p,
        stats: p.stats.map(({ interceptions: _i, ...s }) => s),
      })),
      played: league.played.map((m) => ({
        ...m,
        boxScore: {
          ...m.boxScore,
          home: m.boxScore.home.map(({ interceptions: _i, ...l }) => l),
          away: m.boxScore.away.map(({ interceptions: _i, ...l }) => l),
        },
      })),
    } as unknown as LeagueStore;

    const migrated = migrateLeague(preInterceptions);
    for (const p of migrated.players) {
      for (const s of p.stats) {
        expect(s.interceptions).toBe(0);
      }
    }
    for (const m of migrated.played) {
      for (const l of [...m.boxScore.home, ...m.boxScore.away]) {
        expect(l.interceptions).toBe(0);
      }
    }
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/db/migrate.test.ts`
Expected: FAIL — `s.interceptions`/`l.interceptions` are `undefined`, not `0`.

- [ ] **Step 3: Implement the backfill**

In `src/db/migrate.ts`, update the "any version" types (lines 31-37):

```ts
/** A season-stats entry as it may exist in a save written before Match Rating. */
type SeasonStatsAnyVersion = Omit<SeasonStats, "minutesPlayed" | "ratingSum" | "avgRating" | "interceptions"> &
  Partial<Pick<SeasonStats, "minutesPlayed" | "ratingSum" | "avgRating" | "interceptions">>;

/** A box-score line as it may exist in a save written before Match Rating. */
type PlayerMatchLineAnyVersion = Omit<PlayerMatchLine, "minutesPlayed" | "rating" | "interceptions"> &
  Partial<Pick<PlayerMatchLine, "minutesPlayed" | "rating" | "interceptions">>;
```

Update `migrateLine` (line 50-52):

```ts
function migrateLine(line: PlayerMatchLineAnyVersion): PlayerMatchLine {
  return { ...line, minutesPlayed: line.minutesPlayed ?? 0, rating: line.rating ?? 6.0, interceptions: line.interceptions ?? 0 };
}
```

Update `migratePlayer` (lines 54-64):

```ts
function migratePlayer(p: Player): Player {
  return {
    ...p,
    stats: (p.stats as SeasonStatsAnyVersion[]).map((s) => ({
      ...s,
      minutesPlayed: s.minutesPlayed ?? 0,
      ratingSum: s.ratingSum ?? 0,
      avgRating: s.avgRating ?? 0,
      interceptions: s.interceptions ?? 0,
    })),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/db/migrate.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/db/migrate.ts test/db/migrate.test.ts
git commit -m "Backfill interceptions to 0 for pre-existing saves"
```

---

### Task 6: UI — Box Score, Stat Leaders, Roster columns + Manual copy

**Files:**
- Modify: `src/ui/pages/BoxScore.tsx:45,67` (table header/cell)
- Modify: `src/ui/pages/Leaders.tsx:7-26,40-55,190-215` (`StatKey`, `STAT_OPTIONS`, `careerTotals`, table header/cell)
- Modify: `src/ui/pages/Roster.tsx` (season-stats table — locate the existing tackles `<td>` near line 134 and add an interceptions column beside it)
- Modify: `src/ui/pages/Manual.tsx:89`

No new tests — this repo has no component-level tests for these pages (confirmed: only `test/ui/ratingColor.test.ts` exists under `test/ui`, a pure-function util test, no page-rendering tests). Verify manually per Step 6 below.

- [ ] **Step 1: Box Score column**

In `src/ui/pages/BoxScore.tsx`, add a header cell after `<th className="text-end">Tkl</th>` (line 45):

```tsx
            <th className="text-end">Tkl</th>
            <th className="text-end">Int</th>
```

And a body cell after `<td className="text-end">{line.tackles || ""}</td>` (line 67):

```tsx
              <td className="text-end">{line.tackles || ""}</td>
              <td className="text-end">{line.interceptions || ""}</td>
```

- [ ] **Step 2: Stat Leaders column**

In `src/ui/pages/Leaders.tsx`, add `"interceptions"` to the `StatKey` union (lines 7-15):

```ts
type StatKey =
  | "goals"
  | "assists"
  | "shots"
  | "shotsOnTarget"
  | "saves"
  | "tackles"
  | "interceptions"
  | "avgRating"
  | "minutesPlayed";
```

Add it to `STAT_OPTIONS` (lines 17-26), right after `tackles`:

```ts
const STAT_OPTIONS: { key: StatKey; label: string }[] = [
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "shots", label: "Shots" },
  { key: "shotsOnTarget", label: "Shots on Target" },
  { key: "saves", label: "Saves" },
  { key: "tackles", label: "Tackles" },
  { key: "interceptions", label: "Interceptions" },
  { key: "avgRating", label: "Match Rating" },
  { key: "minutesPlayed", label: "Minutes" },
];
```

Add it to `careerTotals` (lines 40-55), right after `total.tackles += s.tackles;`:

```ts
    total.tackles += s.tackles;
    total.interceptions += s.interceptions;
```

Add a header cell after `<th className="text-end">Tkl</th>` (line 190):

```tsx
            <th className="text-end">Tkl</th>
            <th className="text-end">Int</th>
```

Add a body cell after `<td className="text-end">{row.stats.tackles}</td>` (line 214):

```tsx
              <td className="text-end">{row.stats.tackles}</td>
              <td className="text-end">{row.stats.interceptions}</td>
```

- [ ] **Step 3: Roster column**

In `src/ui/pages/Roster.tsx`, add a header cell after `<th className="text-end">Tkl</th>` (line 70):

```tsx
              <th className="text-end">Tkl</th>
              <th className="text-end">Int</th>
```

And a body cell after `<td className="text-end">{ss?.tackles ?? 0}</td>` (line 134):

```tsx
                  <td className="text-end">{ss?.tackles ?? 0}</td>
                  <td className="text-end">{ss?.interceptions ?? 0}</td>
```

- [ ] **Step 4: Manual.tsx copy**

In `src/ui/pages/Manual.tsx`, update the Stat Leaders bullet (line 89):

```tsx
            <li><strong>Stat Leaders</strong> — league-wide leaderboards: goals, assists, shots, tackles, interceptions, saves, clean sheets, minutes, and average match rating. A season dropdown lets you view a single past season, or "All Seasons" — which unlocks a second dropdown to rank either career totals or each player's single best season for the chosen stat.</li>
```

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS (TypeScript compiles the UI changes; no test exercises these pages directly, so this just confirms nothing else broke).

- [ ] **Step 6: Manual verification in the browser**

Per this repo's `verify` skill/convention: run `npm run dev`, open the app, play at least one matchday, then check:
- Box Score page shows a nonzero "Int" value for at least one defender.
- Stat Leaders page's stat dropdown includes "Interceptions" and sorts correctly when selected.
- Roster page's season-stats table shows an interceptions column.
- Manual page's Stat Leaders bullet mentions interceptions.
- No center-back sits at a 9+ match rating purely from tackle/interception volume in a scoreless game (spot-check a few played matches' box scores against their ratings).

- [ ] **Step 7: Commit**

```bash
git add src/ui/pages/BoxScore.tsx src/ui/pages/Leaders.tsx src/ui/pages/Roster.tsx src/ui/pages/Manual.tsx
git commit -m "Show interceptions in Box Score, Stat Leaders, Roster, and the Manual"
```

---

### Task 7: CLAUDE.md documentation update

**Files:**
- Modify: `/Users/calebmeyer/soccer-gm/CLAUDE.md` (the Match Rating paragraph containing "this engine's `tackles` field is a catch-all defensive-action count...")

**Interfaces:** None — documentation only.

- [ ] **Step 1: Replace the stale tuning note**

Find the paragraph (in the post-M6 section, right after the Match Rating paragraph): *"One tuning note for later: this engine's `tackles` field is a catch-all defensive-action count that can run into the high teens per match (unlike a real match's ~5-8 tackles), so at the given DEF weight (0.2/tackle) a scoreless center-back can rating-farm into the 9s. Worth revisiting the tackle weight if that shows up as a recurring pattern once more seasons are played."*

Replace it with a paragraph describing the shipped fix, e.g.:

```markdown
The `tackles` catch-all-volume issue flagged above was fixed post-M6: every
simulated turnover now rolls a three-way credit outcome (`TACKLE_CREDIT_PROB`/
`INTERCEPTION_CREDIT_PROB` in `src/engine/constants.ts`) instead of
unconditionally logging a tackle, splitting the old single stat into
`tackles` and a new `interceptions` (`PlayerMatchLine`/`SeasonStats`,
migrated to 0 for old saves). Interception credit is weighted by each
player's previously-unused `interceptions` skill rating via a new
`pickInterceptor` (`src/engine/attribution.ts`), rather than reusing
`tackling` for both stats. `matchRating.ts` gained a matching
`INTERCEPTION_WEIGHT` position matrix. Match flow/possession/scoring are
untouched — only what gets credited as a stat changed. Both new UI columns
(Box Score, Stat Leaders, Roster) and the Manual were updated to match.
Design doc: `docs/superpowers/specs/2026-07-14-tackle-interception-split-design.md`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Update CLAUDE.md: document the tackle/interception split fix"
```
