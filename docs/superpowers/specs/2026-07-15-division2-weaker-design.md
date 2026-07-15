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
   (`DIVISION_2_BUDGET_SCALE`, being lowered from 0.6 to 0.4 as part of this
   change — see Fix 2) differs. A successful Division 2 club
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
who stays in Division 2 can still progress there. Fixes 1-2 address the
economics that make that upward pull possible in principle (a D1 club can
actually outspend a D2 club); Fix 3 (below) adds the missing piece — a
standout D2 player actively wanting that move, instead of passively staying
wherever he's generated/promoted, which today he has no reason to do.

## Target outcome (confirmed with user)

Both checked **at generation (season 1, since generated rosters already span
`INITIAL_AGE_MIN`-`INITIAL_AGE_MAX` and include players already in their
prime — a fresh league isn't a blank slate)** and **sustained through a long
dynasty (season 30)**, since the numbers should not drift upward over time
the way they currently do:

- Division 2's single strongest player, league-wide: **~70-75 OVR**
- Division 2's Team of the Season, average OVR across the XI: **~65**
- Division 2's total wage bill should drop *more than proportionally* to its
  OVR drop, since wages are a cubic function of OVR
  (`seasonSalaryForOvr`/`WAGE_WEEKLY_COEFF`, `src/core/contracts.ts`) — this
  is expected to fall out of Fix 1 automatically, with no new wage constant
  needed. It also helps rather than hurts Fix 2's tighter $120M ceiling,
  since a lower-OVR division needs less budget headroom to field a
  competitive squad in the first place.

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

## Fix 2 — division-scaled budget ceiling, at a tightened ratio

`DIVISION_2_BUDGET_SCALE` (`src/core/constants.ts`) is lowered from **0.6 to
0.4**, per explicit user request — Division 2's money-in (base allocation,
prize tiers) drops from 60% to 40% of Division 1's.

`clampBudget` (`src/core/finance/budget.ts`) gains a `division: 0 | 1`
parameter, capping Division 2 at `MAX_BUDGET * DIVISION_2_BUDGET_SCALE`
(**$120M** at the new 0.4x, down from the $180M a straight reuse of the old
0.6x would have given) instead of sharing Division 1's $300M ceiling. Still
reuses the single `DIVISION_2_BUDGET_SCALE` constant for both income rate
and ceiling rather than introducing a second constant, per the earlier
"start simple" preference — just at the new, lower ratio.

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
3. Apply Fix 2 (budget ceiling at the new fixed 0.4x/$120M) alongside Fix 1,
   since both affect the same measurements — tune them together rather than
   in isolation. Unlike `DIVISION_2_OFFSET`, `DIVISION_2_BUDGET_SCALE` is a
   direct user requirement (0.4), not a free tuning variable — but the audit
   must still confirm it doesn't break Division 2 AI solvency at that
   tighter ratio (a real risk: `DIVISION_2_BUDGET_SCALE` was previously
   raised 0.5→0.6 specifically because 0.5 produced small AI deficits — see
   the second-division design doc's dynasty-audit note. 0.4 revisits territory
   already shown to be too tight once, so if the audit finds deficits, that's
   a signal to escalate back to the user rather than silently picking a
   different number).
4. Iterate `DIVISION_2_OFFSET` until both season-1 and season-30 numbers
   land in range (~70-75 max, ~65 TOTS average) across multiple seeds,
   without making Division 2 clubs unable to transact at all.
5. Re-check Division 1's numbers are unaffected (should be, since none of
   Division 1's own constants change) and that the pre-existing OVR
   equilibrium invariants elsewhere in the game (documented in `CLAUDE.md`)
   still hold.

## Fix 3 — a D2 breakout player refuses to re-sign, hoping to move up

