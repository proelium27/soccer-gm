# More Leagues Around the World — Design

**Date:** 2026-07-16
**Status:** Approved design, pending implementation plan
**Prior art:** "Hard Feature Design Notes (Claude brainstorm)" Google Doc §5 flagged this feature as underspecified with three possible scopes; this spec resolves that via a clarifying conversation with the user. Builds directly on the shipped second-division work (see CLAUDE.md's "Second division (promotion/relegation)" section).

## Scope (decisions made with the user)

- **Interactive world**: foreign leagues genuinely exist, simulate every season, and participate in one global transfer market. Not flavor-only, not a continental cup.
- **Three countries at launch**: England, Spain, Italy. Each is a full two-division pyramid (20 clubs per division, 3-up/3-down promotion/relegation within its own country) — 6 competitions, 120 clubs, ~3,000 players per save.
- **Equal siblings**: every country's Division 1 generates at the same strength band and uses the same budget constants as today's English Division 1; same for Division 2s. No flagship-rich-league tiering (deliberately avoids re-fighting the D2 OVR-drift war internationally). Differentiation is a possible future pass.
- **Pick any club at creation**: the new-save flow lets the user choose a country, then any of its 40 clubs (including a second-division start). No mid-save club switching (out of scope; no such mechanic exists domestically either).
- **One global market**: the AI↔AI transfer market, free agency, inbound offers, and recommended transfers operate over all countries with no home bias. This is free by construction — none of those systems have a geography concept today.
- **New saves only**: existing saves stay England-only forever. No mid-dynasty world expansion.

## Architecture: competitions as data (approach A)

Today a team's league is the literal number `0` or `1` (`division: 0 | 1` on `LeagueTeam`/`StoredTeam`), and many systems hardcode the two-slot assumption (awards tuples, finance signatures, promotion pairs, AI-context splits).

This design replaces that with a first-class **competitions table** in `LeagueStore` (persisted):

```ts
interface Competition {
  id: number;        // compId — what teams point at
  country: string;   // "England" | "Spain" | "Italy"
  tier: 1 | 2;       // drives finance scaling + promotion/relegation pairing
  name: string;      // "English Division 1", "Spanish Division 2", ...
}
```

- Teams' `division: 0 | 1` field becomes `compId: number`. Tier is always looked up from the competition — nothing else stores it.
- Every "do X for division 0, then division 1" site becomes "do X per competition" (or "per country" for promotion/relegation). Each touched site gets simpler, and adding a country later is data + club identities, not a refactor.
- Rejected alternatives: (B) bolt a `country` field next to `division` — touches nearly the same files but re-bakes hardcoded pair/triple assumptions into a messier two-dimensional shape; (C) three independent league stores with a transfer bridge — forfeits the free global market and triples offseason orchestration.

### Save migration (old saves)

Backfill `competitions: [England D1 (id 0), England D2 (id 1)]` in `migrateLeague`; existing teams' `division` values 0/1 are already valid compIds, so the rename is mechanical and nothing else changes. Old saves simply have a 2-entry table. `SeasonHistoryEntry` migration below.

## Data model & generation

- **Clubs**: `CLUBS` grows 40 → 120. Indices 40-79 Spanish-flavored, 80-119 Italian-flavored fictional identities (invented place names in each country's style — same trademark-cautious rule as the English set; no real-club soundalikes), each with abbreviation and colors. Customize Teams works unchanged.
- **Player nationality flavor**: players already carry `nationality` with per-country name pools (`src/core/players/nationalities.ts`); today generation draws from one Premier-League-weighted distribution. Each competition (or country) gets its own nationality weight table reusing the existing pools — Spanish leagues draw Spanish-heavy with a realistic foreign mix, etc. Missing pools (verify Spain/Italy exist; add if not) get added in the same style.
- **Generation**: `generateWorld(seed)` loops the competitions table calling the existing `generateDivisionTeams` per entry — tier 1 at today's D1 band, tier 2 with the existing `DIVISION_2_OFFSET`, identical in every country. `academyBase` anchoring works per-team exactly as today.
- **Known, accepted**: per-competition nationality weighting changes RNG consumption, so a new save's English clubs are not byte-identical to today's generation for the same seed. Only affects tests pinned to exact outputs (new saves only; no live-save impact).

## Season loop

- **Shared calendar**: all six competitions run on the same 38-matchday index (everyone plays "matchday 7" simultaneously). All matchday-keyed mechanisms — transfer window open/close constants, deadline days, winter-market trigger, offseason boundary — work with zero changes.
- `simThrough` simulates each matchday across all competitions (~60 matches vs ~20 today). Expected fine in the worker; sanity-check sim speed once during development.
- Per-competition scoping (same lesson the second-division work already learned, generalized): match composite normalization (`leagueMatchData`), standings (pre-filtered per-competition match lists), `deriveLeagueContexts` wealth/ambition/frugality normalization, and awards.
- `SeasonHistoryEntry`: `awards` changes from `[SeasonAwards, SeasonAwards]` to per-competition (keyed by compId); `divisionsByTid` becomes `compsByTid: Record<number, number>`. Old-save entries migrate mechanically (England-only ids 0/1).

## Offseason

One loop over countries: each independently computes final standings, runs prize settlement (tier-scaled exactly as today), and swaps bottom-3 of its D1 with top-3 of its D2 (`stepAcademyBaseConvergence` unchanged). Youth intake, progression, retirement, AI renewals, and free agency are already league-agnostic and run over the whole pool.

## Global market & the ceiling sweep

- AI↔AI market, free agency, inbound offers, recommendations: **no changes** beyond the per-competition AI-context normalization above. Cross-border deals emerge naturally and appear in News Feed/Finance as any other transfer.
- **`enforceDivision2Ceiling` goes cross-border** (user-approved): any AI-owned tier-2 player at `DIVISION_2_REFUSAL_OVR_THRESHOLD`+ is force-moved to whichever tier-1 club *worldwide* (never the user's) has the weakest positional average — one sweep over all tier-2 competitions, receiving pool = all AI tier-1 clubs. Simpler than three per-country sweeps, symmetric across equal-sibling countries, reads as "wants top-flight football." Runs at the same two offseason points as today.
- `wouldRefuseExtension` and the "Wants a move to Division 1" badge/buy-flow work unchanged (the flat OVR-threshold rule has no geography).

## Finance

All `division: 0 | 1` parameters in `src/core/finance/budget.ts` (`clampBudget`, `successPayout`, `seasonRevenue`, `chargeSeasonStart`, …) become tier lookups via the competition. Same audited constants everywhere (equal siblings) — no retuning expected; one confirming audit at the end (see Verification).

## UI

- **League creation**: new country step (England/Spain/Italy), then club picker over that country's 40 clubs. Save still named after the chosen club.
- **Standings / Awards / Stat Leaders**: existing Division dropdown becomes a competition dropdown grouped by country, defaulting to the user's competition.
- **Finance**: league-wide table gains the same competition filter (avoid a 120-row wall).
- **News Feed**: no change (filters are already per-club).
- **Manual**: new "The World" section + any quoted-number updates, same PR as the UI per the house rule.

## Rollout — three PRs

1. **Refactor**: competitions table with England-only data; `division` → `compId` everywhere; old-save migration; `SeasonHistoryEntry` shape change. Behavior-identical by design — updated existing tests are the verification; no new tests.
2. **The world**: Spain + Italy generation, 80 club identities, per-competition nationality weighting, cross-border ceiling sweep, offseason country loop.
3. **UI**: creation flow country step, competition dropdowns, Finance filter, Manual.

## Verification (deliberately lean, per the user)

- Scoped test runs while building; full suite once per PR as the gate.
- One quick browser pass of a fresh 3-country save (create in Spain D2, sim a few matchdays, check standings/market/news).
- **One** dynasty audit after PR 2 — single seed, ~20 seasons — confirming: no AI deficits anywhere, OVR equilibrium flat in all six competitions, D2 ceiling holding in every country. Multi-seed sweeps only if that run fails.

## Deferred / out of scope

- Mid-save managerial moves between clubs/countries (a whole career-mode system).
- Country strength/wealth differentiation (would need per-tier re-audits and international drift-fighting).
- Home-bias transfer tuning; continental cup competition; more countries (cheap to add later: 2 competition rows + 40 clubs + name pools).
- Old-save world expansion.
