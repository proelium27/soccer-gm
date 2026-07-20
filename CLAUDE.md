# soccer-gm

A client-side, BBGM-style soccer management sim (TypeScript, React, Vite, IndexedDB). `SOCCER_GM_SPEC.md` is the full design brief and M0-M6 build order; `DESIGN.md`/`PRODUCT.md` and `docs/superpowers/specs/*` hold detailed feature/design docs. All milestones M0-M6 are done and merged (see "Milestone status" below).

> **This file is a condensed ledger, not a changelog.** Blow-by-blow constant-retune history (dated before/after values, dynasty-audit numbers) lives in git history and the `docs/` design specs — don't re-add it here. Keep entries to *what a feature is, where it lives, and its non-obvious gotchas.*

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # production build
npm test           # vitest run (full suite)
npm run test:watch # vitest watch
npm run typecheck  # tsc --noEmit
npm run cli        # scripts/cli.ts (headless sim harness for audits)
```

Audit scripts live in `scripts/` (e.g. `divisionAudit.ts`, `weakLeaguesAudit.ts`) — run with `tsx`.

## Git workflow

- Keep work committed: after code changes, commit locally with a clear message rather than leaving the tree dirty.
- Keep the remote in sync: push to `origin` after committing so local `main` and GitHub `main` never drift.
- A merged PR isn't done until it's pulled into local `main` (`git checkout main && git pull`).
- Only skip this if the user explicitly asks you to hold off.

## Shared-file conventions (two Claude accounts work this repo)

Two accounts (proelium27 and joeltmeyer/joeltm82) work here, each with private Claude memory the other can't see. **Committed files are the only shared source of truth.** Three must be kept in sync in the *same PR* as any change they cover:

1. **This file's "Milestone status"** — update when a milestone advances/reorders or a major architectural/design decision is made. Routine typo/UI/single-bug fixes don't need it. If you spot drift between this file and `main`, fix it as part of your work. Unsure if a change is milestone-significant? Ask.
2. **The in-game Manual** (`src/ui/pages/Manual.tsx`, `/manual`) — player-facing feature ledger, BBGM-manual style (single scrollable page, second person, plain-spoken, concrete numbers quoted from `src/core/constants.ts`). Update the relevant section when a **player-visible** feature ships/changes/is removed, or when a quoted constant is retuned (grep for the old value). Explains hidden mechanics' *behavior* without spoiling hidden *values*; keep the FAQ honest about known gaps.
3. **The player-facing Changelog** (`src/ui/pages/Changelog.tsx` reads the `CHANGELOG` array in `src/core/changelog.ts`, `/changelog`) — PREPEND a dated, plain-language entry (newest first) for any player-visible change. Manual = *how it works*; Changelog = *what changed and when*. Update both.

## Architecture (where things live)

- `src/core/` — pure sim logic (no UI/DOM). `constants.ts` is the central tuning table. Sub-areas: `players/` (generation, progression, youth, nationalities), `teams/`, `league/`, `ai/` (GM evaluation core), `transfers/`, `finance/`, `lineup/`, `cup/`, `scouting/`, plus top-level `offseason.ts`, `simThrough.ts`, `promotion.ts`, `loans.ts`, `awards.ts`, `godMode.ts`, `competitions.ts`.
- `src/engine/` — match sim (`matchSim.ts`, `attribution.ts`, `matchRating.ts`, its own `constants.ts`).
- `src/db/` — IndexedDB persistence (`leagueDb.ts`, `activeLeague.ts`) and **`migrate.ts`** (backfills every new field for old saves — update it whenever you add a persisted field).
- `src/ui/` — React pages (`pages/`), components, `context/LeagueContext.tsx` (all league-mutating actions, serialized through one promise chain).
- `test/` — vitest. `test/validation/` holds the M1/M4 §8 gate tests.

## Core invariants & gotchas (durable — read before touching sim code)

- **RNG stream order is load-bearing.** The sim is seeded/deterministic; inserting or removing an `rng` draw shifts every downstream roll (different ratings, names, results). When adding per-player traits or post-hoc attribution, derive them from a *separate* seeded stream (`mulberry32`/`hashInts` off pids/match-intrinsics), never from the shared `rng`. This has caused real bugs (AI deficits, shifted generation) multiple times — see any "RNG-stream-order" mention in git history.
- **OVR scale:** 65 ≈ average starter, 70 ≈ good starter, 75 ≈ a team's best, 80-85 ≈ league-wide elite, 90+ ≈ rare outlier. `OVR_WEIGHTS` (`constants.ts`) drives both generation and progression's `computeOvr`.
- **Anti-inflation (fragile equilibrium — several mechanics exist only to hold it):** youth intake anchors to a fixed-at-generation `academyBase`, never to the club's current roster average (the torn-out anchor caused unbounded ratchet). Potential is a *scout estimate* (`estimatePotential`), never a growth input. Every position's expected lifetime rating arc is ~0/slightly negative. `developmentBias` (persistent per-player trait, deterministic from pid) **must taper to exactly 0 by peak age**, or inflation reopens. `growthDamping` scales down only *positive* deltas as ovr climbs. `YOUTH_BASE_OFFSET` offsets the fact that `generatePlayer` doesn't vary quality by age. Any new mechanic that shifts these must be dynasty-audited (`scripts/`).
- **The user's club is unmanaged by design** in headless audits — no AI free agency/renewals/buys touch it, so it rots and produces *all* extreme worst-case roster/points stats. **Exclude `userTid` from tail metrics** in any audit, or report it separately.
- **Match composites are z-normalized within each competition.** A weak league reads as average in its own matches; cross-league surfaces (the Cup) must pool participants into a *shared* baseline (`simThrough`'s `cupMatchData`) or the weak club gets normalized back up to parity.
- **Determinism boundaries:** cup rounds and decorative touch-attribution (`passes`/`crosses`) each run on their own seeded streams so they can't perturb league match results — league scorelines stay bit-identical (`touchStats.test.ts` hard-asserts a scoreline hash).
- **UI conventions:** no emoji in UI (real icons = hand-written inline SVG, see `AwardIcons.tsx`); player-facing prose is casual/second-person, sentence-cased, no em-dashes.

## Milestone status (per `SOCCER_GM_SPEC.md` §7)

All done and merged:
- **M0** — engine port.
- **M1** — players → composites: generation, per-position OVR, composite rollup + league normalization.
- **M2** — season loop, IndexedDB persistence, web worker, scheduling, `simThrough`, minimal UI.
- **M3** — box scores: per-player attribution, `simMatchDetailed`, `SeasonStats`, box-score/leaders pages.
- **M4** — dynasty mechanics: progression (`players/progression.ts`), aging, retirement, youth intake, free agency, contracts, offseason orchestrator (`offseason.ts`).
- **M5** — match texture: cards, fatigue + AI subs, corners, penalties, in-match injuries (multi-matchday recovery), stoppage time, composite re-rolls after subs/reds/injuries. Sub selection blends fatigue with a live `computeMatchRating` estimate (`subPriority`).
- **M6** — depth + finance slice: budgets, scouting, hype, contracts, transfer valuation, two transfer windows, negotiation, extensions/FA signings. (Design detail beyond this summary lives in a Google Doc the user maintains + `docs/finance-design.md`.)

## Feature ledger (post-M6, all shipped)

Each entry: what it is / where it lives / gotchas.

**Roster & tactics**
- **Starting XI** — user drag-drops between XI and bench, persisted as `StoredTeam.starters` (11 pids, `null`=auto). `resolveXI` (`core/lineup/resolveXI.ts`) falls back to `selectXI` auto-pick when invalid. Only the user's club sets `starters`; AI always auto-picks.
- **Formations** — 9 shapes in `FORMATIONS` (`core/lineup/formations.ts`), `StoredTeam.formation` (default `4-3-3`). A real tactical lever: the match sim rolls up composites from the XI each club's formation fields (`teamFormation`/`teamSlots`). AI clubs auto-pick their strongest shape (`chooseBestFormation`, refreshed end of each transfer window via `assignAIFormations`; never the user's). `PitchField.tsx` + `pitchLayout.ts` render per-formation layouts.
- **ROSTER_CAP** (30, `core/constants.ts`) blocks user FA signings/buys when full; youth intake/AI FA unaffected (AI trimmed to 25 each offseason).

**Match data & stats**
- **Box scores** — `PlayerMatchLine`/`SeasonStats`. **Match Rating** (`engine/matchRating.ts`, FotMob-style 0-10, position-weighted, damped by minutes). `minutesPlayed` reconstructed from event clocks. `tackles`/`interceptions` split (`pickInterceptor`). Decorative `passes`/`crosses`/`foulsCommitted` attributed post-sim on a separate rng stream (scoreline-invariant). `avgRating` rolled into `SeasonStats`.
- **Multi-season history** — `Player.stats[]` is append-only (never pruned), so Leaders browse any past season for free. `LeagueStore.seasonHistory` stores each completed season's final table + champion + awards (Standings had no other persisted history — `league.played` is wiped each offseason). Leaders "All Seasons" adds Career vs Single-Season scope.

**Awards & history**
- **End-of-season awards** — `core/awards.ts` (`computeSeasonAwards`, pure/re-runnable). POTY, Golden Boot, Team of the Season. Formulas layer explicit stat weights + an `ovrBonus` (via `ovrDuringSeason`, reads `Player.hist` not present-day ovr) on top of `avgRating`. `/awards` page; Dashboard "Advance" navigates there post-offseason.
- **Club History** — `core/clubHistory.ts` (pure, derives everything from `seasonHistory`, no schema change). `/history`, view any club.

**Squad development**
- **Youth Academy** (user's club only) — `StoredTeam.academyRoster`, flat stipend wages (`academyContractTerms`). Actions in `core/freeAgency.ts` (`signToAcademy`/`promoteFromAcademy`/`releaseAcademyPlayer`). `ensureUserRosterSafety` auto-promotes to `ROSTER_SAFETY_FLOOR` (18) each offseason so the user's unmanaged roster can't drop below 11 and crash the engine. `/academy`, `/incoming-talent` (youth prospects), `/free-agents` (older FAs). AI youth still goes straight to roster.
- **Dynamic academy attraction** — recent within-division finishing rank shifts youth-intake quality (`core/players/academyForm.ts`). **Zero-sum by construction** (one club's + is another's −), so it can't reopen the inflation ratchet.
- **Team Rating** — `core/teams/teamRating.ts` (`computeTeamRating`), XI (equal weight) + geometrically-decayed bench, not a flat roster mean. OVR + POT. Shown on Standings (current only) and user's Roster header.

**AI General Manager** (replaces rule-scripts with emergent evaluation; full brief in the user's "AI GM Philosophy" doc)
- **Evaluation core** — `core/ai/clubContext.ts` (`deriveLeagueContexts`: squad strength/age/depth + league-normalized **ambition**/**frugality** scalars, *derived from state, not stored*) and `evaluate.ts` (`valueToClub` layers positional-need/timeline/affordability on `trueTransferValue`; `perceivedValueToClub` adds scouting-noise scaled by frugality). Normalization is scoped **within each competition**.
- **AI↔AI market** (`core/ai/transferMarket.ts`) — a player's reservation is his value to his current club; he moves to whoever values him enough more to clear it and afford the fee. Guardrails: availability cap, min-surplus, per-window buy/sell caps, depth floor, cash reserve. Runs once per window.
- **Inbound offers for the user's players** (`core/transfers/inboundOffers.ts`) — symmetric negotiation (`respondToAsk`), persisted in `LeagueStore.inboundOffers`. `/incoming-offers`. **List for Transfer** (`StoredTeam.transferListed`) lowers a buyer's surplus bar.
- **Contract renewals** (`core/ai/renewals.ts`) — final-year AI players renewed if value ≥ salary × margin (offseason step 0). Sell-at-peak/replace-aging are emergent (no separate mechanic).
- **News Feed** (`/news`) — all league transfer activity + player accomplishments. Accomplishments (`core/newsEvents.ts`, hat-trick/standout/goal-milestones/generational-arrival) detected at sim time into append-only `LeagueStore.newsEvents` (can't be derived retroactively). Timeline merge in `ui/newsFeedTimeline.ts`.
- **Power Rankings history** — snapshots captured every 5th matchday + finale into `LeagueStore.powerRankingHistory` (`core/teams/powerRanking.ts`).

**Finance**
- `budget` is a **cumulative running balance**, never reset to base — light spending compounds. Bounded by `budgetCap(tier, hype)` (`core/finance/budget.ts`): hype-scaled ceiling between `MAX_BUDGET_FLOOR` and `MAX_BUDGET`, ×`financeScale` per country/tier. Banking past the cap destroys the excess (never causes a deficit).
- Wages: cubic in ovr (`seasonSalaryForOvr`, `core/contracts.ts`), charged **up front** at season start (`chargeSeasonStart`); season-end `settleSeasonEnd` handles prize + hype − scouting only. Mid-season acquisitions charge full season salary at acquisition.
- **"Priceless star" premium** (`core/finance/valuation.ts`, `VALUATION_ELITE_*`) — steep premium above `VALUATION_ELITE_THRESHOLD` (76 ≈ the top of a league) rockets the genuine best players past every budget cap, so the difference-makers who actually win titles can't be bought at any price — you develop them, not buy them. This is the load-bearing **difficulty lever** (money buys a good squad, not a great one); note a global player-quality nerf can *not* substitute for it, because match composites z-normalize league-wide quality away (proven — it left title-win rates unchanged), whereas gating the *market* does bite.
- **Finance page** (`/finance`) — pure display of budget/hype, scouting slider, settlement breakdown, wage bill, transfer history, league-wide table.

**World / leagues** (competitions-as-data)
- `core/competitions.ts` — `Competition{id,country,tier,name}`, persisted `LeagueStore.competitions`. Teams carry `compId` (not a raw division number). Every "div 0 vs 1" pair is a loop over competitions. Finance fns take a `scale`, looked up via `financeScale`.
- `worldCompetitions()` = **12 competitions / 240 clubs**: England, Spain, Italy, Germany (equal siblings) + **France & Portugal (deliberately weaker + poorer)** via `COUNTRY_STRENGTH_OFFSET`/`COUNTRY_BUDGET_SCALE` (`constants.ts`). Weakness is invisible in a country's own matches (per-competition z-norm) — it bites only in finance (selling leagues) and the Cup (shared baseline).
- `generateWorld()` — one rng pass; England block is byte-identical to the old England-only generation. `createLeagueState` uses it for all new saves; old saves stay at whatever country set they were created with (never re-run generation). `CLUBS` = 240 fictional identities (no real clubs — trademark caution). New-save UI has a country picker (`NewLeague.tsx`); Customize Teams editor is competition-scoped.
- **Per-league nationalities** — `LEAGUE_NATIONALITY_WEIGHTS` (`core/players/nationalities.ts`), real top-flight breakdowns; drawn on each player's isolated identity sub-stream (RNG-safe). Youth intake is country-aware.

**Promotion/relegation & the second division**
- New leagues generate a full tier-2 division per country; 3-up/3-down straight swap each offseason (`core/promotion.ts`, `computeCountrySwaps`/`applyCompetitionSwaps`, per-country). A swapped club's `academyBase` converges gradually (`stepAcademyBaseConvergence`); finance scale switches immediately.
- **`enforceDivision2Ceiling`** (`core/ai/divisionCeiling.ts`) — the load-bearing anti-drift mechanic. Every offseason, any AI-controlled tier-2 player ≥ `DIVISION_2_REFUSAL_OVR_THRESHOLD` (70) is *deterministically* reassigned to a needy tier-1 club **in his own country** (zero fee, releases the receiver's weakest if capped). Runs twice (after promotion/relegation, and after the summer market). This holds "D2 strongest ≤ D1 average" flat across 100-season dynasties — probabilistic approaches did not (relegation doesn't route through any market decision). `wouldRefuseExtension` (`core/ai/breakoutRefusal.ts`, now a flat ovr≥threshold check) is kept for **user-facing** purposes only (Roster "Wants a move to Division 1" badge/Extend-block; surfacing rival stars as buyable). The user's own club is never swept.
- Market/loan **prevention guards**: a tier-2 club never buys/bids-on/is-loaned an over-threshold player (guards placed *after* jitter draws, per RNG-order), so the game stops manufacturing illegal D2 residents and the sweep only cleans up structural cases (relegated squads, homegrown breakouts).

**Continental Cup** (`core/cup/`)
- 16-team single-leg knockout alongside the league, top-4-by-league-position of each tier-1 league qualify (not by OVR). Seeded by finishing rank. **Skips season 1** (no prior table → `cup===null`). Rounds fire on fixed matchdays, each on its own seeded rng (league results stay bit-identical). Ties → extra time → shootout. **`simThrough` halts the batch before the user's final** (Dashboard warns). Prize money credited per round (prize-only, never subtracts). Cup stats live only on each tie's `BoxScore` (separate from `SeasonStats`), shown on a Player Profile Cup tab. `LeagueStore.cup`/`cupHistory`, `/cup`.
- **Weak-league play-in** — `cupPlan` gives weak-country tier-1 leagues 1 slot (champion only); a preliminary play-in (`CupPlayIn`) fills the last bracket places. Cup normalizes against a shared baseline (`cupMatchData`) so weak clubs read as genuinely weaker.

**Loans** (`core/loans.ts`)
- Fixed 1-3 season move to another roster; flat non-negotiable fee (`computeLoanFee`) + wage handoff (wages key off roster membership, so moving the pid *is* the mechanism). User lists via `/loans` (Accept/Reject only). AI↔AI loans (`runAILoanMarket`) restricted to age ≤ `LOAN_AI_MAX_AGE` (23) and **players outside their club's starting XI** (only buried youngsters). `processLoanReturns` runs early in `simOffseason`. State: `LeagueStore.activeLoans`/`loanListings`/`loanRejections`. No loan-in browsing UI, no early recall (disclosed scope cuts).

**Scouting fog-of-war on potential** (`core/scouting/potentialFog.ts`)
- Fogs **POT only** (OVR/attributes stay exact) as a low-high range, narrowed by scouting spend + ownership tenure, clearing to exact over ~2-3 seasons. `StoredTeam.scoutingObserved` (pid→first-seen season, user only, reconciled at league creation + each offseason). `<PotDisplay>` replaces every raw potential render; AI clubs unaffected (they have their own `perceivedValueToClub` noise). Team-level aggregates stay exact.
- **Scouting spend is locked per season** — `StoredTeam.nextScoutingSpend` (editable only in offseason) becomes the committed `scoutingSpend` at rollover, closing a peek-then-lower exploit.

**OVR history chart** (`ui/components/OvrHistoryChart.tsx`)
- Per-player career OVR area chart on Player Profile, colored by the club each season, crests at transfers. `RatingsSnapshot.academy` stores the academy/senior flag *going forward* (irreconstructable for old saves → `false`). Academy shows only in the hover tooltip label.

**Extremism** (occasional extreme outcomes without reopening inflation)
- **Generational talents** — `isGenerational(pid)` (`players/progression.ts`), ~1/2500 per pid, softer growth-damping + floored bias → a true 90+ legend ~once/30 seasons. Youth-intake arrival announced on News Feed.
- **Historic team seasons** — `core/teamSeasonForm.ts`, hidden ±season-long form swing (1.5% each way), applied to composites in `simThrough` (cup too). On-pitch only (no market side effects). Both derived from hashes (no shared-rng consumption). User's club eligible symmetrically.

**God Mode** (`core/godMode.ts`) — per-save sandbox (`LeagueStore.godMode`). Guardrail-free editing (bypasses fees/budget/cap/depth-floor): move/release/edit/create players, set club finances; un-fogs potential everywhere. `detachPlayer` scrubs a pid from all rosters + transient state. `PlayerEditModal.tsx`, `/god-mode` hub. Scope-outs: no add/delete clubs, no hard-delete (release instead), no forcing match results.

## Open design decisions (need a user call before coding)

From the 2026-07-11 bug hunt; each has more than one reasonable fix — discuss options first:
1. **Winter-sale wage dodge** — season wages charged once at offseason settlement against the current holder, so selling a high earner in winter dodges his whole season bill. Pro-rate, charge-at-transfer, or accept+document.
2. **Deficit at the 30-man cap** — the "no club runs a deficit" tuning was only proven for the 25-man composition; a stacked full user squad with a low finish can go negative. Retune, cap scouting relative to wages, or allow user deficits + add debt UI.
3. **Youth intake position distribution** — `generateYouthIntake` draws positions uniformly while rosters need CB/FB/CM more; long dynasties drift short. Likely fix: weight by `ROSTER_COMPOSITION` (confirm the rng-consumption shift is acceptable).
4. **Mid-season transfer stat attribution** — `SeasonStats` is one running total; Leaders/Roster credit the whole line to the *current* club. Per-stint stats (schema change) or a "joined mid-season" UI marker.

(Item 5, Division-2 long-dynasty drift, is resolved — see `enforceDivision2Ceiling` above.)

**Lower-severity leftovers** (no design input needed, not yet done): no general guard against fielding <11 when a roster drops below 11 healthy players (`selectXI` silently skips slots) — partially covered for the user's club by `ensureUserRosterSafety`; AI and other paths unguarded. `pickReplacement` would hand back an outfielder as a "GK replacement" if GKs could ever be subbed/injured/carded (currently unreachable).