New mechanic, orthogonal to Fixes 1-2: once a Division 2 player (`division
=== 1`, per this codebase's indexing) has genuinely outgrown his level, he
should refuse to sign a new deal with his current club — mirroring real
feeder-league drama (a Championship player forcing a move by refusing
terms) rather than just quietly sitting in D2 forever.

**Trigger** (confirmed with user): not an arbitrary OVR bar, but tied to
actual Division 1 interest — reusing the exact machinery Phase 3 (inbound
offers) already uses to answer "would some other club actually want to buy
this player":

- For each Division 1 club, compute its `ClubContext` (`deriveLeagueContexts`,
  already scoped per-division) and `perceivedValueToClub(player, ctx, jitter)`
  (`src/core/ai/evaluate.ts`).
- A player refuses to extend if the best such D1 valuation clears his value
  to his *current* club by `AI_MARKET_MIN_SURPLUS` (same bar Phase 2/3 use)
  **and** that D1 club could actually afford him without dipping into its
  cash reserve (`buyerSpendable`, the same helper `inboundOffers.ts` already
  has). In other words: he refuses exactly when he'd already be a viable
  Phase-3-style inbound-offer candidate, just evaluated against Division 1
  clubs specifically rather than his own division.
- This is a genuinely emergent trigger, not a new threshold constant — a
  16-year-old with a big single-season jump won't trigger it if no D1 club
  can afford/justify him yet; a proven 24-year-old D2 star will.

**Persistence** (confirmed with user): computed live, not stored. No new
`Player` field, no save migration — consistent with how `isForSale`,
`ClubContext`, and the rest of the AI evaluation core already work (derived
from current state every time it's checked, not cached). If D1 interest
later cools (he regresses, D1 clubs saturate their budgets elsewhere), the
refusal condition simply stops applying next time it's checked.

**Scope** (confirmed with user): applies everywhere an extension could
happen, not just AI clubs:
- `runAIContractRenewals` (`src/core/ai/renewals.ts`) — skip auto-renewal
  for a qualifying player instead of unconditionally renewing.
- `extendContractAction` (`src/ui/context/LeagueContext.tsx`, wrapping
  `extendContract` in `src/core/contracts.ts`) — the user's own one-button
  Extend action is blocked for a qualifying player on the user's own D2
  club, with a UI message (e.g. "X is holding out for a move to Division 1
  and won't sign a new deal here") rather than silently failing.

**Consequence** (confirmed with user): refusing immediately makes him
transfer-listed — his club would rather cash in than risk losing him for
free at expiry. This needs to plug into whatever candidate pool
`recommendedTransfers.ts` and the AI↔AI market draw from, which currently
gate on `isForSale(seller, players, pid)` (`src/core/transfers/negotiation.ts`).
`isForSale` doesn't currently have access to league-wide division/context
data to run this check itself — how exactly to wire the two together
(widen `isForSale`'s signature vs. an additive check at each of its call
sites) is left as an implementation-plan decision, not resolved here.

**Non-goals:** no equivalent mechanic for Division 1 players (e.g. wanting
to join a bigger/richer D1 club) — scoped specifically to the D2-outgrows-
his-level scenario described. No change to how a *sale* (as opposed to an
extension) is negotiated once he's listed — normal transfer negotiation
rules apply from there.

## Testing

**Fixes 1-2 (tuning):**
- Extend `scripts/divisionAudit.ts` with the two new per-seed metrics above
  (D2 max OVR, D2 TOTS average OVR) at both season 1 and season 30, plus a
  D2-vs-D1 wage bill ratio to confirm the expected cubic drop actually
  happens rather than just asserting it should.
- Re-run the existing test suite unchanged (no schema change; confirmed no
  test asserts `clampBudget`'s signature/return value directly, or
  `DIVISION_2_OFFSET`'s/`DIVISION_2_BUDGET_SCALE`'s literal values — the
  three existing `DIVISION_2_BUDGET_SCALE` references in
  `test/core/finance/budget.test.ts` all compare symbolically against the
  constant itself, so they stay green at either 0.6 or 0.4).
- Manual/dynasty-audit verification only for the tuning itself; no new unit
  tests are expected to be needed since this is constant retuning within
  existing, already-tested mechanisms (generation, budget clamping).

**Fix 3 (refusal mechanic):**
- New unit tests for the refusal-trigger function itself: a D2 player with
  no qualifying D1 interest can still extend normally; one who clears
  `AI_MARKET_MIN_SURPLUS` against an affording D1 club cannot, and shows up
  as `isForSale`.
- `runAIContractRenewals` test coverage for the skip-instead-of-renew path.
- `extendContractAction` test coverage (or an integration-level test) for
  the user's own blocked-extension path and the UI-facing message.
- Dynasty-audit spot check: over a long run, confirm refusals actually fire
  sometimes (not dead code) without becoming so common that Division 2
  rosters can never retain a talented player at all — that would undercut
  Fixes 1-2's goal of Division 2 still being a real, playable division with
  its own developing stars, not just a conveyor belt to Division 1.
