# AI GM phase 4: contract renewals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI clubs proactively renew a rostered player's contract the season before it expires, using the existing `valueToClub` evaluation core to decide keep-vs-let-go, instead of always losing him to the open free-agent pool at expiry with zero priority to re-sign.

**Architecture:** One new pure function, `runAIContractRenewals` (`src/core/ai/renewals.ts`), that reuses `deriveLeagueContexts`/`valueToClub` (phase 1) and the existing `canExtend`/`contractTerms`/`extendContract` contract helpers. It runs as a new step 0 in `simOffseason`, before contracts expire, so renewed players never touch the free-agent pool.

**Tech Stack:** TypeScript, Vitest (`npm test` / `vitest run`), `tsx` for one-off scripts.

## Global Constraints

- No `rng` parameter anywhere in the new code — the decision must stay deterministic (spec: "Deterministic — no `rng` parameter, no RNG-stream consumption").
- The user's team (`userTid`) is never touched by this function.
- No new budget/affordability gate beyond what `valueToClub` already bakes in (spec: "Scope boundaries").
- No renewal negotiation/counter-offers — one-button terms only, matching `contractTerms`'s existing "contracts are never negotiated" design.
- Reuse existing helpers verbatim: `canExtend`, `contractTerms`, `extendContract` (`src/core/contracts.ts`), `deriveLeagueContexts`, `valueToClub` (`src/core/ai/clubContext.ts`, `src/core/ai/evaluate.ts`). Do not duplicate their logic.
- Spec doc: `docs/superpowers/specs/2026-07-12-ai-gm-phase4-contract-renewals-design.md`.

---

## Task 1: Add the `AI_RENEWAL_MARGIN` constant

**Files:**
- Modify: `src/core/constants.ts` (insert after line 480, the end of the "AI↔AI transfer market" section, before the "AI GM phase 3" section that currently starts at line 482)

**Interfaces:**
- Produces: `AI_RENEWAL_MARGIN: number`, importable from `../constants.js`.

- [ ] **Step 1: Insert the new constant section**

Insert this block into `src/core/constants.ts` immediately after the line `export const AI_MARKET_RESERVE_FRACTION_MAX = 0.5;` and before the `/* ──── AI GM phase 3 ──── */` comment block:

```ts

/* ────────────────────────────────────────────────────────────────────────
 * AI GM phase 4: proactive contract renewals. Reuses valueToClub as-is — the
 * only new tuning knob is the margin below, a "is he still worth the money"
 * bar applied the season before a player's contract would otherwise expire.
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * An AI club renews a player entering his contract's final season only if
 * valueToClub(player, ctx) clears his new-terms wage by at least this
 * multiple. >1 requires a real margin, not just break-even — valueToClub
 * already discounts for a club's affordability, so this is a second,
 * smaller safety margin on top, not a duplicate budget check.
 */
export const AI_RENEWAL_MARGIN = 1.1;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors (this step only adds an unused-so-far exported constant, which TypeScript does not flag).

- [ ] **Step 3: Commit**

```bash
git add src/core/constants.ts
git commit -m "Add AI_RENEWAL_MARGIN constant for AI GM phase 4"
```

---

## Task 2: `runAIContractRenewals` core function + unit tests

**Files:**
- Create: `src/core/ai/renewals.ts`
- Test: `test/core/ai/renewals.test.ts`

**Interfaces:**
- Consumes:
  - `deriveLeagueContexts(snapshot: LeagueSnapshot): Map<number, ClubContext>` — `src/core/ai/clubContext.ts` (`LeagueSnapshot = { teams: StoredTeam[]; players: Player[]; season: number; played: PlayedMatch[] }`)
  - `valueToClub(player: Player, ctx: ClubContext): number` — `src/core/ai/evaluate.ts`
  - `canExtend(player: Player, season: number): boolean`, `contractTerms(player: Player, season: number): { salary: number; lengthSeasons: number; expiresSeason: number }`, `extendContract(players: Player[], pid: number, season: number): Player[]` — `src/core/contracts.ts`
  - `AI_RENEWAL_MARGIN: number` — `src/core/constants.ts`
  - `StoredTeam` — `src/core/teams/clubs.ts`; `Player` — `src/core/players/types.ts`; `PlayedMatch` — `src/core/standings.ts`
- Produces: `runAIContractRenewals(teams: StoredTeam[], players: Player[], nextSeason: number, userTid: number, playedThisSeason: PlayedMatch[]): { teams: StoredTeam[]; players: Player[] }` — used by Task 3.

- [ ] **Step 1: Write the failing tests**

Create `test/core/ai/renewals.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../../src/engine/rng.js";
import { createLeagueState } from "../../../src/core/leagueState.js";
import { runAIContractRenewals } from "../../../src/core/ai/renewals.js";
import { canExtend } from "../../../src/core/contracts.js";
import { ROSTER_COMPOSITION } from "../../../src/core/constants.js";
import type { StoredTeam } from "../../../src/core/teams/clubs.js";
import type { Player } from "../../../src/core/players/types.js";

