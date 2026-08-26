# Finance Design

How finances are meant to work in soccer-gm, as originally written up in the
"Details" context doc. This is the reference the M6 implementation follows;
constants live in `src/core/constants.ts`, logic in `src/core/finance/`.

**Scope note.** This describes the *design intent* of the finance layer and is
still accurate about how the pieces fit together. It is not a running ledger —
plenty has been built on top since M6 (the AI transfer market, the Continental
Cup's prize money, per-country `financeScale`, transfer-value rescales), and
individual constants get retuned without this file being touched. **CLAUDE.md's
"Finance" section is the current record; when the two disagree, believe
CLAUDE.md, and check any number here against `constants.ts` before relying on
it.**

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
   gets the base allocation only. Cup prize money was added later — the
   Continental Cup and Shield pay participation, playoff-win and
   per-knockout-round money, and domestic cups pay by round too (`core/cup/`).
4. Within one competition, clubs should be **fairly paid** — the equal base
   dominates and success payouts are the main spread. *Across* competitions
   this stopped being true when the weaker countries arrived: every income
   channel is multiplied by `financeScale` (`COUNTRY_BUDGET_SCALE` per country
   × tier), so France, Portugal, Belgium and Turkey are deliberately poorer as
   well as weaker. That scale **must stay monotonic with
   `COUNTRY_STRENGTH_OFFSET`**, or a richer-but-weaker league climbs the ladder
   over a dynasty — see CLAUDE.md's "World / leagues" section.
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
therefore starts with `BASE_SEASON_BUDGET × financeScale − its initial wage
bill` (expensive squads start with less spare cash; the poorest clubs in the
world open around £13-16M, per `scripts/genBudgetProbe.ts`), and players
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

**Wages** (2026-07-11 rework, rescaled 2026-07-13): weekly wage =
`WAGE_WEEKLY_MIN + WAGE_WEEKLY_COEFF × (ovr − WAGE_OVR_FLOOR)³`, where the
cubic *merit* term (not the whole wage) is multiplied by a deterministic
per-signing ±`WAGE_VARIATION` roll, rounded to £100 and stored as the
per-season total (×52). At the mid-point of the variation band that gives
~£11.4k/wk at 60 ovr, ~£21.3k at 65, ~£36.1k at 70, ~£56.8k at 75,
~£84.3k at 80, ~£119.5k at 85, ~£163.6k at 90. The cubic replaces the
original flat 20k-per-ovr placeholder, whose 23k→34k/wk range never
separated superstars from squad players.

*(These figures were halved by the 2026-07-13 rescale, which scaled the
coefficients alongside the `BASE_SEASON_BUDGET` cut. If they ever look
wrong, recompute from `constants.ts` rather than trusting the prose —
that is exactly how they went stale once.)*

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
| AI↔AI transfers (`core/ai/transferMarket.ts`) | ✅ shipped post-M6 |
| Inbound offers for user players (`core/transfers/inboundOffers.ts`) | ✅ shipped post-M6 |
| Hype affecting free-agent appeal | still not built |
