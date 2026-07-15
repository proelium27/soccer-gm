# Division 2 stays meaningfully weaker over a full dynasty

Date: 2026-07-15

## Problem

The second-division feature (`docs/superpowers/specs/2026-07-14-second-division-design.md`)
was tuned so Division 2's strongest team lands around Division 1's *average*
team at generation time. In practice, over a long dynasty, Division 2 talent
converges further toward Division 1 rather than staying separated — verified
with real simulation, not just a code read:

- A 30-season dynasty audit (`scripts/divisionAudit.ts`, 3 seeds) showed D2's
  strongest team's average roster OVR (68-70) now *exceeds* D1's average team
  (66.5-67.5) — the gap the original tuning targeted has already inverted.
- An ad-hoc Team-of-the-Season check across the same simulated league showed
  D1 TOTS mean OVR ~80 vs D2 TOTS mean ~77.4 after 30 seasons — only a ~2.6
  point gap, with D2's single best TOTS player (89) outscoring D1's best (84)
  in one run.

Two independent causes, both confirmed in code:

1. **Generation-time gap is too generous.** `DIVISION_2_OFFSET` targets "D2's
   best team ≈ D1's average team" (`src/core/constants.ts`), which was too
   close a target once other erosion effects are added on top.
2. **Financial gap erodes to zero.** `MAX_BUDGET` ($300M, `src/core/finance/budget.ts`)
   is a flat cap regardless of division — only the *inflow rate*
   (`DIVISION_2_BUDGET_SCALE` = 0.6) differs. A successful Division 2 club
   eventually reaches the same ceiling as any Division 1 club and can retain
   or outbid for its own breakout talent, instead of losing it upward the way
   a real feeder league would (Championship-sells-to-Premier-League
   dynamics). `deriveLeagueContexts` also normalizes wealth/ambition
   *within* each division separately (existing, correct behavior for other
   reasons — see the second-division design doc), so a maxed-out D2 club
   reads as just as confident/willing-to-spend as a maxed-out D1 club once
   both hit the same absolute ceiling.

Promotion/relegation (whole-club roster swaps) is **not** identified as a
problem to fix — it's realistic and intentional. The goal is specifically
that an individual standout player in Division 2 should tend to get bought
up to Division 1, the way real feeder-league economics work, while a player
who stays in Division 2 can still progress there.

## Target outcome (confirmed with user)

Both checked **at generation (season 1, since generated rosters already span
`INITIAL_AGE_MIN`-`INITIAL_AGE_MAX` and include players already in their
prime — a fresh league isn't a blank slate)** and **sustained through a long
dynasty (season 30)**, since the numbers should not drift upward over time
the way they currently do:

- Division 2's single strongest player, league-wide: **~70-75 OVR**
- Division 2's Team of the Season, average OVR across the XI: **~65**

## Fix 1 — widen the generation-time offset, derived not hardcoded

New constant `DIVISION_2_TARGET_D1_RANK = 16` (out of `NUM_TEAMS` = 20).
`DIVISION_2_OFFSET` becomes a formula instead of a value pinned equal to
`TEAM_STRENGTH_SPREAD`:

```
DIVISION_2_OFFSET = ((DIVISION_2_TARGET_D1_RANK - 1) / (NUM_TEAMS - 1)) * 2 * TEAM_STRENGTH_SPREAD
```

With current constants (`TEAM_STRENGTH_SPREAD` = 9), this evaluates to
`(15/19) * 18 ≈ 14.2`, up from 9 today. This is a **starting point for
empirical tuning, not a final value** — see Tuning approach below.

Self-correcting if `TEAM_STRENGTH_SPREAD` or the division sizes are retuned
again later. `DIVISION_2_OFFSET` has already drifted out of sync with
`TEAM_STRENGTH_SPREAD` once before (see the M1 milestone history in
`CLAUDE.md`); deriving it from a target rank instead of a literal closes that
failure mode permanently.

## Fix 2 — division-scaled budget ceiling

`clampBudget` (`src/core/finance/budget.ts`) gains a `division: 0 | 1`
parameter, capping Division 2 at `MAX_BUDGET * DIVISION_2_BUDGET_SCALE`
($180M) instead of sharing Division 1's $300M ceiling. Reuses the existing
0.6x factor rather than introducing a second constant, per user preference
(start simple, retune independently later only if audits show it's wrong).

Four call sites need the division threaded through, all with the relevant
team object already in scope:

- `chargeSeasonStart` / `settleSeasonEnd` (`finance/budget.ts`) — already
  take `division`; just pass it into `clampBudget` too.
- `executeTransfer`'s seller-side credit (`transfers/negotiation.ts`) — has
  `t` (the selling team, with `.division`) in scope.
- The AI↔AI market's seller-side credit (`ai/transferMarket.ts`) — needs a
  division lookup for `sellerTid` via the existing `teams`/`contexts` map
  already in scope.

A relegated club whose banked budget already exceeds the new lower cap is
**not** forcibly clawed back — consistent with the existing rule that the
cap only blocks further banking, never spending or existing balance.

## Non-goals

- No change to promotion/relegation mechanics.
- No new "prestige" valuation mechanic in the AI evaluation core — the
  existing wealth-driven `valueToClub` logic should behave like a feeder
  market once the financial gap (Fix 2) and generation-time gap (Fix 1) are
  both real.
- No change to Division 1's tuning.

## Tuning approach

`DIVISION_2_OFFSET`'s exact value cannot be derived in closed form — it
depends on the interaction of generation, progression (age curves, form
rolls, `developmentBias`, `growthDamping`), promotion/relegation churn, and
the AI transfer market, none of which reduce to a formula. It must be found
empirically, the same way every other generation/progression constant in
this codebase was calibrated (see the M1/M4 milestone history in
`CLAUDE.md`):

1. Start `DIVISION_2_OFFSET` from the rank-16 formula (~14.2) as a first
   guess.
2. Extend `scripts/divisionAudit.ts` to report, per seed: Division 2's
   single max player OVR, and Division 2's Team-of-the-Season average OVR
   (reusing `computeSeasonAwards`) — both at season 1 (generation) and at
   season 30 (steady state).
3. Apply Fix 2 (budget ceiling) alongside Fix 1, since both affect the same
   measurements — tune them together rather than in isolation.
4. Iterate `DIVISION_2_OFFSET` (and, if needed, `DIVISION_2_BUDGET_SCALE`)
   until both season-1 and season-30 numbers land in range
   (~70-75 max, ~65 TOTS average) across multiple seeds, without breaking
   Division 2 AI solvency (the existing invariant — no AI club should ever
   run a deficit) or making Division 2 clubs unable to transact at all.
5. Re-check Division 1's numbers are unaffected (should be, since none of
   Division 1's own constants change) and that the pre-existing OVR
   equilibrium invariants elsewhere in the game (documented in `CLAUDE.md`)
   still hold.

## Testing

- Extend `scripts/divisionAudit.ts` with the two new per-seed metrics above
  (D2 max OVR, D2 TOTS average OVR) at both season 1 and season 30.
- Re-run the existing test suite unchanged (no schema change; confirmed no
  test asserts `clampBudget`'s signature/return value directly or
  `DIVISION_2_OFFSET`'s literal value — only `DIVISION_2_BUDGET_SCALE`,
  which Fix 2 reuses unchanged).
- Manual/dynasty-audit verification only for the tuning itself; no new unit
  tests are expected to be needed since this is constant retuning within
  existing, already-tested mechanisms (generation, budget clamping).
