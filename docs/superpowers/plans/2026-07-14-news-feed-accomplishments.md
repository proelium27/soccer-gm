# News Feed: Player Accomplishments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hat-trick, standout-matchday-rating, and goal-milestone events to the News Feed page, interleaved chronologically with the existing transfer feed.

**Architecture:** A new append-only `LeagueStore.newsEvents` array (same pattern as `seasonHistory`) is populated by a pure detection module that runs inside `simThrough`'s existing per-matchday loop, using `PlayerMatchLine` data already computed there (no new simulation passes). The News Feed page merges `transfers` and `newsEvents` into one sorted timeline via a new pure, unit-tested helper module.

**Tech Stack:** TypeScript, React, Vitest.

## Global Constraints

- Design doc: `docs/superpowers/specs/2026-07-14-news-feed-accomplishments-design.md` — follow it exactly; this plan implements it task-by-task.
- Three event types only: hat-trick (`goals >= 3`), standout rating (single highest matchday rating, if `>= NEWS_STANDOUT_RATING_FLOOR`), goal milestones (season and career, independently, every multiple of `NEWS_GOAL_MILESTONE_STEP`).
- `NewsEvent.detail` is a single `number`, interpreted per `type` (goals scored / rating × 10 / milestone crossed).
- All new game-balance constants live in `src/core/constants.ts` (not `src/engine/constants.ts` — this is a league/UI feature, not match-engine physics, matching where `AWARD_MIN_APPEARANCES` etc. already live).
- `newsEvents` defaults to `[]` and is migrated the same way `seasonHistory`/`transfers` are in `src/db/migrate.ts`.
- Every `LeagueStore` object literal in the codebase (production and test fixtures) must include the new `newsEvents` field or TypeScript will fail to compile.
- Per `CLAUDE.md`'s Manual-sync rule, the in-game Manual (`src/ui/pages/Manual.tsx`) must describe the new feature since it's player-visible — done in the final task.

---

### Task 1: Schema — `NewsEvent` type, `LeagueStore.newsEvents`, migration, test fixtures

**Files:**
- Create: `src/core/newsEvents.ts` (type definitions only in this task; detection logic added in Task 3)
- Modify: `src/core/leagueState.ts`
- Modify: `src/db/migrate.ts`
- Modify: `test/core/simThrough.test.ts:53` (fixture)
- Modify: `test/core/injuries.test.ts:59` (fixture)
- Test: `test/db/migrate.test.ts`

**Interfaces:**
- Produces: `NewsEventType` (union of 4 string literals), `NewsEvent` interface — both exported from `src/core/newsEvents.ts`, imported by `leagueState.ts`, `migrate.ts`, and later tasks.
- Produces: `LeagueStore.newsEvents: NewsEvent[]`.

- [ ] **Step 1: Create the type module**

Create `src/core/newsEvents.ts`:

```ts
export type NewsEventType =
  | "hattrick"
  | "standoutRating"
  | "goalMilestoneSeason"
  | "goalMilestoneCareer";

/**
 * A player accomplishment surfaced on the News Feed, interleaved there with
 * transfers. Unlike per-match box scores (wiped every offseason), these are
 * detected once at match-sim time and persisted forever — see simThrough.ts.
 */
export interface NewsEvent {
  type: NewsEventType;
  pid: number;
  tid: number;
  season: number;
  matchday: number;
  /**
   * Interpreted per `type`: hattrick = goals scored this match;
   * standoutRating = rating × 10 (integer); goalMilestoneSeason /
   * goalMilestoneCareer = the milestone crossed (10, 20, 30...).
   */
  detail: number;
}
```

- [ ] **Step 2: Add `newsEvents` to `LeagueStore` and its default**

In `src/core/leagueState.ts`, add the import and field:

```ts
import type { NewsEvent } from "./newsEvents.js";
```

In the `LeagueStore` interface, after `seasonHistory`:

```ts
  /** Final league table for every completed season, oldest first. */
  seasonHistory: SeasonHistoryEntry[];
  /** Player accomplishments (hat-tricks, standout ratings, goal milestones), all seasons, oldest first. */
  newsEvents: NewsEvent[];
```

In `createLeagueState`'s returned object, after `seasonHistory: [],`:

```ts
    seasonHistory: [],
    newsEvents: [],
```

- [ ] **Step 3: Run the type checker to confirm the break**

