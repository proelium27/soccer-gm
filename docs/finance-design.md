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

**Wages are paid up front at each season's start** (league creation
included): the base allocation arrives and the squad's season wages come
straight out of it (`chargeSeasonStart`), so a club's in-season cash is
genuinely spendable — the game can never let you spend money your wages
needed. Season-end settlement (`settleSeasonEnd`) handles only performance
money: success payout + hype revenue − scouting spend. A brand-new club
therefore starts with `BASE_SEASON_BUDGET − its initial wage bill`
(~50-65M; expensive squads start with less spare cash), and players
acquired mid-season (transfer buys or free-agent signings during the
regular phase) charge their full season salary at acquisition on top of any
fee — clubs eat the year's wages on mid-season signings. Offseason
additions are covered by the upcoming season-start charge.

**No AI deficits, ever.** AI clubs in this game never lose money. The base
allocation alone exceeds the wage bill of a benchmark squad stronger than
anything AI free agency + progression assembles (`WAGE_SAFE_SQUAD`, shaped
from 25-season dynasty audits; AI clubs never spend on scouting), so AI
budgets only grow. This is a tested invariant
(`test/core/finance/budget.test.ts`), not a clamp. Since the 2026-07-11 cubic
wage rework, a *user* deliberately hoarding a ROSTER_CAP squad of elite
players can outspend the base — the Finance page's settlement projection
shows the shortfall before it lands.

**Wages** (2026-07-11 rework): weekly wage = `WAGE_WEEKLY_MIN +
WAGE_WEEKLY_COEFF × (ovr − WAGE_OVR_FLOOR)³`, times a deterministic
per-signing ±`WAGE_VARIATION` roll, rounded to £100 and stored as the
per-season total (×52). Calibrated to the Premier League on the
post-rebalance ovr scale: ~£22k/wk at 60 ovr, ~£41k at 65, ~£70k at 70,
~£109k at 75, ~£162k at 80, ~£314k at 90. The cubic replaces the original
flat 20k-per-ovr placeholder, whose 23k→34k/wk range never separated
superstars from squad players.

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
| Transfer windows (summer: offseason + matchdays 1–4; winter: 18–22) | ✅ M6 phases 3–7 |
| Recommended Transfers page (5–10 targets, scouting-scaled quality) | ✅ M6 phases 3–7 |
| Offer/counter negotiation (hidden reservation price, walk-aways) | ✅ M6 phases 3–7 |
| One-button contract extend/sign (weekly wage display, age-based length) | ✅ M6 phases 3–7 |
| AI↔AI transfers, inbound offers for user players | possible later addition |
| Hype affecting free-agent appeal | possible later addition |
