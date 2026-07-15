# Division 2 Stays Meaningfully Weaker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Division 2 genuinely weaker than Division 1 through a full dynasty (not just at generation) via a wider generation-time offset, a real financial ceiling gap, and a new mechanic where breakout Division 2 players refuse to re-sign, hoping to move up.

**Architecture:** Three independent fixes layered on the existing second-division feature (`docs/superpowers/specs/2026-07-14-second-division-design.md`) and AI evaluation core (`src/core/ai/`). Fix 1 (generation) and Fix 2 (budget ceiling) are constant/threading changes to existing functions. Fix 3 (refusal) is a new pure function (`wouldRefuseExtension`) reusing the existing `valueToClub`/`ClubContext` evaluation core, wired additively into three existing call sites (AI renewals, the user's Extend action, and the for-sale-listing checks) without changing any of their signatures except where explicitly noted.

**Tech Stack:** TypeScript, Vitest, no new dependencies.

## Global Constraints

- No schema changes, no save migration — every new value is derived live from existing state, per the spec's explicit "computed live, not stored" decision for Fix 3.
- `DIVISION_2_BUDGET_SCALE` moves from 0.6 to 0.4 (Fix 2), a direct user requirement, not a tuning variable.
- `DIVISION_2_OFFSET`'s exact final value is found empirically (Task 4), starting from a rank-16-of-20 formula (~14.2) as a first guess.
- Target validation numbers (checked at season 1 AND season 30 of a dynasty audit): Division 2's single strongest player ~70-75 OVR; Division 2's Team of the Season average OVR ~65.
- Fix 3's refusal check must be deterministic (no RNG/jitter) — it's called from multiple independent sites (AI renewals, UI Extend button, transfer-listing checks) that must all agree on the same answer without sharing a seed.
- Fix 3 applies everywhere an extension could happen, including the user's own club, not just AI clubs.

---

## File Structure

- `src/core/constants.ts` — modify: `DIVISION_2_OFFSET` becomes a formula; new `DIVISION_2_TARGET_D1_RANK`; `DIVISION_2_BUDGET_SCALE` 0.6→0.4.
- `src/core/finance/budget.ts` — modify: `clampBudget` gains a `division` parameter; `chargeSeasonStart`/`settleSeasonEnd` pass it through.
- `src/core/transfers/negotiation.ts` — modify: `executeTransfer`'s seller-credit `clampBudget` call passes division; `makeTransferOffer`/`acceptCounterOffer` gain the Fix-3 for-sale check.
- `src/core/ai/transferMarket.ts` — modify: the seller-credit `clampBudget` call passes division.
- `src/core/transfers/inboundOffers.ts` — modify: export the existing private `buyerSpendable` helper.
- `src/core/ai/breakoutRefusal.ts` — create: `wouldRefuseExtension`, the new Fix-3 trigger.
- `src/core/ai/renewals.ts` — modify: skip auto-renewal for a refusing player.
- `src/core/transfers/recommendations.ts` — modify: `recommendedTransfers` treats a refusing player as for-sale.
- `src/ui/context/LeagueContext.tsx` — modify: `extendContractAction` blocks a refusing player.
- `src/ui/pages/Roster.tsx` — modify: shows "wants a move to Division 1" instead of the Extend button.
- `src/ui/components/PitchField.tsx` — modify: same, in the pitch-chip actions popover.
- `scripts/divisionAudit.ts` — modify: reports D2 max OVR, D2 TOTS average OVR, and D2/D1 wage-bill ratio at season 1 and season 30.
- `test/core/finance/budget.test.ts` — modify: division-scaled ceiling coverage.
- `test/core/ai/breakoutRefusal.test.ts` — create.
- `test/core/ai/renewals.test.ts` — modify: skip-on-refusal coverage.
- `test/core/transfers/negotiation.test.ts` — modify: refusing player is listable/purchasable.
- `CLAUDE.md` — modify: document the retune in the existing "Second division" section.

---

## Task 1: Widen the generation-time offset (Fix 1)

**Files:**
- Modify: `src/core/constants.ts:26-44`
- Test: `test/core/generate.test.ts` (existing test, no new test needed — verify it still passes and grows more comfortable)

**Interfaces:**
- Produces: `DIVISION_2_TARGET_D1_RANK` (new constant), `DIVISION_2_OFFSET` (now a derived formula instead of `= TEAM_STRENGTH_SPREAD`) — consumed by `src/core/league/generate.ts` (unchanged, already imports `DIVISION_2_OFFSET`) and `DIVISION_ACADEMY_BASE_CENTER` (unchanged, already derives from `DIVISION_2_OFFSET`).

- [ ] **Step 1: Read the current constant block to confirm line numbers before editing**

Run: `grep -n "DIVISION_2_OFFSET\|DIVISION_2_BUDGET_SCALE\|NUM_TEAMS_D2" src/core/constants.ts`
Expected: matches around lines 26-44, matching what's shown below (confirms nothing has drifted since this plan was written).

- [ ] **Step 2: Replace the offset with a derived formula**

Edit `src/core/constants.ts`, replacing:

```ts
/**
 * Second division (English Division 2): same team count as Division 1, a
 * strength offset subtracted from the per-team target before generation so
 * D2's strongest teams land around D1's mid-table strength (not just
 * modestly below D1's weakest team), and a budget/prize scale reflecting
 * the real financial gap between top-flight and second-tier football. Exact
 * values are starting points, confirmed/adjusted via a dynasty audit (see
 * the "Dynasty audit" task) rather than guessed blind.
 *
 * DIVISION_2_OFFSET kept equal to TEAM_STRENGTH_SPREAD (2026-07-14, alongside
 * the LEAGUE_BASE/TEAM_STRENGTH_SPREAD/RATING_NOISE_SD generation retune):
 * D2's strongest team's target is `TEAM_STRENGTH_SPREAD - DIVISION_2_OFFSET`,
 * which only lands at D1's average (0) when the two are equal. Widening
 * TEAM_STRENGTH_SPREAD 7→9 without this pushed D2's best team above D1's
 * average, breaking generate.test.ts's "D2's strongest team is no stronger
 * than D1's average team" invariant.
 */
export const NUM_TEAMS_D2 = 20;
export const DIVISION_2_OFFSET = TEAM_STRENGTH_SPREAD;
export const DIVISION_2_BUDGET_SCALE = 0.6;
```

with:

```ts
/**
 * Second division (English Division 2): same team count as Division 1, a
 * strength offset subtracted from the per-team target before generation so
 * D2's strongest teams land meaningfully below D1's own — a budget/prize
 * scale reflecting the real financial gap between top-flight and
 * second-tier football.
 *
 * DIVISION_2_OFFSET is derived from a target D1 rank rather than pinned to
 * a literal (2026-07-15 retune): a 30-season dynasty audit found the
 * original "D2's best ≈ D1's average" target (DIVISION_2_OFFSET =
 * TEAM_STRENGTH_SPREAD) eroded further over a long dynasty — D2's strongest
 * team's average roster OVR ended up *exceeding* D1's average team, and
 * Division 2's Team of the Season came within ~2.6 OVR of Division 1's.
 * D1's per-team strength targets are evenly spaced across
 * [-TEAM_STRENGTH_SPREAD, +TEAM_STRENGTH_SPREAD] over NUM_TEAMS clubs (rank
 * 1 = strongest, rank NUM_TEAMS = weakest); DIVISION_2_TARGET_D1_RANK picks
 * which D1 rank D2's own strongest team's target should land at.
 * DIVISION_2_TARGET_D1_RANK's value below is a starting point for the
 * empirical tuning pass in scripts/divisionAudit.ts (see that script's
 * comments) — the true target is Division 2's single strongest player
 * landing around 70-75 OVR and its Team of the Season averaging ~65,
 * measured at season 1 AND after a 30-season dynasty, not the rank itself.
 * Self-correcting if TEAM_STRENGTH_SPREAD or NUM_TEAMS are ever retuned
 * again — DIVISION_2_OFFSET previously drifted out of sync once already
 * when it was a plain literal (see the M1 milestone history in CLAUDE.md).
 */
export const NUM_TEAMS_D2 = 20;
export const DIVISION_2_TARGET_D1_RANK = 16;
export const DIVISION_2_OFFSET =
  ((DIVISION_2_TARGET_D1_RANK - 1) / (NUM_TEAMS - 1)) * 2 * TEAM_STRENGTH_SPREAD;
/**
 * Division 2's money-in scale, tightened 0.6→0.4 (2026-07-15, alongside the
 * DIVISION_2_OFFSET retune above): both the income rate (see divisionScale
 * in finance/budget.ts) and, as of the same retune, the budget ceiling
 * itself (see clampBudget) now use this factor, so Division 2 clubs can no
 * longer eventually out-save Division 1 clubs the way a flat MAX_BUDGET
 * previously allowed. 0.4 revisits a ratio range this constant was already
 * moved away from once (0.5→0.6, see the second-division design doc) for
 * causing small AI deficits — re-verified clean at 0.4 via a fresh dynasty
 * audit (see the "Dynasty audit" task in the second-division plan).
 */
export const DIVISION_2_BUDGET_SCALE = 0.4;
```

Note: `NUM_TEAMS` must already be defined above this block in the file (it is — confirm with `grep -n "export const NUM_TEAMS " src/core/constants.ts` before editing; it's declared earlier since `generateLeague` already uses it for Division 1).

- [ ] **Step 3: Run the existing generation test suite**

Run: `npx vitest run test/core/generate.test.ts`
Expected: PASS. The "D2's strongest team is no stronger than D1's average team" test (`test/core/generate.test.ts:50`) should pass with more margin than before (D2's best team's target now sits further below D1's average, not closer to it).

- [ ] **Step 4: Run the full test suite to check for any other constant-value assumptions**

Run: `npx vitest run`
Expected: PASS. If anything fails, read the failure — do not silently adjust the failing test's expected value without first confirming the failure is an intentional consequence of this retune (e.g. a solvency test) rather than a bug.

- [ ] **Step 5: Commit**

```bash
git add src/core/constants.ts
git commit -m "Widen Division 2's generation-time strength offset (derived from target D1 rank)"
```

---

## Task 2: Division-scaled budget ceiling (Fix 2)

**Files:**
- Modify: `src/core/finance/budget.ts`
- Modify: `src/core/transfers/negotiation.ts:164-190` (`executeTransfer`)
- Modify: `src/core/ai/transferMarket.ts:167-177` (seller-credit line)
- Test: `test/core/finance/budget.test.ts`

**Interfaces:**
- Produces: `clampBudget(budget: number, division: 0 | 1): number` (signature change — was `clampBudget(budget: number)`).
- Consumes: `DIVISION_2_BUDGET_SCALE` (now 0.4, from Task 1), `MAX_BUDGET` (unchanged).

- [ ] **Step 1: Write the failing tests for the new ceiling**

Add to `test/core/finance/budget.test.ts`, inside the existing `describe("division-scaled finances", ...)` block (after the two existing `it`s):

```ts
  it("caps Division 2 budgets at MAX_BUDGET * DIVISION_2_BUDGET_SCALE, not the shared MAX_BUDGET", () => {
    const hugeD1 = chargeSeasonStart(MAX_BUDGET, 0, 0);
    const hugeD2 = chargeSeasonStart(MAX_BUDGET, 0, 1);
    expect(hugeD1).toBe(MAX_BUDGET);
    expect(hugeD2).toBe(MAX_BUDGET * DIVISION_2_BUDGET_SCALE);
  });

  it("settleSeasonEnd also caps Division 2 at the scaled ceiling", () => {
    const result = settleSeasonEnd(MAX_BUDGET, 1, 100, 0, 1);
    expect(result).toBe(MAX_BUDGET * DIVISION_2_BUDGET_SCALE);
  });
```

Add `MAX_BUDGET` to the existing import block at the top of the file (it currently imports `BASE_SEASON_BUDGET, NUM_TEAMS, ...` from `../../../src/core/constants.js` — add `MAX_BUDGET` to that list).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/core/finance/budget.test.ts`
Expected: FAIL — `chargeSeasonStart(MAX_BUDGET, 0, 1)` currently returns `MAX_BUDGET` (the flat cap), not `MAX_BUDGET * DIVISION_2_BUDGET_SCALE`.

- [ ] **Step 3: Update `clampBudget` and its two in-file callers**

Edit `src/core/finance/budget.ts`, replacing:

```ts
/** Caps a budget at MAX_BUDGET; applied everywhere a club's budget can increase. */
export function clampBudget(budget: number): number {
  return Math.min(budget, MAX_BUDGET);
}
```

with:

```ts
/**
 * Caps a budget at MAX_BUDGET, scaled down for Division 2 by
 * DIVISION_2_BUDGET_SCALE (the same factor that scales Division 2's income
 * — see divisionScale below) — applied everywhere a club's budget can
 * increase, so a Division 2 club can never out-save a Division 1 club no
 * matter how well it's run.
 */
export function clampBudget(budget: number, division: 0 | 1): number {
  return Math.min(budget, MAX_BUDGET * divisionScale(division));
}
```

`divisionScale` is defined further down in the same file — TypeScript function declarations are hoisted, so this forward reference is fine, but move `divisionScale` above `clampBudget` anyway for readability: cut the existing

```ts
/** Scale factor for a division's money-in: 1 for Division 1, DIVISION_2_BUDGET_SCALE for Division 2. */
function divisionScale(division: 0 | 1): number {
  return division === 0 ? 1 : DIVISION_2_BUDGET_SCALE;
}
```

from its current location (below `SeasonRevenue`) and paste it directly above the new `clampBudget`, updating its comment:

```ts
/**
 * Scale factor for a division's money — both income (see seasonRevenue/
 * chargeSeasonStart) and, since the 2026-07-15 retune, the savings ceiling
 * (see clampBudget): 1 for Division 1, DIVISION_2_BUDGET_SCALE for
 * Division 2.
 */
function divisionScale(division: 0 | 1): number {
  return division === 0 ? 1 : DIVISION_2_BUDGET_SCALE;
}

/**
 * Caps a budget at MAX_BUDGET, scaled down for Division 2 by
 * DIVISION_2_BUDGET_SCALE (the same factor that scales Division 2's income
 * — see divisionScale above) — applied everywhere a club's budget can
 * increase, so a Division 2 club can never out-save a Division 1 club no
 * matter how well it's run.
 */
export function clampBudget(budget: number, division: 0 | 1): number {
  return Math.min(budget, MAX_BUDGET * divisionScale(division));
}
```

Then update the two in-file callers to pass `division` (both already receive it as a parameter):

```ts
export function settleSeasonEnd(
  currentBudget: number,
  rank: number,
  hype: number,
  scoutingSpend: number,
  division: 0 | 1,
): number {
  const { successPayout: payout, hypeRevenue } = seasonRevenue(rank, hype, division);
  return clampBudget(currentBudget + payout + hypeRevenue - scoutingSpend, division);
}
```

```ts
export function chargeSeasonStart(currentBudget: number, wages: number, division: 0 | 1): number {
  return clampBudget(currentBudget + BASE_SEASON_BUDGET * divisionScale(division) - wages, division);
}
```

- [ ] **Step 4: Update `executeTransfer`'s seller-credit call**

Edit `src/core/transfers/negotiation.ts:176-179`, replacing:

```ts
      if (t.tid === fromTid) {
        return { ...t, roster: t.roster.filter((p) => p !== pid), budget: clampBudget(t.budget + fee) };
      }
```

with:

```ts
      if (t.tid === fromTid) {
        return { ...t, roster: t.roster.filter((p) => p !== pid), budget: clampBudget(t.budget + fee, t.division) };
      }
```

- [ ] **Step 5: Update the AI↔AI market's seller-credit call**

Edit `src/core/ai/transferMarket.ts:171`, replacing:

```ts
    budget.set(c.sellerTid, clampBudget((budget.get(c.sellerTid) ?? 0) + fee));
```

with:

```ts
    const sellerDivision = teams.find((t) => t.tid === c.sellerTid)!.division;
    budget.set(c.sellerTid, clampBudget((budget.get(c.sellerTid) ?? 0) + fee, sellerDivision));
```

(Insert this as a new line immediately before the existing `budget.set(...)` call, inside the same `for (const c of candidates)` loop where `teams` — the function's original, un-mutated parameter — is already in scope.)

- [ ] **Step 6: Run the budget test file to verify the new tests pass**

Run: `npx vitest run test/core/finance/budget.test.ts`
Expected: PASS, all tests including the two new ones from Step 1.

- [ ] **Step 7: Run the full test suite (this is a signature change — check every caller compiles and passes)**

Run: `npx vitest run`
Expected: PASS. Also run `npx tsc --noEmit` (or the project's existing typecheck command — check `package.json`'s `scripts` block for the exact name) to confirm no other `clampBudget(x)` call site was missed; the compiler will error on any remaining single-argument call.

- [ ] **Step 8: Commit**

```bash
git add src/core/finance/budget.ts src/core/transfers/negotiation.ts src/core/ai/transferMarket.ts test/core/finance/budget.test.ts
git commit -m "Cap Division 2 budgets at a scaled-down ceiling, not the shared MAX_BUDGET"
```

---

## Task 3: Extend the dynasty audit script with the new validation metrics

**Files:**
- Modify: `scripts/divisionAudit.ts`

**Interfaces:**
- Consumes: `computeSeasonAwards` from `src/core/awards.js`, `SeasonHistoryEntry`/`league.seasonHistory` from `src/core/leagueState.js` (already available on the `league` object this script builds).
- Produces: console output only — this script has no test file (it's a manual audit tool, same as its current form), so this task's "test" is running it and reading the numbers.

This script is a manual tuning tool, not part of the automated test suite (consistent with its current form — it has no corresponding `test/` file). This task extends what it reports; Task 4 uses that report to actually tune `DIVISION_2_TARGET_D1_RANK`.

- [ ] **Step 1: Read the current script in full to confirm the exact structure before editing**

Run: `cat scripts/divisionAudit.ts`
Expected: matches the version this plan was written against (30 seasons, 3 seeds, per-seed OVR/budget/turnover reporting via a `for (let s = 1; s <= SEASONS; s++)` loop that reassigns `league` each iteration).

- [ ] **Step 2: Add the new per-seed metrics**

Replace the full contents of `scripts/divisionAudit.ts` with:

```ts
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";

const SEASONS = 30;
const SEEDS = [1, 2, 3];

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function pctOver(xs: number[], t: number): number {
  return (100 * xs.filter((x) => x >= t).length) / xs.length;
}

function totsAvgOvr(
  awards: { teamOfSeason: (number | null)[] },
  playersByPid: Map<number, { ovr: number }>,
): number {
  const ovrs = awards.teamOfSeason
    .filter((pid): pid is number => pid !== null)
    .map((pid) => playersByPid.get(pid)?.ovr ?? 0);
  return avg(ovrs);
}

for (const seed of SEEDS) {
  console.log(`\n=== seed ${seed} ===`);
  const rng = mulberry32(seed);
  let league = createLeagueState(0, rng);

  let minBudget = Infinity;
  let lastD1: number[] = [];
  let lastD2: number[] = [];
  let lastD1TeamAvgs: number[] = [];
  let lastD2TeamAvgs: number[] = [];
  let lastD1WageBill = 0;
  let lastD2WageBill = 0;
  let season1D2Max = 0;
  let season1D2TotsAvg = 0;

  for (let s = 1; s <= SEASONS; s++) {
    league = simThrough(league, "season", rng);
    league = simOffseason(league, rng);
    for (const t of league.teams) minBudget = Math.min(minBudget, t.budget);

    const ovrByTid = new Map<number, number[]>();
    for (const p of league.players) {
      const tid = league.teams.find((t) => t.roster.includes(p.pid))?.tid;
      if (tid === undefined) continue;
      const arr = ovrByTid.get(tid) ?? [];
      arr.push(p.ovr);
      ovrByTid.set(tid, arr);
    }
    lastD1 = league.teams.filter((t) => t.division === 0).flatMap((t) => ovrByTid.get(t.tid) ?? []);
    lastD2 = league.teams.filter((t) => t.division === 1).flatMap((t) => ovrByTid.get(t.tid) ?? []);
    lastD1TeamAvgs = league.teams.filter((t) => t.division === 0).map((t) => avg(ovrByTid.get(t.tid) ?? []));
    lastD2TeamAvgs = league.teams.filter((t) => t.division === 1).map((t) => avg(ovrByTid.get(t.tid) ?? []));

    const salaryByPid = new Map(league.players.map((p) => [p.pid, p.contract.salary]));
    lastD1WageBill = league.teams
      .filter((t) => t.division === 0)
      .reduce((sum, t) => sum + t.roster.reduce((s, pid) => s + (salaryByPid.get(pid) ?? 0), 0), 0);
    lastD2WageBill = league.teams
      .filter((t) => t.division === 1)
      .reduce((sum, t) => sum + t.roster.reduce((s, pid) => s + (salaryByPid.get(pid) ?? 0), 0), 0);

    if (s === 1) {
      season1D2Max = Math.max(...lastD2);
      const hist = league.seasonHistory[league.seasonHistory.length - 1];
      const playersByPid = new Map(league.players.map((p) => [p.pid, p]));
      season1D2TotsAvg = totsAvgOvr(hist.awards[1], playersByPid);
    }
  }

  const finalHist = league.seasonHistory[league.seasonHistory.length - 1];
  const finalPlayersByPid = new Map(league.players.map((p) => [p.pid, p]));
  const season30D2TotsAvg = totsAvgOvr(finalHist.awards[1], finalPlayersByPid);

  console.log("min budget ever observed:", minBudget.toLocaleString());
  console.log("D1 final-season OVR: mean", avg(lastD1).toFixed(1), "80+:", pctOver(lastD1, 80).toFixed(1) + "%");
  console.log("D2 final-season OVR: mean", avg(lastD2).toFixed(1), "80+:", pctOver(lastD2, 80).toFixed(1) + "%");
  console.log(
    "D2's strongest TEAM (avg roster ovr) vs D1's average TEAM:",
    Math.max(...lastD2TeamAvgs).toFixed(1), "vs", avg(lastD1TeamAvgs).toFixed(1),
  );
  console.log(
    "D2 single max player OVR: season 1 =", season1D2Max, "| season", SEASONS, "=", Math.max(...lastD2),
    "(target: ~70-75)",
  );
  console.log(
    "D2 Team of the Season avg OVR: season 1 =", season1D2TotsAvg.toFixed(1),
    "| season", SEASONS, "=", season30D2TotsAvg.toFixed(1), "(target: ~65)",
  );
  console.log(
    "D2/D1 wage bill ratio (final season):",
    (lastD2WageBill / lastD1WageBill).toFixed(3),
    `(D2 total: ${lastD2WageBill.toLocaleString()}, D1 total: ${lastD1WageBill.toLocaleString()})`,
  );

  const finalD1Ids = new Set(league.teams.filter((t) => t.division === 0).map((t) => t.tid));
  const startingD1Ids = new Set(Array.from({ length: 20 }, (_, i) => i));
  const stillInD1 = [...finalD1Ids].filter((tid) => startingD1Ids.has(tid)).length;
  console.log(`D1 clubs still in D1 after ${SEASONS} seasons: ${stillInD1}/20 (turnover from promotion/relegation)`);
}
```

- [ ] **Step 3: Run it once to confirm it executes without error**

Run: `npx tsx scripts/divisionAudit.ts` (this takes a few minutes — 30 seasons × 3 seeds of real simulation)
Expected: no crashes; each seed block prints all six metric lines including the two new "D2 single max player OVR" and "D2 Team of the Season avg OVR" lines and the wage-bill ratio line. The actual numbers are not expected to hit the targets yet — `DIVISION_2_TARGET_D1_RANK` is still at its Task 1 starting-point value. Task 4 iterates on the number.

- [ ] **Step 4: Commit**

```bash
git add scripts/divisionAudit.ts
git commit -m "Report D2 max OVR, D2 TOTS average OVR, and D2/D1 wage-bill ratio in the dynasty audit"
```

---

## Task 4: Empirically tune `DIVISION_2_TARGET_D1_RANK` against the target numbers

**Files:**
- Modify: `src/core/constants.ts` (only the `DIVISION_2_TARGET_D1_RANK` value, iteratively)

**Interfaces:**
- Consumes: `scripts/divisionAudit.ts` output from Task 3.

This is a manual audit-and-adjust loop, not a code-writing task — there is no closed-form answer (see the spec's "Tuning approach" section). Budget generously for iteration; each full run takes several minutes.

- [ ] **Step 1: Run the extended audit script with the Task 1 starting value (rank 16)**

Run: `npx tsx scripts/divisionAudit.ts`
Record, for each of the 3 seeds: season-1 and season-30 values for "D2 single max player OVR" and "D2 Team of the Season avg OVR", plus the min-budget line (solvency check).

- [ ] **Step 2: Compare against target and adjust**

Targets: D2 max OVR ~70-75, D2 TOTS avg OVR ~65, at both season 1 and season 30, across all 3 seeds, with min budget staying positive (no AI deficit).

- If season-30 numbers run consistently **above** target: lower `DIVISION_2_TARGET_D1_RANK` is wrong — you want a *higher* rank number (further down D1's table, i.e. weaker), so **increase** `DIVISION_2_TARGET_D1_RANK` (e.g. 16 → 17 or 18; max useful value is 20, D1's weakest).
- If season-30 numbers run consistently **below** target (D2 crushed too hard, min budget going negative, or the numbers undershoot 70-75/65): **decrease** `DIVISION_2_TARGET_D1_RANK` (e.g. 16 → 14).
- If season-1 and season-30 numbers disagree sharply (e.g. season 1 on target but season 30 far off): re-read the Problem section of the spec — this would mean the erosion Fix 1/Fix 2 were meant to close is still happening, and the root cause needs re-investigating before changing the rank further (do not silently keep nudging the rank to chase a moving target — flag this to the user instead of guessing indefinitely).
- If any seed shows a negative min budget at any point: Fix 2's 0.4x ceiling combined with this rank is too tight for Division 2 to sustain itself — this is the exact risk flagged in the spec (`DIVISION_2_BUDGET_SCALE` was already shown too tight once at 0.5). **Stop and report this to the user rather than silently picking a different `DIVISION_2_BUDGET_SCALE` value** — the spec was explicit that 0.4 is a direct requirement, not a free variable.

Edit `src/core/constants.ts`'s `DIVISION_2_TARGET_D1_RANK` value and re-run Step 1. Repeat until targets are met across all 3 seeds at both season checkpoints, or until a solvency problem forces escalation per the bullet above.

- [ ] **Step 3: Once targets are hit, run the full test suite one more time**

Run: `npx vitest run`
Expected: PASS. Re-confirm `test/core/generate.test.ts:50` ("D2's strongest team is no stronger than D1's average team") still passes — it should, by an even wider margin than before, since D2's target rank moved further from D1's average.

- [ ] **Step 4: Commit the final tuned value**

```bash
git add src/core/constants.ts
git commit -m "Tune DIVISION_2_TARGET_D1_RANK to <final value> via dynasty audit"
```

(Replace `<final value>` with whatever rank the audit converged on — include the final audit numbers in the commit body, e.g. "D2 max OVR: season 1 = X, season 30 = Y; D2 TOTS avg: season 1 = A, season 30 = B; min budget = $Z across 3 seeds".)

---

## Task 5: Export `buyerSpendable` for reuse

**Files:**
- Modify: `src/core/transfers/inboundOffers.ts:27`

**Interfaces:**
- Produces: `export function buyerSpendable(buyer: StoredTeam, buyerCtx: ClubContext, wageCharge: number): number` (was private).

`buyerSpendable` computes what a buying club can spend right now without dipping into its cash reserve — exactly the affordability check Fix 3's `wouldRefuseExtension` needs (Task 6) when checking whether a Division 1 club could actually afford a Division 2 breakout player, not just whether it values him highly on paper.

- [ ] **Step 1: Add the `export` keyword**

Edit `src/core/transfers/inboundOffers.ts`, replacing:

```ts
function buyerSpendable(buyer: StoredTeam, buyerCtx: ClubContext, wageCharge: number): number {
```

with:

```ts
export function buyerSpendable(buyer: StoredTeam, buyerCtx: ClubContext, wageCharge: number): number {
```

- [ ] **Step 2: Run the existing inboundOffers tests to confirm nothing broke**

Run: `npx vitest run test/core/transfers/inboundOffers.test.ts`
Expected: PASS (exporting a previously-private function that's still used identically inside its own module changes nothing behaviorally).

- [ ] **Step 3: Commit**

```bash
git add src/core/transfers/inboundOffers.ts
git commit -m "Export buyerSpendable for reuse by the Division 2 breakout-refusal check"
```

---

## Task 6: `wouldRefuseExtension` — the Fix 3 trigger

**Files:**
- Create: `src/core/ai/breakoutRefusal.ts`
- Test: `test/core/ai/breakoutRefusal.test.ts`

**Interfaces:**
- Consumes: `ClubContext` (`src/core/ai/clubContext.js`), `valueToClub` (`src/core/ai/evaluate.js`), `buyerSpendable` (`src/core/transfers/inboundOffers.js`, from Task 5), `AI_MARKET_MIN_SURPLUS` (`src/core/constants.js`), `StoredTeam` (`src/core/teams/clubs.js`), `Player` (`src/core/players/types.js`).
- Produces: `wouldRefuseExtension(player: Player, currentTeam: StoredTeam, teams: StoredTeam[], contexts: Map<number, ClubContext>): boolean` — consumed by Tasks 7, 8, 9, 10.

- [ ] **Step 1: Write the failing tests**

Create `test/core/ai/breakoutRefusal.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../../src/engine/rng.js";
import { createLeagueState } from "../../../src/core/leagueState.js";
import { deriveLeagueContexts } from "../../../src/core/ai/clubContext.js";
import { wouldRefuseExtension } from "../../../src/core/ai/breakoutRefusal.js";
import type { StoredTeam } from "../../../src/core/teams/clubs.js";

const USER_TID = 0;

describe("wouldRefuseExtension", () => {
  it("never refuses for a Division 1 player, regardless of ability", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d1Team = league.teams.find((t) => t.division === 0)!;
    const target = league.players.find((p) => d1Team.roster.includes(p.pid))!;
    const boosted = { ...target, ovr: 95 };
    const players = league.players.map((p) => (p.pid === target.pid ? boosted : p));
    const contexts = deriveLeagueContexts({ ...league, players });
    expect(wouldRefuseExtension(boosted, d1Team, league.teams, contexts)).toBe(false);
  });

  it("does not refuse an unremarkable Division 2 player no Division 1 club would chase", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d2Team = league.teams.find((t) => t.division === 1)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;
    const contexts = deriveLeagueContexts(league);
    expect(wouldRefuseExtension(target, d2Team, league.teams, contexts)).toBe(false);
  });

  it("refuses a Division 2 breakout star that a rich Division 1 club can afford and values well above his own club", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d2Team = league.teams.find((t) => t.division === 1 && t.tid !== USER_TID)!;
    const d1Team = league.teams.find((t) => t.division === 0 && t.tid !== USER_TID)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;

    // A clear breakout: make him elite while his own club stays poor D2-scale.
    const star = { ...target, ovr: 88, potential: 90 };
    const players = league.players.map((p) => (p.pid === target.pid ? star : p));

    // Give the D1 club deep pockets so affordability can't be the blocker.
    const teams: StoredTeam[] = league.teams.map((t) =>
      t.tid === d1Team.tid ? { ...t, budget: 300_000_000 } : t,
    );

    const contexts = deriveLeagueContexts({ ...league, teams, players });
    expect(wouldRefuseExtension(star, d2Team, teams, contexts)).toBe(true);
  });

  it("is deterministic: repeated calls with the same inputs agree", () => {
    const league = createLeagueState(USER_TID, mulberry32(11));
    const d2Team = league.teams.find((t) => t.division === 1 && t.tid !== USER_TID)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;
    const star = { ...target, ovr: 88, potential: 90 };
    const players = league.players.map((p) => (p.pid === target.pid ? star : p));
    const contexts = deriveLeagueContexts({ ...league, players });
    const first = wouldRefuseExtension(star, d2Team, league.teams, contexts);
    const second = wouldRefuseExtension(star, d2Team, league.teams, contexts);
    expect(first).toBe(second);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/core/ai/breakoutRefusal.test.ts`
Expected: FAIL with a module-not-found error (`src/core/ai/breakoutRefusal.ts` doesn't exist yet).

- [ ] **Step 3: Implement `wouldRefuseExtension`**

Create `src/core/ai/breakoutRefusal.ts`:

```ts
import type { Player } from "../players/types.js";
import type { StoredTeam } from "../teams/clubs.js";
import type { ClubContext } from "./clubContext.js";
import { valueToClub } from "./evaluate.js";
import { buyerSpendable } from "../transfers/inboundOffers.js";
import { AI_MARKET_MIN_SURPLUS } from "../constants.js";

/**
 * A Division 2 player refuses to sign a new deal with his current club once
 * he'd already be a viable transfer target for some Division 1 club —
 * mirroring real feeder-league drama (a breakout player forcing a move by
 * refusing terms) rather than staying wherever he happens to be forever.
 *
 * Reuses the exact bar Phase 2 (AI↔AI market) and Phase 3 (inbound offers)
 * already use for "would this club actually want to buy him": his value to
 * some Division 1 club must clear his value to his own club by
 * AI_MARKET_MIN_SURPLUS, AND that Division 1 club must be able to afford
 * him without dipping into its cash reserve (buyerSpendable). This is
 * deterministic (no jitter) — it's checked from independent call sites (AI
 * renewals, the user's Extend button, transfer-listing checks) that must
 * all agree on the same answer without a shared RNG seed.
 */
export function wouldRefuseExtension(
  player: Player,
  currentTeam: StoredTeam,
  teams: StoredTeam[],
  contexts: Map<number, ClubContext>,
): boolean {
  if (currentTeam.division !== 1) return false;

  const currentCtx = contexts.get(currentTeam.tid);
  if (!currentCtx) return false;
  const reservation = valueToClub(player, currentCtx);

  for (const club of teams) {
    if (club.division !== 0) continue;
    const ctx = contexts.get(club.tid);
    if (!ctx) continue;

    const value = valueToClub(player, ctx);
    if (value < reservation * (1 + AI_MARKET_MIN_SURPLUS)) continue;
    if (buyerSpendable(club, ctx, 0) < reservation) continue;

    return true;
  }

  return false;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/core/ai/breakoutRefusal.test.ts`
Expected: PASS, all four tests. If the "refuses a Division 2 breakout star" test doesn't pass, first check whether `deriveLeagueContexts`'s per-division normalization (see `src/core/ai/clubContext.ts`) is making the D2 seller's own valuation of the star artificially high too (since `reservation` is also computed within-division) — if so, the test's `ovr: 88` may need to go even higher, or the D1 club's budget even higher, to clear the surplus bar; don't weaken the implementation to make the test pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/breakoutRefusal.ts test/core/ai/breakoutRefusal.test.ts
git commit -m "Add wouldRefuseExtension: a Division 2 breakout player refuses to re-sign"
```

---

## Task 7: Wire refusal into AI contract renewals

**Files:**
- Modify: `src/core/ai/renewals.ts`
- Test: `test/core/ai/renewals.test.ts`

**Interfaces:**
- Consumes: `wouldRefuseExtension` (Task 6).

- [ ] **Step 1: Write the failing test**

Add to `test/core/ai/renewals.test.ts` (follow the existing file's fixture pattern — see the two tests already there):

```ts
  it("does not renew a Division 2 breakout star a Division 1 club could poach", () => {
    const league = createLeagueState(USER_TID, mulberry32(23));
    const nextSeason = league.season + 1;
    const d2Team = league.teams.find((t) => t.division === 1 && t.tid !== USER_TID)!;
    const d1Team = league.teams.find((t) => t.division === 0 && t.tid !== USER_TID)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;

    const players = league.players.map((p) =>
      p.pid === target.pid
        ? { ...p, born: nextSeason - 24, ovr: 88, potential: 90, contract: { ...p.contract, expiresSeason: nextSeason } }
        : p,
    );
    const teams: StoredTeam[] = league.teams.map((t) =>
      t.tid === d1Team.tid ? { ...t, budget: 300_000_000 } : t,
    );

    const result = runAIContractRenewals(teams, players, nextSeason, USER_TID, league.played, 42);
    const stillExpiring = result.players.find((p) => p.pid === target.pid)!;
    expect(stillExpiring.contract.expiresSeason).toBe(nextSeason);
  });
```

Add `type { StoredTeam }` to the file's existing imports if not already present (it is — see the file's current top-of-file imports).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/core/ai/renewals.test.ts`
Expected: FAIL — today's `runAIContractRenewals` renews any player whose value clears the wage bar, with no refusal check, so `stillExpiring.contract.expiresSeason` will be greater than `nextSeason`.

- [ ] **Step 3: Add the refusal check**

Edit `src/core/ai/renewals.ts`, adding the import:

```ts
import { wouldRefuseExtension } from "./breakoutRefusal.js";
```

and updating the loop body from:

```ts
    for (const pid of team.roster) {
      const player = playerByPid.get(pid);
      if (!player || !canExtend(player, nextSeason)) continue;

      const terms = contractTerms(player, nextSeason);
      const jitter = mulberry32(hashInts(seed, pid));
      const value = perceivedValueToClub(player, ctx, jitter);
      if (value >= terms.salary * AI_RENEWAL_MARGIN) {
        updatedPlayers = extendContract(updatedPlayers, pid, nextSeason);
      }
    }
```

to:

```ts
    for (const pid of team.roster) {
      const player = playerByPid.get(pid);
      if (!player || !canExtend(player, nextSeason)) continue;
      if (wouldRefuseExtension(player, team, teams, contexts)) continue;

      const terms = contractTerms(player, nextSeason);
      const jitter = mulberry32(hashInts(seed, pid));
      const value = perceivedValueToClub(player, ctx, jitter);
      if (value >= terms.salary * AI_RENEWAL_MARGIN) {
        updatedPlayers = extendContract(updatedPlayers, pid, nextSeason);
      }
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/core/ai/renewals.test.ts`
Expected: PASS, all tests including the two pre-existing ones (confirm the new check doesn't accidentally block the "renews a clear keeper" test — that test's target is on a Division 1 club by default from `createLeagueState`'s generated rosters; if it happens to land a Division 2 club, `wouldRefuseExtension` returns `false` immediately for anyone not a break-out case, so it should be unaffected either way).

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/renewals.ts test/core/ai/renewals.test.ts
git commit -m "AI clubs no longer auto-renew a Division 2 breakout player who'd refuse"
```

---

## Task 8: Wire refusal into transfer-listing checks (the payoff — he becomes purchasable)

**Files:**
- Modify: `src/core/transfers/negotiation.ts`
- Modify: `src/core/transfers/recommendations.ts`
- Test: `test/core/transfers/negotiation.test.ts`

**Interfaces:**
- Consumes: `wouldRefuseExtension` (Task 6), `deriveLeagueContexts` (`src/core/ai/clubContext.js`).
- Produces: a new internal helper in `negotiation.ts`, `isForSaleOrRefusing`, used by `makeTransferOffer` and `acceptCounterOffer` in place of their existing `isForSale` calls. `isForSale` itself is unchanged (still exported, still used as-is elsewhere).

This is the mechanic's actual payoff: once `wouldRefuseExtension` is true, the player must become purchasable through the same channels a normal for-sale player already uses, or the refusal has no visible effect.

- [ ] **Step 1: Write the failing test**

Add to `test/core/transfers/negotiation.test.ts` (check the existing file for its exact fixture/import style first — follow that pattern):

```ts
  it("lets the user buy a Division 2 breakout player even though he doesn't clear the normal depth-floor for-sale check", () => {
    const league = createLeagueState(0, mulberry32(31));
    // Force the transfer window open — check window.ts / the existing test
    // file's own pattern for how other tests in this file get ws.open true
    // (e.g. setting league.season/phase to a known in-window value), and
    // reuse that exact approach here rather than reimplementing it.
    const d2Team = league.teams.find((t) => t.division === 1 && t.tid !== league.meta.userTid)!;
    const target = league.players.find((p) => d2Team.roster.includes(p.pid))!;
    const star = { ...target, ovr: 88, potential: 90 };
    let players = league.players.map((p) => (p.pid === target.pid ? star : p));

    const d1Team = league.teams.find((t) => t.division === 0 && t.tid !== league.meta.userTid)!;
    let teams = league.teams.map((t) =>
      t.tid === d1Team.tid ? { ...t, budget: 300_000_000 }
      : t.tid === league.meta.userTid ? { ...t, budget: 300_000_000 }
      : t,
    );

    const testLeague = { ...league, teams, players };
    // A depth-floor-only check (isForSale) would likely reject him if
    // d2Team's roster is otherwise thin at his position — the point of this
    // test is that the refusal-driven listing bypasses that.
    const updated = makeTransferOffer(testLeague, target.pid, 50_000_000);
    const userTeamAfter = updated.teams.find((t) => t.tid === league.meta.userTid)!;
    expect(userTeamAfter.roster.includes(target.pid) || updated.negotiations.some((n) => n.pid === target.pid)).toBe(true);
  });
```

Note: the exact window-open setup and offer-amount needed to trigger an "accepted" vs. "countered" outcome depends on this test file's existing conventions and `reservationPrice`'s randomness — read the existing tests in `test/core/transfers/negotiation.test.ts` first (particularly any test already calling `makeTransferOffer`) and match their setup exactly rather than guessing at window/phase values. The assertion above accepts either outcome (executed transfer or an open negotiation) since the point being tested is that the offer wasn't silently rejected as not-for-sale, not the negotiation outcome itself.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/core/transfers/negotiation.test.ts`
Expected: FAIL (or reveals the test's own window-open setup needs adjusting first — fix that before judging the refusal behavior itself; the failure that matters is `makeTransferOffer` returning the league unchanged because `isForSale` returned `false`).

- [ ] **Step 3: Add the `isForSaleOrRefusing` helper and wire it in**

Edit `src/core/transfers/negotiation.ts`, adding to the imports:

```ts
import { deriveLeagueContexts } from "../ai/clubContext.js";
import { wouldRefuseExtension } from "../ai/breakoutRefusal.js";
```

Add a new function directly after the existing `isForSale`:

```ts
/**
 * True if the player is either normally for-sale (isForSale) or a Division
 * 2 breakout player who'd refuse to re-sign (wouldRefuseExtension) — such a
 * player is transfer-listed immediately rather than waiting for a normal
 * sale trigger (see the Division 2 weaker-dynasty design doc).
 */
export function isForSaleOrRefusing(
  league: LeagueStore,
  seller: StoredTeam,
  players: Map<number, Player>,
  pid: number,
): boolean {
  if (isForSale(seller, players, pid)) return true;
  const player = players.get(pid);
  if (!player) return false;
  const contexts = deriveLeagueContexts({
    teams: league.teams, players: league.players, season: league.season, played: league.played,
  });
  return wouldRefuseExtension(player, seller, league.teams, contexts);
}
```

Then replace the two existing `isForSale(seller, playerMap, pid)` calls — one in `makeTransferOffer`, one in `acceptCounterOffer` — with `isForSaleOrRefusing(league, seller, playerMap, pid)`. In `acceptCounterOffer`, the variable holding the league argument is named `league` already at that point in the function (confirm the exact local variable name against the current file before editing — it may be `updated` partway through the function; use whichever in-scope `LeagueStore` value is the correct pre-mutation league at that call site).

- [ ] **Step 4: Wire the same check into `recommendedTransfers`**

Edit `src/core/transfers/recommendations.ts`, adding to the imports:

```ts
import { deriveLeagueContexts } from "../ai/clubContext.js";
import { wouldRefuseExtension } from "../ai/breakoutRefusal.js";
```

Compute `contexts` once, before the candidate-building loop (for performance — not per-candidate), and use it in the existing `isForSale` check. Replace:

```ts
  const candidates: TransferTarget[] = [];
  for (const team of league.teams) {
    if (team.tid === user.tid) continue;
    for (const pid of team.roster) {
      const player = playerMap.get(pid);
      if (!player) continue;
      if (!isForSale(team, playerMap, pid)) continue;
```

with:

```ts
  const contexts = deriveLeagueContexts({
    teams: league.teams, players: league.players, season: league.season, played: league.played,
  });

  const candidates: TransferTarget[] = [];
  for (const team of league.teams) {
    if (team.tid === user.tid) continue;
    for (const pid of team.roster) {
      const player = playerMap.get(pid);
      if (!player) continue;
      if (!isForSale(team, playerMap, pid) && !wouldRefuseExtension(player, team, league.teams, contexts)) continue;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run test/core/transfers/negotiation.test.ts test/core/transfers/recommendations.test.ts`
(If `test/core/transfers/recommendations.test.ts` doesn't exist under that exact name, run `find test -iname "*recommend*"` first to get the right path.)
Expected: PASS.

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/transfers/negotiation.ts src/core/transfers/recommendations.ts test/core/transfers/negotiation.test.ts
git commit -m "A refusing Division 2 breakout player becomes purchasable via the existing transfer machinery"
```

---

## Task 9: Block the user's own Extend action for a refusing player

**Files:**
- Modify: `src/ui/context/LeagueContext.tsx`

**Interfaces:**
- Consumes: `wouldRefuseExtension` (Task 6), `deriveLeagueContexts` (`src/core/ai/clubContext.js`).

No new automated test for this task — `LeagueContext.tsx` has no existing test file in this codebase (confirm with `find test -iname "*LeagueContext*"` before starting; if one exists, follow its pattern and add coverage there instead of skipping this step). Verified instead via Task 10's UI change and a manual browser check in Task 11.

- [ ] **Step 1: Confirm there's no existing test file for this module**

Run: `find test -iname "*LeagueContext*"`
Expected: no results. If a result appears, stop and add a test there covering the blocked-extension case before proceeding to Step 2, following that file's existing patterns.

- [ ] **Step 2: Update `extendContractAction`**

Edit `src/ui/context/LeagueContext.tsx`, adding to the existing imports:

```ts
import { deriveLeagueContexts } from "../../core/ai/clubContext.js";
import { wouldRefuseExtension } from "../../core/ai/breakoutRefusal.js";
```

Replace:

```ts
  const extendContractAction = useCallback((pid: number) => mutate(
    (l) => ({ ...l, players: extendContract(l.players, pid, l.season) }),
  ), [mutate]);
```

with:

```ts
  const extendContractAction = useCallback((pid: number) => mutate((l) => {
    const player = l.players.find((p) => p.pid === pid);
    const team = l.teams.find((t) => t.roster.includes(pid));
    if (player && team) {
      const contexts = deriveLeagueContexts({
        teams: l.teams, players: l.players, season: l.season, played: l.played,
      });
      if (wouldRefuseExtension(player, team, l.teams, contexts)) return null;
    }
    return { ...l, players: extendContract(l.players, pid, l.season) };
  }), [mutate]);
```

(`mutate`'s existing contract — see `src/ui/context/LeagueContext.tsx`'s `mutate` definition — already treats a `null` return as a no-op, same pattern already used by `signFreeAgentAction`/`releasePlayerAction` elsewhere in this file, so this doesn't need any new plumbing.)

- [ ] **Step 3: Run the full test suite (no UI test framework is set up for this file, but confirm the rest of the suite still compiles/passes)**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/ui/context/LeagueContext.tsx
git commit -m "Block the user's Extend action for a Division 2 breakout player who'd refuse"
```

---

## Task 10: Show the refusal in the Roster UI instead of the Extend button

**Files:**
- Modify: `src/ui/pages/Roster.tsx`
- Modify: `src/ui/components/PitchField.tsx`

**Interfaces:**
- Consumes: `wouldRefuseExtension` (Task 6), `deriveLeagueContexts` (`src/core/ai/clubContext.js`).
- Produces: a new `refusingPids: Set<number>` prop on both `RosterTable` (already receiving `players`/`onExtend`/etc.) and `PitchField` (`PitchFieldProps`).

This is the user-facing half of Task 9 — showing *why* the Extend button is gone, proactively (before a click fails silently), rather than only blocking the action at the data layer.

- [ ] **Step 1: Compute `refusingPids` in the `Roster` component**

Edit `src/ui/pages/Roster.tsx`. Add to the imports:

```ts
import { useMemo } from "react";
import { deriveLeagueContexts } from "../../core/ai/clubContext.js";
import { wouldRefuseExtension } from "../../core/ai/breakoutRefusal.js";
```

(Merge `useMemo` into the existing `import { useState } from "react";` line rather than adding a second React import line: `import { useState, useMemo } from "react";`.)

Inside the `Roster` component, add a `useMemo` call **before** the existing `if (!league) { ... }` early return (React's rules of hooks require every hook to run unconditionally on every render — this must sit alongside the existing `useState` calls at the top of the function, not after any early return):

```ts
  const refusingPids = useMemo(() => {
    if (!league) return new Set<number>();
    const userTeam = league.teams.find((t) => t.tid === league.meta.userTid);
    if (!userTeam || userTeam.division !== 1) return new Set<number>();
    const contexts = deriveLeagueContexts({
      teams: league.teams, players: league.players, season: league.season, played: league.played,
    });
    return new Set(
      league.players
        .filter(
          (p) =>
            userTeam.roster.includes(p.pid) &&
            canExtend(p, league.season) &&
            wouldRefuseExtension(p, userTeam, league.teams, contexts),
        )
        .map((p) => p.pid),
    );
  }, [league]);
```

Place this immediately after the existing `const [showDepthChart, setShowDepthChart] = useState(false);` line and before `if (!league) { return <p className="p-3">Loading...</p>; }`.

- [ ] **Step 2: Thread `refusingPids` into `RosterTable` and its JSX**

Add `refusingPids: Set<number>;` to the `RosterTableProps` interface, and `refusingPids` to the destructured props in `RosterTable`.

Replace the Extend-button block:

```tsx
                  {canExtend(p, season) && (() => {
                    const terms = contractTerms(p, season);
                    return (
                      <button
                        className="btn btn-sm btn-outline-success text-nowrap"
                        onClick={() => onExtend(p.pid)}
                      >
                        Extend {terms.lengthSeasons}y &middot; {formatWeeklyWage(terms.salary)}
                      </button>
                    );
                  })()}
```

with:

```tsx
                  {canExtend(p, season) && (
                    refusingPids.has(p.pid) ? (
                      <span
                        className="text-muted small fst-italic text-nowrap"
                        title="He's holding out for a move to Division 1 and won't sign a new deal here."
                      >
                        Wants a move to Division 1
                      </span>
                    ) : (() => {
                      const terms = contractTerms(p, season);
                      return (
                        <button
                          className="btn btn-sm btn-outline-success text-nowrap"
                          onClick={() => onExtend(p.pid)}
                        >
                          Extend {terms.lengthSeasons}y &middot; {formatWeeklyWage(terms.salary)}
                        </button>
                      );
                    })()
                  )}
```

Then update both call sites in `Roster` that render `<RosterTable ... />` (there are two — one for starters, one for bench, both currently passing `onExtend={extendContractAction}`) to also pass `refusingPids={refusingPids}`.

- [ ] **Step 3: Thread `refusingPids` into `PitchField`**

Add `refusingPids: Set<number>;` to `PitchFieldProps` in `src/ui/components/PitchField.tsx`, and to the destructured props.

Replace the Extend-button block inside the actions popover (around the existing `canExtend(p, season) && (() => { ... })()` block shown at `PitchField.tsx:130-144`) with the same refusing/normal branch shown in Step 2, adapted to this component's `onClick` (which also calls `setOpenPid(null)`):

```tsx
                  {canExtend(p, season) && (
                    refusingPids.has(p.pid) ? (
                      <span
                        className="text-muted small fst-italic text-nowrap"
                        title="He's holding out for a move to Division 1 and won't sign a new deal here."
                      >
                        Wants a move to Division 1
                      </span>
                    ) : (() => {
                      const terms = contractTerms(p, season);
                      return (
                        <button
                          className="btn btn-sm btn-outline-success text-nowrap"
                          onClick={() => {
                            onExtend(p.pid);
                            setOpenPid(null);
                          }}
                        >
                          Extend {terms.lengthSeasons}y &middot; {formatWeeklyWage(terms.salary)}
                        </button>
                      );
                    })()
                  )}
```

Then update the `<PitchField ... />` call site in `Roster.tsx` to pass `refusingPids={refusingPids}` alongside its other existing props.

- [ ] **Step 4: Typecheck and run the full test suite**

Run: `npx tsc --noEmit` (or the project's typecheck script name from `package.json`) and `npx vitest run`.
Expected: both PASS. No test file exists for these two UI components today (confirm with `find test -iname "*Roster*" -o -iname "*PitchField*"`), so this step is a compile/regression check, not new coverage — manual browser verification happens in Task 11.

- [ ] **Step 5: Commit**

```bash
git add src/ui/pages/Roster.tsx src/ui/components/PitchField.tsx
git commit -m "Show 'wants a move to Division 1' instead of the Extend button for a refusing player"
```

---

## Task 11: Manual verification and CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md` (existing "Second division" section)

- [ ] **Step 1: Run the dev server and manually verify the refusal UI**

Use the project's `run` skill/dev-server workflow (see `CLAUDE.md`'s verification conventions) to load a save where the user's club is in Division 2, and set a roster player's ovr high enough (via whatever debug/dev path this project already supports for manual testing — check for an existing pattern before improvising) to trigger `wouldRefuseExtension`. Confirm:
- The Extend button is replaced with "Wants a move to Division 1" text on both the Roster page's table and the pitch-chip popover.
- Attempting the action does not silently succeed (verify via the browser, e.g. confirm the player's contract `expiresSeason` doesn't change).
- The player appears in Recommended Transfers / is offer-able via the Transfers page from another club's perspective, if practical to set up.

If a full manual browser walkthrough isn't practical in this environment, at minimum re-run the full automated test suite one final time (`npx vitest run`) and state explicitly that UI behavior wasn't independently browser-verified, rather than asserting it was.

- [ ] **Step 2: Confirm refusals actually fire, without dominating Division 2**

The spec requires this as an explicit check, not an optional nicety: refusals must fire sometimes (not dead code) but not so often that Division 2 can never retain a talented player at all.

Add a refusal counter to `scripts/divisionAudit.ts`: inside the per-season loop (right after the existing `league = simOffseason(league, rng);` line), before this season's rosters change further, count how many Division 2 players currently on a roster would satisfy `wouldRefuseExtension` against a freshly-derived `contexts` map for that season. Add these imports to the top of the script:

```ts
import { deriveLeagueContexts } from "../src/core/ai/clubContext.js";
import { wouldRefuseExtension } from "../src/core/ai/breakoutRefusal.js";
```

Inside the per-season loop, after the existing `simOffseason` call, add:

```ts
    const seasonContexts = deriveLeagueContexts(league);
    const playerByPid2 = new Map(league.players.map((p) => [p.pid, p]));
    let refusalCount = 0;
    let d2RosteredCount = 0;
    for (const t of league.teams.filter((t) => t.division === 1)) {
      for (const pid of t.roster) {
        const p = playerByPid2.get(pid);
        if (!p) continue;
        d2RosteredCount++;
        if (wouldRefuseExtension(p, t, league.teams, seasonContexts)) refusalCount++;
      }
    }
    if (s === SEASONS) {
      console.log(
        `D2 players who would currently refuse extension: ${refusalCount}/${d2RosteredCount}`,
      );
    }
```

Run: `npx tsx scripts/divisionAudit.ts`
Confirm, across all 3 seeds: the final tuned OVR/TOTS/solvency numbers from Task 4 still hold, AND the refusal count is non-zero (the mechanic is live) but a small minority of Division 2's roster (a handful of players, not dozens) — if it's zero every seed, `DIVISION_2_TARGET_D1_RANK`/`AI_MARKET_MIN_SURPLUS` combination may be too conservative to ever trigger; if it's a large fraction of the division, Division 2 can't retain any talent at all, undercutting the "still a real, playable division" goal from the spec. Report findings; do not silently retune `AI_MARKET_MIN_SURPLUS` (shared with Phase 2/3) to fix this without flagging it, since that constant affects the AI↔AI market and inbound offers too, not just this mechanic.

- [ ] **Step 3: Update CLAUDE.md's "Second division" section**

Add a new paragraph at the end of the existing "Second division (promotion/relegation)" section in `CLAUDE.md` (after its last bullet, the "Dynasty-audited constant tuning" one):

```markdown
**Retuned again (2026-07-15)** after a user report that Division 2's Team of the Season showed no real OVR gap against Division 1's — a 30-season dynasty audit confirmed it: the original "D2's best ≈ D1's average" generation target eroded further over a long dynasty (D2's strongest team ended up *exceeding* D1's average, and D2's TOTS came within ~2.6 OVR of D1's), driven by two effects: a too-generous generation-time offset, and `MAX_BUDGET` being a flat, undifferentiated ceiling — Division 2 clubs eventually banked as much as Division 1 clubs despite earning slower, closing the financial gap that should have let Division 1 clubs reliably outbid for Division 2 talent. Fixed with three changes: `DIVISION_2_OFFSET` is now derived from a target D1 finishing rank (`DIVISION_2_TARGET_D1_RANK`, tuned to <final value> via dynasty audit — see the "Dynasty audit" note above for the methodology) rather than pinned to `TEAM_STRENGTH_SPREAD`; `DIVISION_2_BUDGET_SCALE` dropped 0.6→0.4 and now also scales `MAX_BUDGET` itself (`clampBudget` gained a `division` parameter), not just season income; and a new mechanic (`wouldRefuseExtension`, `src/core/ai/breakoutRefusal.ts`) has a Division 2 player refuse to re-sign — blocking both AI auto-renewal and the user's own Extend action — once he'd already be a viable transfer target for some Division 1 club by the same evaluation bar Phase 2/3 use, immediately becoming transfer-listed as the payoff. Re-audited via `scripts/divisionAudit.ts`: Division 2's single strongest player lands around 70-75 OVR and its Team of the Season averages ~65, both at generation and after 30 simulated seasons, with no AI solvency regression at the tighter budget ceiling.
```

Replace `<final value>` with the actual tuned `DIVISION_2_TARGET_D1_RANK` from Task 4.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "Document the 2026-07-15 Division 2 weaker-dynasty retune in CLAUDE.md"
```

---

## Task 12: Final full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the complete test suite**

Run: `npx vitest run`
Expected: PASS, full suite, zero failures.

- [ ] **Step 2: Run the typecheck**

Run: `npx tsc --noEmit` (confirm exact command from `package.json`'s `scripts` block if different)
Expected: PASS, zero errors.

- [ ] **Step 3: Confirm the branch is clean and every task's commit is present**

Run: `git log --oneline -15`
Expected: one commit per task above (12 tasks → roughly 12 commits, possibly fewer if any steps were combined), all with clear messages, nothing uncommitted (`git status` shows a clean tree).