Run: `npx tsc --noEmit`
Expected: FAIL — multiple errors like `Property 'newsEvents' is missing in type ...` at every existing `LeagueStore` object literal (production code in `src/core/simThrough.ts` and `src/core/offseason.ts` use `...league` spreads so they're unaffected; the failures are in the two test fixtures and `migrate.ts`).

- [ ] **Step 4: Fix the test fixtures**

In `test/core/simThrough.test.ts`, in `makeLeagueStore`, after `seasonHistory: [],` (line 53):

```ts
    seasonHistory: [],
    newsEvents: [],
```

In `test/core/injuries.test.ts`, at the equivalent fixture location (after `seasonHistory: [],`, line 59):

```ts
    seasonHistory: [],
    newsEvents: [],
```

- [ ] **Step 5: Add migration backfill**

In `src/db/migrate.ts`, add `"newsEvents"` to the `LeagueStoreAnyVersion` type (line 29-31):

```ts
/** A league as it may exist in a save written before M6 added the transfer market. */
type LeagueStoreAnyVersion =
  Omit<LeagueStore, "negotiations" | "inboundOffers" | "transfers" | "winterMarketRunSeason" | "seasonHistory" | "newsEvents"> &
  Partial<Pick<LeagueStore, "negotiations" | "inboundOffers" | "transfers" | "winterMarketRunSeason" | "seasonHistory" | "newsEvents">>;
```

In `migrateLeague`'s returned object, after `seasonHistory: (...)` (the whole seasonHistory block ending at line 159), add:

```ts
    newsEvents: anyVersion.newsEvents ?? [],
```

- [ ] **Step 6: Run the type checker again to confirm it's clean**

Run: `npx tsc --noEmit`
Expected: PASS, no errors.

- [ ] **Step 7: Write the migration test**

In `test/db/migrate.test.ts`, add a new test alongside the existing `"backfills the transfer-market lists from pre-phase-3 saves"` test (same file, same pattern — `createLeagueState` + destructure off the field being tested):

```ts
  it("backfills newsEvents to an empty array for saves written before this feature", () => {
    const league = createLeagueState(0, mulberry32(7));
    const { newsEvents: _ne, ...withoutNewsEvents } = league;
    const migrated = migrateLeague(withoutNewsEvents as unknown as LeagueStore);
    expect(migrated.newsEvents).toEqual([]);
  });

  it("leaves existing newsEvents untouched", () => {
    const league = createLeagueState(0, mulberry32(8));
    const withEvents: LeagueStore = {
      ...league,
      newsEvents: [{ type: "hattrick", pid: 1, tid: 0, season: 1, matchday: 3, detail: 3 }],
    };
    expect(migrateLeague(withEvents).newsEvents).toEqual(withEvents.newsEvents);
  });
```

- [ ] **Step 8: Run the migration test**

Run: `npx vitest run test/db/migrate.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/core/newsEvents.ts src/core/leagueState.ts src/db/migrate.ts test/core/simThrough.test.ts test/core/injuries.test.ts test/db/migrate.test.ts
git commit -m "Add NewsEvent type and LeagueStore.newsEvents field"
```

---

### Task 2: Constants

**Files:**
- Modify: `src/core/constants.ts`

**Interfaces:**
- Produces: `NEWS_STANDOUT_RATING_FLOOR: number`, `NEWS_GOAL_MILESTONE_STEP: number` — consumed by Task 3's detection module.

- [ ] **Step 1: Add the constants**

At the end of `src/core/constants.ts`, add:

```ts

/* ────────────────────────────────────────────────────────────────────────
 * News Feed accomplishments
 * ──────────────────────────────────────────────────────────────────────── */

/** Minimum single-match rating (see engine/matchRating.ts) to qualify as a matchday's "standout performance" news item. At most one per matchday, league-wide. */
export const NEWS_STANDOUT_RATING_FLOOR = 8.0;

/** Goal-milestone news items fire every time a player's season or career goal total crosses a multiple of this. */
export const NEWS_GOAL_MILESTONE_STEP = 10;
```

- [ ] **Step 2: Run the type checker**

Run: `npx tsc --noEmit`
Expected: PASS (this task only adds exports, nothing consumes them yet).

- [ ] **Step 3: Commit**

```bash
git add src/core/constants.ts
git commit -m "Add News Feed accomplishment tuning constants"
```

---

### Task 3: Detection module — pure functions + unit tests

**Files:**
- Modify: `src/core/newsEvents.ts` (adds detection logic to the file created in Task 1)
- Test: `test/core/newsEvents.test.ts`

**Interfaces:**
- Consumes: `NewsEvent`, `NewsEventType` (Task 1), `NEWS_STANDOUT_RATING_FLOOR`, `NEWS_GOAL_MILESTONE_STEP` (Task 2), `PlayedMatch` (from `src/core/standings.ts`), `PlayerMatchLine` (from `src/engine/attribution.ts`), `Player` (from `src/core/players/types.js`).
- Produces:
  - `playerGoalTotals(players: Player[], season: number): Map<number, { season: number; career: number }>`
  - `detectMatchdayNewsEvents(mdResults: PlayedMatch[], season: number, matchday: number, goalTotalsBefore: Map<number, { season: number; career: number }>, goalTotalsAfter: Map<number, { season: number; career: number }>): NewsEvent[]`
  - Both consumed by Task 4's `simThrough.ts` wiring.

- [ ] **Step 1: Write the failing tests**

Create `test/core/newsEvents.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { playerGoalTotals, detectMatchdayNewsEvents } from "../../src/core/newsEvents.js";
import type { Player } from "../../src/core/players/types.js";
import type { PlayedMatch } from "../../src/core/standings.js";
import type { PlayerMatchLine } from "../../src/engine/attribution.js";

function line(overrides: Partial<PlayerMatchLine> & { pid: number }): PlayerMatchLine {
  return {
    goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, xg: 0, goalsAgainst: 0,
    xga: 0, saves: 0, tackles: 0, interceptions: 0, yellowCards: 0, redCards: 0,
    minutesPlayed: 90, rating: 6.0,
    ...overrides,
  };
}

function match(overrides: Partial<PlayedMatch>): PlayedMatch {
  return {
    home: 0, away: 1, homeGoals: 0, awayGoals: 0, possessionHome: 50, matchday: 1,
    boxScore: { home: [], away: [], events: [] },
    ...overrides,
  };
}

function makePlayer(pid: number, statsBySeasonGoals: [season: number, goals: number][]): Player {
  return {
    pid,
    stats: statsBySeasonGoals.map(([season, goals]) => ({
      season, goals, appearances: 0, assists: 0, shots: 0, shotsOnTarget: 0, xg: 0,
      goalsAgainst: 0, xga: 0, saves: 0, tackles: 0, interceptions: 0,
      minutesPlayed: 0, ratingSum: 0, avgRating: 0,
    })),
  } as unknown as Player;
}

describe("playerGoalTotals", () => {
  it("sums career goals across all seasons and isolates the current season's goals", () => {
    const players = [makePlayer(1, [[2025, 8], [2026, 4]])];
    const totals = playerGoalTotals(players, 2026);
    expect(totals.get(1)).toEqual({ season: 4, career: 12 });
  });

  it("defaults a player with no stats entry for the season to 0 season goals", () => {
    const players = [makePlayer(1, [[2025, 8]])];
    const totals = playerGoalTotals(players, 2026);
    expect(totals.get(1)).toEqual({ season: 0, career: 8 });
  });
});

describe("detectMatchdayNewsEvents — hat-tricks", () => {
  it("fires for a 3-goal match", () => {
    const md = [match({ boxScore: { home: [line({ pid: 1, goals: 3 })], away: [], events: [] } })];
    const events = detectMatchdayNewsEvents(md, 2026, 5, new Map(), new Map());
    expect(events).toContainEqual({ type: "hattrick", pid: 1, tid: 0, season: 2026, matchday: 5, detail: 3 });
  });

  it("does not fire for a 2-goal match", () => {
    const md = [match({ boxScore: { home: [line({ pid: 1, goals: 2 })], away: [], events: [] } })];
    const events = detectMatchdayNewsEvents(md, 2026, 5, new Map(), new Map());
    expect(events.some((e) => e.type === "hattrick")).toBe(false);
  });
});

describe("detectMatchdayNewsEvents — standout rating", () => {
  it("fires for the single highest rating at or above the floor", () => {
    const md = [match({
      boxScore: {
        home: [line({ pid: 1, rating: 8.0 }), line({ pid: 2, rating: 7.9 })],
        away: [line({ pid: 3, rating: 9.4 })],
        events: [],
      },
    })];
    const events = detectMatchdayNewsEvents(md, 2026, 5, new Map(), new Map());
    const standouts = events.filter((e) => e.type === "standoutRating");
    expect(standouts).toEqual([{ type: "standoutRating", pid: 3, tid: 1, season: 2026, matchday: 5, detail: 94 }]);
  });

  it("does not fire when the matchday's best rating is below the floor", () => {
    const md = [match({ boxScore: { home: [line({ pid: 1, rating: 7.9 })], away: [], events: [] } })];
    const events = detectMatchdayNewsEvents(md, 2026, 5, new Map(), new Map());
    expect(events.some((e) => e.type === "standoutRating")).toBe(false);
  });
});

describe("detectMatchdayNewsEvents — goal milestones", () => {
  it("fires a career milestone on an exact crossing", () => {
    const md = [match({ boxScore: { home: [line({ pid: 1, goals: 2 })], away: [], events: [] } })];
    const before = new Map([[1, { season: 3, career: 8 }]]);
    const after = new Map([[1, { season: 5, career: 10 }]]);
    const events = detectMatchdayNewsEvents(md, 2026, 5, before, after);
    expect(events).toContainEqual({ type: "goalMilestoneCareer", pid: 1, tid: 0, season: 2026, matchday: 5, detail: 10 });
  });

  it("fires when a hat-trick jumps the total past a multiple of 10 without landing on it (8 -> 11)", () => {
    const md = [match({ boxScore: { home: [line({ pid: 1, goals: 3 })], away: [], events: [] } })];
    const before = new Map([[1, { season: 3, career: 8 }]]);
    const after = new Map([[1, { season: 6, career: 11 }]]);
    const events = detectMatchdayNewsEvents(md, 2026, 5, before, after);
    expect(events).toContainEqual({ type: "goalMilestoneCareer", pid: 1, tid: 0, season: 2026, matchday: 5, detail: 10 });
  });

  it("fires both season and career milestones independently in the same match", () => {
    const md = [match({ boxScore: { home: [line({ pid: 1, goals: 2 })], away: [], events: [] } })];
    const before = new Map([[1, { season: 8, career: 18 }]]);
    const after = new Map([[1, { season: 10, career: 20 }]]);
    const events = detectMatchdayNewsEvents(md, 2026, 5, before, after);
    expect(events).toContainEqual({ type: "goalMilestoneSeason", pid: 1, tid: 0, season: 2026, matchday: 5, detail: 10 });
    expect(events).toContainEqual({ type: "goalMilestoneCareer", pid: 1, tid: 0, season: 2026, matchday: 5, detail: 20 });
  });

  it("does not fire when no multiple of 10 is crossed", () => {
    const md = [match({ boxScore: { home: [line({ pid: 1, goals: 1 })], away: [], events: [] } })];
    const before = new Map([[1, { season: 4, career: 14 }]]);
    const after = new Map([[1, { season: 5, career: 15 }]]);
    const events = detectMatchdayNewsEvents(md, 2026, 5, before, after);
    expect(events.some((e) => e.type.startsWith("goalMilestone"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/core/newsEvents.test.ts`
Expected: FAIL with `playerGoalTotals is not a function` / `detectMatchdayNewsEvents is not a function` (neither exists yet).

- [ ] **Step 3: Implement the detection logic**

Add to `src/core/newsEvents.ts` (below the existing type definitions):

```ts
import type { Player } from "./players/types.js";
import type { PlayedMatch } from "./standings.js";
import { NEWS_STANDOUT_RATING_FLOOR, NEWS_GOAL_MILESTONE_STEP } from "./constants.js";

/** Each player's season-to-date and all-time (career) goal totals, as of a point in time. */
export function playerGoalTotals(
  players: Player[],
  season: number,
): Map<number, { season: number; career: number }> {
  const map = new Map<number, { season: number; career: number }>();
  for (const p of players) {
    const career = p.stats.reduce((sum, s) => sum + s.goals, 0);
    const seasonGoals = p.stats.find((s) => s.season === season)?.goals ?? 0;
    map.set(p.pid, { season: seasonGoals, career });
  }
  return map;
}

interface AttributedLine {
  pid: number;
  tid: number;
  goals: number;
  rating: number;
}

function attributedLines(mdResults: PlayedMatch[]): AttributedLine[] {
  const out: AttributedLine[] = [];
  for (const m of mdResults) {
    for (const line of m.boxScore.home) {
      out.push({ pid: line.pid, tid: m.home, goals: line.goals, rating: line.rating });
    }
    for (const line of m.boxScore.away) {
      out.push({ pid: line.pid, tid: m.away, goals: line.goals, rating: line.rating });
    }
  }
  return out;
}

/**
 * Detects hat-tricks, the matchday's standout rating, and goal-milestone
 * crossings from one matchday's completed matches. Pure — the caller
 * (simThrough.ts) supplies goal totals captured immediately before and after
 * this matchday's stats were folded into SeasonStats.
 */
export function detectMatchdayNewsEvents(
  mdResults: PlayedMatch[],
  season: number,
  matchday: number,
  goalTotalsBefore: Map<number, { season: number; career: number }>,
  goalTotalsAfter: Map<number, { season: number; career: number }>,
): NewsEvent[] {
  const lines = attributedLines(mdResults);
  const events: NewsEvent[] = [];

  for (const line of lines) {
    if (line.goals >= 3) {
      events.push({ type: "hattrick", pid: line.pid, tid: line.tid, season, matchday, detail: line.goals });
    }
  }

  let best: AttributedLine | null = null;
  for (const line of lines) {
    if (best === null || line.rating > best.rating) best = line;
  }
  if (best !== null && best.rating >= NEWS_STANDOUT_RATING_FLOOR) {
    events.push({
      type: "standoutRating", pid: best.pid, tid: best.tid, season, matchday,
      detail: Math.round(best.rating * 10),
    });
  }

  for (const line of lines) {
    if (line.goals <= 0) continue;
    const before = goalTotalsBefore.get(line.pid);
    const after = goalTotalsAfter.get(line.pid);
    if (!before || !after) continue;

    const seasonMilestone = Math.floor(after.season / NEWS_GOAL_MILESTONE_STEP);
    if (Math.floor(before.season / NEWS_GOAL_MILESTONE_STEP) < seasonMilestone) {
      events.push({
        type: "goalMilestoneSeason", pid: line.pid, tid: line.tid, season, matchday,
        detail: seasonMilestone * NEWS_GOAL_MILESTONE_STEP,
      });
    }

    const careerMilestone = Math.floor(after.career / NEWS_GOAL_MILESTONE_STEP);
    if (Math.floor(before.career / NEWS_GOAL_MILESTONE_STEP) < careerMilestone) {
      events.push({
        type: "goalMilestoneCareer", pid: line.pid, tid: line.tid, season, matchday,
        detail: careerMilestone * NEWS_GOAL_MILESTONE_STEP,
      });
    }
  }

  return events;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/core/newsEvents.test.ts`
Expected: PASS, all 9 tests green.

- [ ] **Step 5: Run the type checker**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/newsEvents.ts test/core/newsEvents.test.ts
git commit -m "Add pure detection logic for News Feed accomplishments"
```

---

### Task 4: Wire detection into `simThrough`

**Files:**
- Modify: `src/core/simThrough.ts`
- Test: `test/core/simThrough.test.ts`

**Interfaces:**
- Consumes: `playerGoalTotals`, `detectMatchdayNewsEvents` (Task 3), `NewsEvent` (Task 1).
- Produces: `simThrough(...)` return value now includes accumulated `newsEvents`, consumed by the UI in Task 6.

- [ ] **Step 1: Write the failing integration tests**

Add to `test/core/simThrough.test.ts`, inside the existing `describe("simThrough", ...)` block:

```ts
  it("newsEvents: starts empty and only grows as matchdays are played, never shrinks", () => {
    const store = makeLeagueStore(42);
    expect(store.newsEvents).toEqual([]);

    const rng = mulberry32(800);
    const afterOneMonth = simThrough(store, "month", rng);
    expect(Array.isArray(afterOneMonth.newsEvents)).toBe(true);
    expect(afterOneMonth.newsEvents.length).toBeGreaterThanOrEqual(store.newsEvents.length);

    const rng2 = mulberry32(801);
    const afterFullSeason = simThrough(afterOneMonth, "season", rng2);
    expect(afterFullSeason.newsEvents.length).toBeGreaterThanOrEqual(afterOneMonth.newsEvents.length);
  });

  it("newsEvents: every event carries the matchday it happened on and the store's season", () => {
    const store = makeLeagueStore(42);
    const rng = mulberry32(900);
    const result = simThrough(store, "season", rng);

    for (const e of result.newsEvents) {
      expect(e.season).toBe(store.season);
      expect(e.matchday).toBeGreaterThanOrEqual(1);
      expect(e.matchday).toBeLessThanOrEqual(38);
      expect(["hattrick", "standoutRating", "goalMilestoneSeason", "goalMilestoneCareer"]).toContain(e.type);
    }
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/core/simThrough.test.ts -t newsEvents`
Expected: FAIL — `store.newsEvents` and `result.newsEvents` are `undefined`, so `.length`/iteration throw.

(Note: if Task 1 already added `newsEvents: []` to the fixture, `store.newsEvents` will exist but be `[]`; the failure will instead be that `result.newsEvents` is `undefined` since `simThrough` doesn't return it yet. Either way, this step must fail before Step 3.)

- [ ] **Step 3: Wire detection into the matchday loop**

In `src/core/simThrough.ts`, add the import:

```ts
import { playerGoalTotals, detectMatchdayNewsEvents } from "./newsEvents.js";
import type { NewsEvent } from "./newsEvents.js";
```

Add a `newEvents` accumulator next to the other threaded-through-the-loop variables (near `let currentTeams`, `let transfers`, `let winterMarketRunSeason`, around line 116-118):

```ts
  const newEvents: NewsEvent[] = [];
```

Inside the `matchdays.forEach((matchday, index) => { ... })` loop, capture goal totals immediately *before* `gamesThisMatchday.map(...)` runs (which is where `accumulateStats` mutates `currentPlayers`) — insert right before the `const gamesThisMatchday = ...` line (currently line 168):

```ts
    const goalTotalsBefore = playerGoalTotals(currentPlayers, league.season);

    const gamesThisMatchday = toSim.filter((g) => g.matchday === matchday);
    const mdResults = gamesThisMatchday.map((game): PlayedMatch => {
```

Then, after the `.map(...)` call finishes (i.e. right after the existing line `currentPlayers = applyInjuries(rng, currentPlayers, mdResults);`, currently line 204), detect and accumulate this matchday's events:

```ts
    currentPlayers = applyInjuries(rng, currentPlayers, mdResults);

    const goalTotalsAfter = playerGoalTotals(currentPlayers, league.season);
    newEvents.push(
      ...detectMatchdayNewsEvents(mdResults, league.season, matchday, goalTotalsBefore, goalTotalsAfter),
    );

    newResults.push(...mdResults);
```

Finally, add `newsEvents` to the function's return object (after the existing `winterMarketRunSeason,` line):

```ts
    transfers,
    winterMarketRunSeason,
    newsEvents: [...league.newsEvents, ...newEvents],
  };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/core/simThrough.test.ts`
Expected: PASS, all tests including the two new ones green.

- [ ] **Step 5: Run the full test suite and type checker**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS — this confirms nothing else in the codebase constructs a `LeagueStore` without `newsEvents` and that no other test broke.

- [ ] **Step 6: Commit**

```bash
git add src/core/simThrough.ts test/core/simThrough.test.ts
git commit -m "Detect and persist News Feed accomplishments during matchday sim"
```

---

### Task 5: Timeline merge helper — pure function + unit tests

**Files:**
- Create: `src/ui/newsFeedTimeline.ts`
- Test: `test/ui/newsFeedTimeline.test.ts`

**Interfaces:**
- Consumes: `NewsEvent` (Task 1), `CompletedTransfer` (from `src/core/transfers/negotiation.js`), `WINTER_WINDOW_OPEN_MATCHDAY` (from `src/core/calendar.js`).
- Produces: `FeedItem` union type and `buildSeasonTimeline(transfers: CompletedTransfer[], newsEvents: NewsEvent[]): FeedItem[]` — consumed by Task 6's `NewsFeed.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `test/ui/newsFeedTimeline.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildSeasonTimeline } from "../../src/ui/newsFeedTimeline.js";
import type { CompletedTransfer } from "../../src/core/transfers/negotiation.js";
import type { NewsEvent } from "../../src/core/newsEvents.js";

describe("buildSeasonTimeline", () => {
  it("orders summer transfers before in-season accomplishments before winter transfers", () => {
    const transfers: CompletedTransfer[] = [
      { pid: 1, fromTid: 0, toTid: 1, fee: 1000, season: 2026, window: "winter" },
      { pid: 2, fromTid: 1, toTid: 0, fee: 2000, season: 2026, window: "summer" },
    ];
    const newsEvents: NewsEvent[] = [
      { type: "hattrick", pid: 3, tid: 0, season: 2026, matchday: 10, detail: 3 },
    ];

    const timeline = buildSeasonTimeline(transfers, newsEvents);

    expect(timeline.map((item) => item.kind)).toEqual(["transfer", "news", "transfer"]);
    expect(timeline[0].kind === "transfer" && timeline[0].data.window).toBe("summer");
    expect(timeline[2].kind === "transfer" && timeline[2].data.window).toBe("winter");
  });

  it("orders multiple accomplishments by matchday", () => {
    const newsEvents: NewsEvent[] = [
      { type: "hattrick", pid: 1, tid: 0, season: 2026, matchday: 20, detail: 3 },
      { type: "standoutRating", pid: 2, tid: 1, season: 2026, matchday: 5, detail: 91 },
    ];

    const timeline = buildSeasonTimeline([], newsEvents);

    expect(timeline.map((item) => item.kind === "news" && item.data.matchday)).toEqual([5, 20]);
  });

  it("returns an empty array for a season with no transfers or events", () => {
    expect(buildSeasonTimeline([], [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/ui/newsFeedTimeline.test.ts`
Expected: FAIL — the module doesn't exist (`Cannot find module '../../src/ui/newsFeedTimeline.js'`).

- [ ] **Step 3: Implement the helper**

Create `src/ui/newsFeedTimeline.ts`:

```ts
import type { CompletedTransfer } from "../core/transfers/negotiation.js";
import type { NewsEvent } from "../core/newsEvents.js";
import { WINTER_WINDOW_OPEN_MATCHDAY } from "../core/calendar.js";

export type FeedItem =
  | { kind: "transfer"; order: number; data: CompletedTransfer }
  | { kind: "news"; order: number; data: NewsEvent };

/**
 * Merges one season's transfers and accomplishments into a single
 * chronological timeline. Transfers have no matchday of their own, so they're
 * placed at an approximate point in the calendar by window: summer business
 * before matchday 1, winter business around the window's opening matchday.
 * Ties (same order key) keep transfers before accomplishments.
 */
export function buildSeasonTimeline(
  transfers: CompletedTransfer[],
  newsEvents: NewsEvent[],
): FeedItem[] {
  const items: FeedItem[] = [
    ...transfers.map((t): FeedItem => ({
      kind: "transfer",
      order: t.window === "summer" ? 0 : WINTER_WINDOW_OPEN_MATCHDAY,
      data: t,
    })),
    ...newsEvents.map((e): FeedItem => ({ kind: "news", order: e.matchday, data: e })),
  ];

  return items.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    if (a.kind !== b.kind) return a.kind === "transfer" ? -1 : 1;
    return 0;
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/ui/newsFeedTimeline.test.ts`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Run the type checker**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/newsFeedTimeline.ts test/ui/newsFeedTimeline.test.ts
git commit -m "Add pure timeline-merge helper for News Feed"
```

---

### Task 6: UI — render the merged timeline on the News Feed page

**Files:**
- Modify: `src/ui/pages/NewsFeed.tsx`

**Interfaces:**
- Consumes: `buildSeasonTimeline`, `FeedItem` (Task 5); `NewsEvent`, `NewsEventType` (Task 1).
- No new interfaces produced — this is the final consumer.

- [ ] **Step 1: Replace the transfer-only grouping with the merged timeline**

Rewrite `src/ui/pages/NewsFeed.tsx` in full:

```tsx
import { useMemo, useState } from "react";
import { useLeague } from "../context/LeagueContext.js";
import type { StoredTeam } from "../../core/leagueState.js";
import type { NewsEvent, NewsEventType } from "../../core/newsEvents.js";
import { buildSeasonTimeline, type FeedItem } from "../newsFeedTimeline.js";
import { currency, seasonYear } from "../format.js";
import { Flag } from "../components/Flag.js";

type ClubFilter = "all" | "user";

const EVENT_LABEL: Record<NewsEventType, string> = {
  hattrick: "⚽ Hat-trick",
  standoutRating: "⭐ Standout performance",
  goalMilestoneSeason: "🎯 Season milestone",
  goalMilestoneCareer: "🎯 Career milestone",
};

function eventDetail(e: NewsEvent): string {
  switch (e.type) {
    case "hattrick":
      return `${e.detail} goals`;
    case "standoutRating":
      return `${(e.detail / 10).toFixed(1)} rating`;
    case "goalMilestoneSeason":
      return `${e.detail} goals this season`;
    case "goalMilestoneCareer":
      return `${e.detail} career goals`;
  }
}

export function NewsFeed() {
  const { league } = useLeague();
  const [clubFilter, setClubFilter] = useState<ClubFilter>("all");
  const [seasonFilter, setSeasonFilter] = useState<"all" | number>("all");

  const playerMap = useMemo(
    () => new Map((league?.players ?? []).map((p) => [p.pid, p])),
    [league?.players],
  );
  const teamMap = useMemo(
    () => new Map((league?.teams ?? []).map((t) => [t.tid, t])),
    [league?.teams],
  );

  if (!league) {
    return <p className="p-3">Loading...</p>;
  }

  const userTid = league.meta.userTid;
  const userTeam = teamMap.get(userTid);

  const involvesUser = (item: FeedItem): boolean =>
    item.kind === "transfer"
      ? item.data.fromTid === userTid || item.data.toTid === userTid
      : item.data.tid === userTid;

  const passesFilters = (season: number, item: FeedItem): boolean => {
    if (clubFilter === "user" && !involvesUser(item)) return false;
    if (seasonFilter !== "all" && season !== seasonFilter) return false;
    return true;
  };

  // Seasons present across either feed, newest first, for the dropdown.
  const seasons = [
    ...new Set([
      ...league.transfers.map((t) => t.season),
      ...league.newsEvents.map((e) => e.season),
    ]),
  ].sort((a, b) => b - a);

  const seasonsToShow = seasonFilter === "all" ? seasons : seasons.filter((s) => s === seasonFilter);

  const teamCell = (tid: number) => {
    const team: StoredTeam | undefined = teamMap.get(tid);
    return (
      <span className="d-inline-flex align-items-center gap-1">
        <span className="color-swatch" style={{ backgroundColor: team?.colors[0] }} />
        {team?.name ?? `Team ${tid}`}
      </span>
    );
  };

  const playerCell = (pid: number) => {
    const p = playerMap.get(pid);
    return (
      <>
        {p?.name ?? `Player ${pid}`}{" "}
        {p && <Flag nationality={p.nationality} />}
        {p && <span className="text-muted small"> ({p.pos})</span>}
      </>
    );
  };

  const totalItems = seasonsToShow.reduce((sum, season) => {
    const transfers = league.transfers.filter((t) => t.season === season);
    const events = league.newsEvents.filter((e) => e.season === season);
    return sum + buildSeasonTimeline(transfers, events).filter((item) => passesFilters(season, item)).length;
  }, 0);

  return (
    <div className="container-fluid p-3">
      <h4>News Feed</h4>
      <p className="text-muted">
        Every completed transfer across the league — including deals between rival clubs — plus
        player accomplishments like hat-tricks, standout performances, and goal milestones,
        newest first.
      </p>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <select
          className="form-select w-auto"
          value={clubFilter}
          onChange={(e) => setClubFilter(e.target.value as ClubFilter)}
        >
          <option value="all">All clubs</option>
          <option value="user">Only {userTeam?.name ?? "my club"}</option>
        </select>
        <select
          className="form-select w-auto"
          value={String(seasonFilter)}
          onChange={(e) =>
            setSeasonFilter(e.target.value === "all" ? "all" : Number(e.target.value))
          }
        >
          <option value="all">All seasons</option>
          {seasons.map((s) => (
            <option key={s} value={s}>{seasonYear(s)}</option>
          ))}
        </select>
      </div>

      {totalItems === 0 ? (
        <p className="text-muted">
          {league.transfers.length === 0 && league.newsEvents.length === 0
            ? "Nothing has happened in the league yet."
            : "Nothing matches the current filters."}
        </p>
      ) : (
        [...seasonsToShow].sort((a, b) => b - a).map((season) => {
          const transfers = league.transfers.filter((t) => t.season === season);
          const events = league.newsEvents.filter((e) => e.season === season);
          const timeline = buildSeasonTimeline(transfers, events).filter((item) =>
            passesFilters(season, item),
          );
          if (timeline.length === 0) return null;

          return (
            <div className="card mb-3" key={season}>
              <div className="card-body">
                <h5 className="card-title">
                  {seasonYear(season)}{" "}
                  <span className="text-muted small">
                    ({timeline.length} {timeline.length === 1 ? "item" : "items"})
                  </span>
                </h5>
                <div className="table-responsive">
                  <table className="table table-striped table-sm mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Player</th>
                        <th>Club(s)</th>
                        <th className="text-end">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeline.map((item, i) => {
                        const highlighted = involvesUser(item);
                        if (item.kind === "transfer") {
                          const t = item.data;
                          return (
                            <tr key={`t-${t.pid}-${t.season}-${t.window}-${i}`}
                                className={highlighted ? "team-highlight" : undefined}>
                              <td className="text-muted small text-capitalize">{t.window} window transfer</td>
                              <td>{playerCell(t.pid)}</td>
                              <td>
                                <span className="d-inline-flex align-items-center gap-1">
                                  {teamCell(t.fromTid)} <span className="text-muted">→</span> {teamCell(t.toTid)}
                                </span>
                              </td>
                              <td className="text-end stat-num">{currency.format(t.fee)}</td>
                            </tr>
                          );
                        }
                        const e = item.data;
                        return (
                          <tr key={`n-${e.pid}-${e.season}-${e.matchday}-${e.type}-${i}`}
                              className={highlighted ? "team-highlight" : undefined}>
                            <td className="small">{EVENT_LABEL[e.type]} (MD {e.matchday})</td>
                            <td>{playerCell(e.pid)}</td>
                            <td>{teamCell(e.tid)}</td>
                            <td className="text-end stat-num">{eventDetail(e)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run the full test suite and type checker**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Manually verify in the browser**

Use the `verify` skill's launch instructions (`npm run dev -- --port 5199 --strictPort`, drive via browser tools). Steps:
1. Go to `/leagues` → Start New League → pick a club → Start League.
2. Go to `/news`. Confirm the empty state reads "Nothing has happened in the league yet."
3. From `/dashboard`, Sim to end of season.
4. Return to `/news`. Confirm the season card shows an interleaved list — some rows should be `winter window transfer` (from the AI↔AI winter market) and, given a full 380-match season, at least a few `⭐ Standout performance` rows (one candidate per matchday that clears the 8.0 floor) should appear. Confirm the "Detail" column renders sensibly for each event type you see (goals / rating / milestone count).
5. Toggle "Only \<my club\>" and confirm rows for other clubs disappear.
6. When done, go to `/leagues` and Enter the original league (if any existed before this test) to restore the active-league pointer — do not click Delete.

Record what you actually observed (which event types appeared) — if hat-tricks or milestones never appeared in this one season, note it as expected variance (both are comparatively rare over one season) rather than a bug, as long as the standout-rating rows and transfer rows render correctly.

- [ ] **Step 4: Commit**

```bash
git add src/ui/pages/NewsFeed.tsx
git commit -m "Merge player accomplishments into the News Feed timeline"
```

---

### Task 7: Docs — Manual and CLAUDE.md

**Files:**
- Modify: `src/ui/pages/Manual.tsx:91`
- Modify: `CLAUDE.md`

**Interfaces:**
- None — documentation only.

- [ ] **Step 1: Update the Manual's News Feed page description**

In `src/ui/pages/Manual.tsx`, replace line 91:

```tsx
            <li><strong>News Feed</strong> — every completed transfer in the league (AI-to-AI deals included), newest first, grouped by season, with club and season filters. Your club's deals are highlighted.</li>
```

with:

```tsx
            <li><strong>News Feed</strong> — every completed transfer in the league (AI-to-AI deals included) plus player accomplishments — hat-tricks, a standout performance each matchday, and goal milestones every 10 (season and career) — interleaved into one timeline per season, with club and season filters. Your club's items are highlighted.</li>
```

- [ ] **Step 2: Run the type checker**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Update CLAUDE.md**

Add a new paragraph to `CLAUDE.md` immediately after the existing "## Roster page: visual pitch field for the Starting XI" section's content and before "## End-of-season awards" (or, if the awards section now sits elsewhere, immediately after whichever section is most recently appended — check with `tail -40 CLAUDE.md` before editing so this lands after the current last section rather than creating a merge conflict with concurrent work from the other Claude account):

```markdown
## News Feed: player accomplishments

The News Feed page's transfer-only list gained player accomplishments, per the user's "Prompts" Google Doc ("News feed" — "player accomplishments should be there too... when a player scores a hattrick"). Since per-match box scores (`league.played`) are wiped every offseason, accomplishments can't be derived retroactively — they're detected at match-sim time and written to a new persisted, append-only `LeagueStore.newsEvents` array (same pattern as `seasonHistory`; migrated to `[]` for old saves), inside `simThrough`'s existing per-matchday loop via a new pure `src/core/newsEvents.ts` (`detectMatchdayNewsEvents`), reusing `PlayerMatchLine` data already computed there — no new simulation passes.

Three event types: a **hat-trick** (3+ goals in a match), the matchday's single **standout rating** (highest `computeMatchRating()` league-wide, if it clears `NEWS_STANDOUT_RATING_FLOOR` = 8.0), and **goal milestones** — season and career tracked independently, firing every `NEWS_GOAL_MILESTONE_STEP` = 10 goals via a floor-comparison crossing check (so a hat-trick jumping a total from 8 to 11 still correctly fires the "10" milestone once). Both new constants live in `src/core/constants.ts`.

The News Feed page (`src/ui/pages/NewsFeed.tsx`) merges `transfers` and `newsEvents` into one chronological timeline per season via a new pure `src/ui/newsFeedTimeline.ts` (`buildSeasonTimeline`), since neither event type shares a native clock: transfers are placed by window (`summer` → before matchday 1, `winter` → `WINTER_WINDOW_OPEN_MATCHDAY`), accomplishments by their real matchday. The existing club/season filters and the user's-club row highlight extend to accomplishments (checked against the event's single `tid` rather than a transfer's `fromTid`/`toTid`).
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/pages/Manual.tsx CLAUDE.md
git commit -m "Document News Feed accomplishments in the Manual and CLAUDE.md"
```

---

## Final verification

- [ ] Run `npx vitest run && npx tsc --noEmit` one more time from a clean working tree to confirm the whole branch is green.
- [ ] Confirm all 7 tasks' commits are present via `git log --oneline` on this branch.