const USER_TID = 0;

describe("runAIContractRenewals", () => {
  it("renews a clear keeper: a big upgrade at a thin position, in his prime, on a rich club", () => {
    const league = createLeagueState(USER_TID, mulberry32(21));
    const nextSeason = league.season + 1;
    const tid = 1;
    const team = league.teams.find((t) => t.tid === tid)!;

    // Target: the team's own best CM, aged into his prime, with one season
    // left on his deal.
    const target = league.players
      .filter((p) => p.pos === "CM" && team.roster.includes(p.pid))
      .sort((a, b) => b.ovr - a.ovr)[0];
    const players = league.players.map((p) =>
      p.pid === target.pid
        ? { ...p, born: nextSeason - 26, ovr: 90, contract: { ...p.contract, expiresSeason: nextSeason } }
        : p,
    );
    // Strip every other CM from the roster so he reads as an unreplaceable
    // upgrade (posBestOvr for CM drops to 0 without him) on a wealthy club.
    const teams: StoredTeam[] = league.teams.map((t) => {
      if (t.tid !== tid) return t;
      const otherCms = new Set(
        players.filter((p) => p.pos === "CM" && p.pid !== target.pid && t.roster.includes(p.pid)).map((p) => p.pid),
      );
      return { ...t, budget: 300_000_000, roster: t.roster.filter((pid) => !otherCms.has(pid)) };
    });

    const result = runAIContractRenewals(teams, players, nextSeason, USER_TID, league.played);
    const renewed = result.players.find((p) => p.pid === target.pid)!;
    expect(renewed.contract.expiresSeason).toBeGreaterThan(nextSeason);
  });

  it("does not renew a clearly expendable player: heavy surplus, old, low ovr, poor club", () => {
    const league = createLeagueState(USER_TID, mulberry32(22));
    const nextSeason = league.season + 1;
    const tid = 2;
    const team = league.teams.find((t) => t.tid === tid)!;

    const target = league.players.find((p) => p.pos === "FB" && team.roster.includes(p.pid))!;
    let players = league.players.map((p) =>
      p.pid === target.pid
        ? { ...p, born: nextSeason - 35, ovr: 45, contract: { ...p.contract, expiresSeason: nextSeason } }
        : p,
    );
    // Pad the roster with a wall of superior FBs so he's pure surplus, and
    // make the club as cash-poor as possible.
    const filler: Player[] = Array.from({ length: 10 }, (_, i) => ({
      ...players.find((p) => p.pos === "FB")!,
      pid: 900_000 + i,
      ovr: 70,
      born: nextSeason - 24,
      contract: { salary: 1, expiresSeason: nextSeason + 5 },
    }));
    players = [...players, ...filler];
    const teams: StoredTeam[] = league.teams.map((t) =>
      t.tid === tid
        ? { ...t, budget: 0, roster: [...t.roster, ...filler.map((p) => p.pid)] }
        : t,
    );

    const result = runAIContractRenewals(teams, players, nextSeason, USER_TID, league.played);
    const untouched = result.players.find((p) => p.pid === target.pid)!;
    expect(untouched.contract.expiresSeason).toBe(nextSeason);
  });

  it("leaves a player with more than one season left on his deal untouched", () => {
    const league = createLeagueState(USER_TID, mulberry32(23));
    const nextSeason = league.season + 1;
    const tid = 1;
    const target = league.players.find((p) =>
      league.teams.find((t) => t.tid === tid)!.roster.includes(p.pid),
    )!;
    const players = league.players.map((p) =>
      p.pid === target.pid
        ? { ...p, contract: { ...p.contract, expiresSeason: nextSeason + 3 } }
        : p,
    );
    expect(canExtend(players.find((p) => p.pid === target.pid)!, nextSeason)).toBe(false);

    const result = runAIContractRenewals(league.teams, players, nextSeason, USER_TID, league.played);
    expect(result.players.find((p) => p.pid === target.pid)).toEqual(
      players.find((p) => p.pid === target.pid),
    );
  });

  it("never touches the user's team", () => {
    const league = createLeagueState(USER_TID, mulberry32(24));
    const nextSeason = league.season + 1;
    const userTeam = league.teams.find((t) => t.tid === USER_TID)!;
    const players = league.players.map((p) =>
      userTeam.roster.includes(p.pid)
        ? { ...p, contract: { ...p.contract, expiresSeason: nextSeason } }
        : p,
    );

    const result = runAIContractRenewals(league.teams, players, nextSeason, USER_TID, league.played);
    for (const pid of userTeam.roster) {
      expect(result.players.find((p) => p.pid === pid)).toEqual(players.find((p) => p.pid === pid));
    }
  });

  it("is deterministic for the same inputs", () => {
    const league = createLeagueState(USER_TID, mulberry32(25));
    const nextSeason = league.season + 1;
    const players = league.players.map((p) => ({
      ...p,
      contract: { ...p.contract, expiresSeason: nextSeason },
    }));

    const a = runAIContractRenewals(league.teams, players, nextSeason, USER_TID, league.played);
    const b = runAIContractRenewals(league.teams, players, nextSeason, USER_TID, league.played);
    expect(a.players).toEqual(b.players);
  });

  it("returns the same team objects untouched (only player contracts change)", () => {
    const league = createLeagueState(USER_TID, mulberry32(26));
    const nextSeason = league.season + 1;
    const result = runAIContractRenewals(league.teams, league.players, nextSeason, USER_TID, league.played);
    expect(result.teams).toBe(league.teams);
  });

  it("every ROSTER_COMPOSITION position is representable without crashing on a full league", () => {
    // Smoke test over the real generated league: no position/lookup crashes
    // when every AI player is (artificially) put in his final contract season.
    const league = createLeagueState(USER_TID, mulberry32(27));
    const nextSeason = league.season + 1;
    const players = league.players.map((p) => ({
      ...p,
      contract: { ...p.contract, expiresSeason: nextSeason },
    }));
    expect(() =>
      runAIContractRenewals(league.teams, players, nextSeason, USER_TID, league.played),
    ).not.toThrow();
    expect(Object.keys(ROSTER_COMPOSITION).length).toBeGreaterThan(0); // sanity import check
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/core/ai/renewals.test.ts`
Expected: FAIL — `Cannot find module '../../../src/core/ai/renewals.js'` (the module doesn't exist yet).

- [ ] **Step 3: Implement `runAIContractRenewals`**

Create `src/core/ai/renewals.ts`:

```ts
import type { Player } from "../players/types.js";
import type { StoredTeam } from "../teams/clubs.js";
import type { PlayedMatch } from "../standings.js";
import { deriveLeagueContexts } from "./clubContext.js";
import { valueToClub } from "./evaluate.js";
import { canExtend, contractTerms, extendContract } from "../contracts.js";
import { AI_RENEWAL_MARGIN } from "../constants.js";

/**
 * Proactive AI contract renewals: the season before a rostered player's
 * contract would expire, his own club decides whether to extend him now
 * based on valueToClub vs. the wage he'd command — reusing the same
 * evaluation core phases 1-3 build on, so a club keeps players it still
 * rates and lets the rest walk (or get sold earlier via the existing
 * AI↔AI transfer market) without any scripted "he's aging, replace him"
 * rule. The user's club is untouched; their renewals stay a manual UI
 * action. Deterministic — no rng, so it can't perturb any other stream.
 */
export function runAIContractRenewals(
  teams: StoredTeam[],
  players: Player[],
  nextSeason: number,
  userTid: number,
  playedThisSeason: PlayedMatch[],
): { teams: StoredTeam[]; players: Player[] } {
  const contexts = deriveLeagueContexts({
    teams, players, season: nextSeason, played: playedThisSeason,
  });

  let updatedPlayers = players;
  const playerByPid = new Map(players.map((p) => [p.pid, p]));

  for (const team of teams) {
    if (team.tid === userTid) continue;
    const ctx = contexts.get(team.tid);
    if (!ctx) continue;

    for (const pid of team.roster) {
      const player = playerByPid.get(pid);
      if (!player || !canExtend(player, nextSeason)) continue;

      const terms = contractTerms(player, nextSeason);
      const value = valueToClub(player, ctx);
      if (value >= terms.salary * AI_RENEWAL_MARGIN) {
        updatedPlayers = extendContract(updatedPlayers, pid, nextSeason);
      }
    }
  }

  return { teams, players: updatedPlayers };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/core/ai/renewals.test.ts`
Expected: PASS (7 tests).

If the "clear keeper" or "clearly expendable" case doesn't land as expected, the fabricated scenarios in Step 1 use large safety margins (90 ovr vs. a stripped position, or 45 ovr surplus filler at 70 ovr) specifically so they hold across any reasonable `AI_RENEWAL_MARGIN` in roughly `[0.8, 2.0]` — do not weaken the assertions; instead re-check the fabricated player/team state against `valueToClub`'s actual formula (`src/core/ai/evaluate.ts`) if a case is surprisingly borderline.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/ai/renewals.ts test/core/ai/renewals.test.ts
git commit -m "Add runAIContractRenewals: proactive AI GM contract renewals (AI GM phase 4)"
```

---

## Task 3: Wire renewals into `simOffseason` as step 0

**Files:**
- Modify: `src/core/offseason.ts:1-40` (imports and the start of `simOffseason`)
- Test: `test/core/offseason.test.ts` (append)

**Interfaces:**
- Consumes: `runAIContractRenewals` from Task 2 (exact signature above).
- Produces: no new exports — `simOffseason`'s existing signature and return shape (`LeagueStore`) are unchanged.

- [ ] **Step 1: Write the failing integration test**

Append to `test/core/offseason.test.ts` (inside the existing `describe("simOffseason", ...)` block, after the last `it(...)`, before its closing `});`):

```ts

  it("proactively renews an AI player's contract before it would otherwise expire", () => {
    const rng = mulberry32(31);
    const league = playFullSeason(rng);
    const userTid = league.meta.userTid;
    const aiTid = league.teams.find((t) => t.tid !== userTid)!.tid;
    const aiTeam = league.teams.find((t) => t.tid === aiTid)!;

    // Force the AI team's best outfield player into his final contract
    // season (would expire at league.season + 1, i.e. the very next
    // offseason, if nothing renews him first) and make him an obvious keep:
    // in his prime, at a position where he's the club's only option.
    const best = league.players
      .filter((p) => aiTeam.roster.includes(p.pid) && p.pos !== "GK")
      .sort((a, b) => b.ovr - a.ovr)[0];
    const withExpiring = {
      ...league,
      teams: league.teams.map((t) =>
        t.tid === aiTid
          ? { ...t, roster: t.roster.filter((pid) =>
              !(league.players.find((p) => p.pid === pid)?.pos === best.pos && pid !== best.pid)
            ), budget: 300_000_000 }
          : t,
      ),
      players: league.players.map((p) =>
        p.pid === best.pid
          ? { ...p, born: (league.season + 1) - 26, ovr: 90, contract: { ...p.contract, expiresSeason: league.season + 1 } }
          : p,
      ),
    };

    const next = simOffseason(withExpiring, rng);
    const renewed = next.players.find((p) => p.pid === best.pid);
    // He must still be on the roster (not released to free agency) and his
    // contract must run past the season simOffseason just rolled into.
    expect(next.teams.find((t) => t.tid === aiTid)!.roster).toContain(best.pid);
    expect(renewed!.contract.expiresSeason).toBeGreaterThan(next.season);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/core/offseason.test.ts -t "proactively renews"`
Expected: FAIL — the player is released to free agency (his pid is missing from the AI team's roster after `simOffseason`, or he's picked up by a different club via free agency/transfer market, or his contract wasn't extended), since `runAIContractRenewals` isn't wired in yet.

- [ ] **Step 3: Wire the new step into `simOffseason`**

In `src/core/offseason.ts`, update the import line:

```ts
import { releaseExpiredContracts, runAIFreeAgency, trimRosterSurplus } from "./freeAgency.js";
```

to:

```ts
import { releaseExpiredContracts, runAIFreeAgency, trimRosterSurplus } from "./freeAgency.js";
import { runAIContractRenewals } from "./ai/renewals.js";
```

Then, inside `simOffseason`, insert a new step 0 immediately before the existing step 1 comment (`// 1. Release expired contracts to the free agent pool.`):

```ts
  // 0. Proactive AI contract renewals: any AI player entering his final
  //    contract season is renewed now if his club still values him above
  //    the new wage (by AI_RENEWAL_MARGIN) — before step 1 below would
  //    otherwise walk him to free agency next offseason with zero priority
  //    for his own club to keep him. Uses this season's now-final standings/
  //    league.played for form, same as the transfer-market steps do later.
  const renewals = runAIContractRenewals(
    league.teams, league.players, nextSeason, league.meta.userTid, league.played,
  );
  let teams: StoredTeam[] = releaseExpiredContracts(renewals.teams, renewals.players, endingSeason);
```

This **replaces** the existing line:

```ts
  let teams: StoredTeam[] = releaseExpiredContracts(league.teams, league.players, endingSeason);
```

Also update the subsequent line that builds `players` (currently `let players: Player[] = league.players.map(...)`) to read from `renewals.players` instead of `league.players`, so the renewed contracts flow into progression:

```ts
  let players: Player[] = renewals.players.map((p) => {
    const progressed = progressPlayer(rng, p, endingSeason);
    return progressed.injury ? { ...progressed, injury: null } : progressed;
  });
```

- [ ] **Step 4: Run the full offseason test file**

Run: `npx vitest run test/core/offseason.test.ts`
Expected: PASS — all existing tests plus the new "proactively renews" test.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — no regressions in `test/core/ai/transferMarket.test.ts`, `test/validation/m4-multiseason.test.ts`, or any other offseason-adjacent test.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/core/offseason.ts test/core/offseason.test.ts
git commit -m "Wire AI contract renewals into simOffseason as step 0"
```

---

## Task 4: Dynasty audit — sanity-check and tune `AI_RENEWAL_MARGIN`

This mirrors the multi-season audit methodology already used to validate AI GM phases 1-3 and the progression/OVR rework (see CLAUDE.md's "AI General Manager realism" and "M4" sections): a throwaway script driving the *real* `simThrough`/`simOffseason`, not a proxy. The script itself is not committed — only its findings (folded into Task 5's CLAUDE.md update, and a possible constant retune here).

**Files:**
- Create (temporary, not committed — deleted in Step 4): `scripts/_dynasty-audit-renewals.ts` (underscore prefix so it's obviously scratch, alongside the existing committed `scripts/cli.ts`)
- Possibly modify: `src/core/constants.ts` (`AI_RENEWAL_MARGIN`), if the audit shows the default of `1.1` needs adjusting.

- [ ] **Step 1: Write the audit script**

Create `scripts/_dynasty-audit-renewals.ts` (same import style as the existing `scripts/cli.ts`, which already imports from `../src/...`):

```ts
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";

const SEASONS = 40;
const SEEDS = [101, 202, 303];
const USER_TID = 0;

for (const seed of SEEDS) {
  const rng = mulberry32(seed);
  let league = createLeagueState(USER_TID, rng);
  let renewalCount = 0;
  let deficitSeasons = 0;
  let minBudget = Infinity;
  const ovrBuckets = { u60: 0, u70: 0, u80: 0, u90: 0, ge90: 0, total: 0 };

  for (let s = 0; s < SEASONS; s++) {
    league = simThrough(league, "season", rng);

    const before = new Map(league.players.map((p) => [p.pid, p.contract.expiresSeason]));
    league = simOffseason(league, rng);
    for (const p of league.players) {
      const wasExpiring = before.get(p.pid) === league.season - 1 + 1; // approx: had 1 season left pre-offseason
      if (wasExpiring && p.contract.expiresSeason > league.season) renewalCount++;
    }

    for (const t of league.teams) {
      if (t.tid === USER_TID) continue;
      if (t.budget < 0) deficitSeasons++;
      minBudget = Math.min(minBudget, t.budget);
    }
    for (const p of league.players) {
      ovrBuckets.total++;
      if (p.ovr < 60) ovrBuckets.u60++;
      else if (p.ovr < 70) ovrBuckets.u70++;
      else if (p.ovr < 80) ovrBuckets.u80++;
      else if (p.ovr < 90) ovrBuckets.u90++;
      else ovrBuckets.ge90++;
    }
  }

  console.log(`seed=${seed}`);
  console.log(`  approx renewals over ${SEASONS} seasons: ${renewalCount}`);
  console.log(`  AI deficit team-seasons: ${deficitSeasons} (expect 0)`);
  console.log(`  min AI budget observed: ${minBudget.toLocaleString()}`);
  console.log(`  final-season ovr spread: 80+ ${(100 * (ovrBuckets.u90 + ovrBuckets.ge90) / ovrBuckets.total).toFixed(1)}%, 90+ ${(100 * ovrBuckets.ge90 / ovrBuckets.total).toFixed(1)}%`);
}
```

- [ ] **Step 2: Run it**

Run (from the worktree root):
```bash
npx tsx scripts/_dynasty-audit-renewals.ts
```
Expected: it prints per-seed stats. Check against the invariants already established for prior phases:
- `AI deficit team-seasons: 0` for every seed (no AI club ever goes negative).
- OVR spread stays near the existing equilibrium (mean ~58, 80+ under ~2%, 90+ ~0%) — should be *unchanged* from the pre-renewals baseline (renewals shouldn't inflate ratings, only who keeps whom).
- `renewals over 40 seasons` should be a meaningfully large, non-zero number (confirms the step is actually doing something across a dynasty, not just in the hand-built unit tests).

- [ ] **Step 3: If any invariant fails, retune and re-run**

If deficits appear: raise `AI_RENEWAL_MARGIN` in `src/core/constants.ts` (e.g. `1.1` → `1.25`) so clubs renew less eagerly, and re-run Step 2. If renewals are near-zero across all seeds (the step is effectively inert): lower it (e.g. `1.1` → `0.95`) and re-run. Iterate until deficit-free and non-trivial renewal activity both hold. This mirrors how `AI_MARKET_MIN_SURPLUS` and friends were tuned for phase 2 — empirically, against the real sim, not guessed.

If a constant change is made, re-run the full suite:
```bash
npm test
```
Expected: still PASS (the Task 2 unit tests were deliberately built with large safety margins so they tolerate reasonable retuning; if one does fail, re-check its fabricated scenario against the new margin rather than loosening the assertion).

- [ ] **Step 4: Delete the scratch script (do not commit it)**

```bash
rm scripts/_dynasty-audit-renewals.ts
git status --short  # confirm it's gone and nothing else is unexpectedly dirty
```

- [ ] **Step 5: Commit any constant retune (skip this commit if `AI_RENEWAL_MARGIN` needed no change)**

```bash
git add src/core/constants.ts
git commit -m "Retune AI_RENEWAL_MARGIN from dynasty-audit findings"
```

---

## Task 5: Update CLAUDE.md

**Files:**
- Modify: `/Users/calebmeyer/soccer-gm/.claude/worktrees/ai-gm-phase4-renewals/CLAUDE.md` (the "AI General Manager realism" section)

**Interfaces:** none (documentation only).

- [ ] **Step 1: Update the phase list and add the phase-4 entry**

In the "AI General Manager realism" section, find this line:

```
Planned spine: (1) evaluation core, (2) AI↔AI transfer market, (3) AI inbound offers for the user's players, (4) long-term behavior (contract renewals, sell-at-peak, replace-aging), (5) imperfect/scouting-noised decisions.
```

Replace it with:

```
Planned spine: (1) evaluation core, (2) AI↔AI transfer market, (3) AI inbound offers for the user's players, (4) proactive contract renewals, (5) imperfect/scouting-noised decisions.
```

(Sell-at-peak turned out to already exist as an emergent effect of phase 2's transfer market, and replace-aging turned out not to need a separate mechanic — see the phase-4 bullet below and the design spec for why the original three-part phase-4 description was narrowed.)

Then, after the existing "Phase 3 — ..." bullet (the one ending "...mirrors how Recommended Transfers already behaves, not new to phase 3)."), add:

```
- **Phase 4 — proactive contract renewals: done.** `src/core/ai/renewals.ts`'s `runAIContractRenewals(...)` closes a gap phases 1-3 didn't touch: previously a contract just expired (`releaseExpiredContracts`) and the player hit the open free-agent pool with zero priority for his own club to keep him — `runAIFreeAgency` only reacts to positional shortfalls, not "this is my good player." Now, as a new step 0 in `simOffseason` (before contracts expire and before AI free agency/the summer transfer market run), any AI player entering his contract's final season is renewed on the spot if `valueToClub(player, ctx) ≥ contractTerms(player, nextSeason).salary × AI_RENEWAL_MARGIN` — reusing the phase-1 evaluation core and the same one-button `contractTerms`/`extendContract` helpers the user's own renew button already calls, so no new pricing or contract-length logic was needed. `valueToClub` already folds in affordability, so a cash-strapped club naturally lets pricier players walk without a second budget gate. The original phase-4 scope also named "sell-at-peak" and "replace-aging," but investigation found both already covered: sell-at-peak is an existing emergent effect of phase 2's transfer market (a keep-value that drops below market price makes a player available), and replace-aging needs no separate mechanic — an old, declining player simply fails the renewal bar, walks (or is sold earlier via the existing market), and the vacancy is filled by the same free-agency/transfer-market machinery that fills any other hole. Design doc: `docs/superpowers/specs/2026-07-12-ai-gm-phase4-contract-renewals-design.md`.
```

Then update the `**Refinements deferred:**` line to append phase 4's own deferred item (contracts are only re-evaluated at the offseason boundary, not tracked in-season, so a renewal decided in the summer can't react to anything that happens mid-season before his contract actually lapses — acceptable since the game has no in-season contract-year granularity at all today):

Find:
```
**Refinements deferred:** the winter market fires once at window open rather than trading dynamically across the window.
```
Replace with:
```
**Refinements deferred:** the winter AI↔AI market fires once at window open rather than trading dynamically across the window; phase-4 renewals are decided once, at the offseason boundary, using state as of that moment — there's no in-season contract-year tracking to revisit a decision mid-season (matches the game's existing offseason-only contract granularity, not a new limitation).
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Document AI GM phase 4 (contract renewals) in CLAUDE.md"
```

---

## Final check

- [ ] Run `npm test` and `npm run typecheck` one more time from a clean tree to confirm everything is green together.
- [ ] Confirm `git log --oneline -6` shows the phase-4 commits in order (constant → core function → wiring → possible retune → docs).
- [ ] Push the branch and open a draft PR per the worktree/background-job workflow (not a plan step — handled by the calling session once this plan finishes).
