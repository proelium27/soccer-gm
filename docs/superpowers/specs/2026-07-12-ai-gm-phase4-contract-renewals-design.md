# AI GM realism, phase 4: contract renewals (and replace-aging as emergent behavior)

Status: approved by user, ready for implementation planning.

## Context

The "AI General Manager realism" effort (see CLAUDE.md) replaces scripted AI
behavior with a Basketball-GM-style evaluation system: a club's strategy
emerges from `deriveLeagueContexts`/`valueToClub` (phase 1), not hand-authored
rules. Phases 1-3 are merged: evaluation core, AI↔AI transfers
(`runAITransferMarket`), and AI inbound offers for the user's players.

The original phase-4 scope (per CLAUDE.md's planned spine) was "long-term
behavior (contract renewals, sell-at-peak, replace-aging)." Investigation
during brainstorming found:

- **Sell-at-peak already exists.** Phase 2's `runAITransferMarket` already
  sells a player once his keep-value (`valueToClub` at his own club) drops
  below what another club will pay — no new code needed.
- **Contract renewals do not exist and are a real gap.** Today a contract
  just expires (`releaseExpiredContracts` in `simOffseason`, step 1): the
  player is dumped into the open free-agent pool with zero priority for his
  current club. `runAIFreeAgency` only reacts to positional shortfalls
  against `ROSTER_COMPOSITION` — it has no notion of "this is my good player,
  keep him." A club can lose a starter to expiry purely because no position
  happened to be short that offseason, then fail to re-sign him if another
  club (or nobody) picks him first from the pool.
- **"Replace-aging" is not a separate mechanic worth building.** If renewals
  are value-driven, an aging/declining player naturally fails the renewal
  bar, walks, and the existing free-agency/transfer-market machinery fills
  the resulting hole — exactly the project's "behavior emerges from
  `valueToClub`, not scripts" philosophy already used for phases 1-3.

So phase 4's actual scope is: **proactive contract renewals**, decided the
season before a contract would otherwise expire, using `valueToClub` as the
keep/let-go bar. Nothing else needs building.

## Design

### New function: `runAIContractRenewals`

New file `src/core/ai/renewals.ts`, mirroring the shape of
`src/core/ai/transferMarket.ts` (a pure function over the evaluation core,
no new sub-state):

```ts
export function runAIContractRenewals(
  teams: StoredTeam[],
  players: Player[],
  nextSeason: number,
  userTid: number,
  playedThisSeason: PlayedMatch[],
): { teams: StoredTeam[]; players: Player[] }
```

**Trigger.** For every club except `userTid`, for every player on that
club's roster where `canExtend(player, nextSeason)` is true (`src/core/
contracts.ts` — his current deal's *last* season is the one about to start).
This reuses the existing helper the user's own one-button renew UI already
calls; no new "is this his final season" logic.

**Decision.** Build club contexts once via
`deriveLeagueContexts({ teams, players, season: nextSeason, played:
playedThisSeason })` (same `LeagueSnapshot` shape phases 2/3 already build,
forward-looking to `nextSeason` the way the transfer market values for the
season about to be played). For each eligible player:

```
renew ⇔ valueToClub(player, ctx) ≥ contractTerms(player, nextSeason).salary × AI_RENEWAL_MARGIN
```

- `valueToClub` (phase 1) already folds in positional need, age×ambition
  timeline fit, *and* affordability (a frugal/poor club already discounts
  value on deals it can't comfortably carry) — so there is deliberately no
  separate budget gate here. A cash-strapped club lets pricier players walk
  because their value-to-club is already suppressed, not because of a second
  check duplicating that logic.
- `contractTerms(player, nextSeason).salary` (existing helper) is the new
  wage he'd command if extended today — same cubic-wage formula used
  everywhere else in the game, no new pricing.
- `AI_RENEWAL_MARGIN` is the one new tuning constant (new "AI contract
  renewals" section in `src/core/constants.ts`, alongside the existing "AI
  evaluation core" / "AI↔AI transfer market" sections). Starting value
  ~1.0-1.2 (a small required margin, not a break-even bar) — pending
  dynasty-audit tuning per the Testing section below.

**Effect of the decision:**
- Renew → `extendContract(players, pid, nextSeason)` (existing helper — same
  one the user's UI uses). New terms take effect immediately; the roster is
  otherwise untouched.
- Don't renew → no-op. The player keeps his existing contract (which still
  expires at the end of the season about to be played) and plays that season
  out normally. He may still be sold earlier via the existing AI transfer
  market (sell-at-peak, already-existing behavior, no change), or — if
  still on the roster at the following offseason — falls through to
  `releaseExpiredContracts` exactly as today. **This is where "replace-
  aging" comes from**: no separate succession step, no lookahead — an old
  player who's no longer worth his wage simply isn't kept, and whatever
  positional hole that opens is filled by the existing
  `runAIFreeAgency`/`runAITransferMarket` machinery the same way any other
  vacancy is.

Deterministic — no `rng` parameter, no RNG-stream consumption. Unlike the
open "youth intake position weighting" question in CLAUDE.md, this cannot
shift any downstream random roll, so it carries none of that risk.

### Integration point

New **step 0** in `simOffseason` (`src/core/offseason.ts`), before the
existing step 1 (`releaseExpiredContracts`) and therefore before AI free
agency and the summer transfer market too — so a club's later steps never
plan around losing a player it was actually about to keep.

```
0. runAIContractRenewals   ← new
1. releaseExpiredContracts
2. progressPlayer (progression)
3. rollRetirement
3.5. settleSeasonEnd / updateHype
4. runAIFreeAgency
5. generateYouthIntake
6. trimRosterSurplus
6.4. runAITransferMarket (summer)
6.5. chargeSeasonStart
7. new schedule
```

Contexts for the renewal decision are derived from state *before*
progression/retirement/free-agency run — a real GM decides based on what he
sees at the point of decision, not on next season's development, which
mirrors how the transfer-market steps already work relative to each other.

### Scope boundaries (explicitly not building)

- No separate "replace-aging" mechanic — see above, it's emergent.
- No budget/affordability gate beyond what `valueToClub` already bakes in.
- No renewal negotiation, counter-offers, or player-side refusal — matches
  the project's existing "contracts are never negotiated" one-button design
  (`contractTerms`'s own doc comment).
- No change to the user's own contract-renewal flow (already manual,
  untouched, `signFreeAgent`/`extendContract` unaffected).
- Winter window: contracts only expire/renew at the offseason boundary
  today (no in-season contract-year tracking), so renewals only need to run
  once per offseason, not per transfer window.

## Testing

- **Unit tests** (new, alongside existing `freeAgency`/`ai` test files):
  - A player whose `valueToClub` clears the margin in his final contract
    season gets renewed (new `expiresSeason`, new `salary`).
  - A player who doesn't clear the margin is left with his original,
    still-expiring contract.
  - A player *not* in his final season (`canExtend` false) is untouched
    regardless of value.
  - The user's team (`userTid`) is never touched by this function.
  - Renewal computed purely from inputs — same inputs ⇒ same outputs (no
    hidden randomness).
- **Integration**: `simOffseason` runs the new step before
  `releaseExpiredContracts`, verified by a case where a player's final-
  season contract would otherwise expire that same offseason but instead
  gets renewed and survives into the next roster.
- **Dynasty audit** (same methodology used to validate phases 1-3 and the
  OVR-rebalance/progression work): a from-scratch multi-season (~40 seasons
  × a few seeds) run of real `simThrough`/`simOffseason` checking:
  - No AI club goes into deficit (existing invariant, now with one more
    budget-touching lever).
  - League-wide OVR distribution stays at its existing equilibrium (mean
    ~58, 80+ under ~2%, 90+ ~0%) — renewals shouldn't change *who* stays in
    the league, only *whether* an individual keeps his current club, so no
    inflationary effect is expected, but this is worth confirming.
  - AI roster sizes stay within existing bounds (`ROSTER_CAP`,
    `ROSTER_COMPOSITION` after `trimRosterSurplus`).
  - Directionally sensible outcomes: a club's own high-value starters get
    renewed at a meaningfully higher rate than they would have survived to
    re-sign under the old "hope free agency picks him back up" behavior.
  Used to sanity-check/tune `AI_RENEWAL_MARGIN`, same as prior phases tuned
  their constants against dynasty audits rather than guessing a value.

## Docs

Once implemented and merged, update CLAUDE.md's "AI General Manager
realism" section: mark phase 4 done, correct the original phase-4
description (drop "sell-at-peak"/"replace-aging" as if they were new work,
since they're pre-existing/emergent — see Context above) to just "contract
renewals," and fold in the new function/file names the way phases 1-3 are
documented.
