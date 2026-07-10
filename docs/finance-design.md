# Finance Design

How finances are meant to work in soccer-gm, as originally written up in the
"Details" context doc. This is the reference the M6 implementation follows;
constants live in `src/core/constants.ts`, logic in `src/core/finance/`.

## Transfer windows

Two transfer periods per season, mirroring the real-world FIFA setup: a longer
window between seasons and a shorter one mid-season. Real leagues vary the
exact dates; we pick one fixed timing and repeat it every season (mid-season
window closing around matchday 22, the existing "deadline" sim target).

## How clubs get money

1. Each club has a single pot of money spent on contracts, transfers, and
   scouting (`StoredTeam.budget`).
2. A **base amount** is allocated by the league to every club equally each
   season (`BASE_SEASON_BUDGET`).
3. **Domestic success** earns clubs prize money on top of the base, in three
   exclusive tiers: one prize for winning the league (`PRIZE_CHAMPION`), a
   second tier for finishing top 5 (`PRIZE_TOP_5`, 2nd–5th), and a third for
   finishing top 10 (`PRIZE_TOP_10`, 6th–10th). The bottom half of the table
   gets the base allocation only. European competition payouts are a possible
   later addition; the game currently has one domestic league.
4. Unlike real life, where leagues have wildly different spending power, all
   clubs should be **fairly paid** — the equal base dominates, success payouts
   are the main spread.
5. Like BGM, a **hype meter** (0–100, `StoredTeam.hype`) reflects fame and
   drives ticket/jersey sales revenue. Famous clubs inherently sell more, so
   to keep things fair this channel is deliberately damped — jersey-sale
   profit must not contribute TOO much to the budget
   (`HYPE_REVENUE_PER_POINT × HYPE_REVENUE_DAMPING`, capped well below the
   success-payout spread).

**No deficits, ever.** Clubs in this game never lose money. The base
allocation alone exceeds the maximum possible season expenses (full roster of
ceiling-ovr wages plus max scouting spend), so budgets only grow. This is a
tested invariant (`test/core/finance/budget.test.ts`), not a clamp.

## How transfers work

1. A **"Recommended Transfers" page** lists 5–10 players of similar overall
   level to the user's team and within budget.
2. Each season the user decides how much to allocate to **scouts**
   (`scoutingSpend`, a slider from £0 to `SCOUTING_SPEND_MAX`). Better scouts
   give better recommendations and more accurate transfer valuations
   (`perceivedTransferValue` noise shrinks with spend), which the user uses as
   the baseline for offers.
3. During transfer windows the user can **offer money** to another club for a
   player. The receiving club can reject outright and refuse further talks
   (if the offer is way off, or the user repeatedly lowballs counter-offers),
   propose a counter-offer, or accept.
4. Once a player is bought, their **contract is not negotiated** — too
   complicated. All contracts in the game work the same way: when a contract
   is up or needs extending, a single "extend"/"sign" button shows the weekly
   wages and the contract length. (Stored `contract.salary` is the per-season
   total; the UI presents it weekly.)

## Implementation status

| Piece | Status |
| --- | --- |
| Budget, hype, scouting spend on teams; season settlement | ✅ M6 phase 1–2 |
| Transfer valuation (`trueTransferValue` / `perceivedTransferValue`) | ✅ M6 phase 1–2 |
| Dashboard Finances card + scouting slider | ✅ M6 phase 1–2 |
| Transfer windows, Recommended Transfers page, offer/counter negotiation | ⏳ phases 3–7 |
| One-button contract extend/sign (weekly wage display) | ⏳ phases 3–7 |
| Hype affecting free-agent appeal | possible later addition |
