# Findings from six real player saves (2026-08-17)

**This is a work queue, not a design doc.** Six saves sent in by players were audited; the
analysis is finished and is not worth redoing. Each item below is stated as: what's wrong,
the evidence, the root cause with line references, the shape of the fix, and what has to be
true before it ships. Pick items off it independently — none of them depend on each other.

Line references are as of **`8c90412`**. Confirm each one before editing; several files here
are actively worked by two accounts.

## What was audited

Six exported saves, created 9–15 Aug 2026, all on the current world layout:

| Club | Season | Phase | Comps | Players | JSON |
|---|---|---|---|---|---|
| Glastonbury | 47 | offseason | 16 | 10,818 | 223.7 MB |
| Ipswich Town | **75** | regular | 12 | 11,460 | 104.9 MB |
| Arsenal | 27 | regular | 16 | 10,834 | 84.5 MB |
| Tottenham Hotspur | 30 | regular | 12 | 8,191 | 67.0 MB |
| Real Madrid | 21 | regular | 12 | 8,217 | 58.6 MB |
| Birmingham City | 10 | regular | 16 | 10,563 | 49.8 MB |

The headline context: **real players reach season 75**, roughly triple the horizon every
dynasty audit in `scripts/` gates at. Several invariants that pass at 20 seasons are already
failing by 47.

### Re-running the audit

```bash
NODE_OPTIONS=--max-old-space-size=20480 npx tsx scripts/playerSaveAudit.ts "<save.json>"
```

`scripts/playerSaveAudit.ts` reports size breakdown, integrity findings and balance metrics.
It reads the **raw parsed file, deliberately not through `migrateLeague`** — migration repairs
and culls, so auditing a migrated league tells you what the game would fix rather than what
the player has. It handles both plain and gzipped exports.

The saves themselves live in `leaguesaves/` (gitignored — other people's game data, never
committed) and exist only on the machine they were sent to. **On any other machine you will
have the findings below but not the files.** Ask the user to re-share a save if you need to
reproduce a measurement rather than trusting a number here.

---

## 1. A quarter of every mid-season save is match events nothing reads

**Severity: high · affects every save, most of every season · no design call needed**

### Evidence

On the Glastonbury save (16 competitions, exported at matchday 38):

- `played` = **114 MB, 51% of the whole save**
- inside it, `boxScore.events` = 72 MB
- of 990,139 events, **803,697 are `type: "turnover"`** — 81% of events, **57.4 MB, 25.7%
  of the entire save**

A turnover event is 74 bytes and looks like this, with `pids` frequently empty:

```json
{"clock":5383.554586039856,"type":"turnover","side":"away","pids":[]}
```

`played` grows **~3.0 MB per matchday** on a 16-competition world — empty at kickoff, 114 MB
by matchday 38, wiped each offseason. This is the mechanism behind "the game gets slower the
further into the season I get", and it is independent of dynasty length.

### Root cause

Nothing reads a turnover event. Every consumer of `boxScore.events`:

- `src/ui/pages/BoxScore.tsx:503` — `.filter((e) => e.type !== "turnover")` before display
- `src/core/injuries.ts:52` — matches only `e.type === "injury"`
- `src/core/international/simIntl.ts:65` — matches only `e.type === "injury"`

`src/engine/matchSim.ts:731-734` already carries a comment noting BoxScore filters them out.
The tackle/interception credit a turnover carries is folded into each `PlayerMatchLine` at sim
time, so the event itself is a pure intermediate that happens to get persisted.

### Fix shape

Strip turnovers where matches are appended to `league.played` — **`src/core/simThrough.ts:417`**,
the single persist point (`played: [...league.played, ...newResults]`).

**Do not filter inside `simMatchDetailed` or the engine.** `test/engine/attribution.test.ts:228`
counts turnover events off the engine's returned box score to assert tackle/interception
crediting; filtering upstream breaks that test's premise rather than the behaviour it guards.

A post-sim transform at the persist point consumes no rng, so **scorelines stay bit-identical**
and `touchStats.test.ts` needs no rebase.

### Measured effect

| Save | Matchday | Now | After |
|---|---|---|---|
| Glastonbury | 38 | 223.7 MB | **162.1 MB (−28%)** |
| Ipswich Town | 3 | 104.9 MB | 101.3 MB (−3%) |
| the other four | 0 | — | −0% |

The four showing no gain were exported at kickoff when `played` is empty; each will carry
~60 MB of turnovers by matchday 38. Clone time on Glastonbury drops 2252 ms → 1544 ms
(GC-noisy — trust the direction).

### Also worth doing while in there, but secondary

Floats are stored at full double precision: `clock` at 16 significant digits, plus `xg`,
`xga`, `rating` and `possessionHome`. Rounding them (clock 1dp, xg/xga 3dp) is worth only
**~3.4 MB more** once turnovers are gone. Cheap, but not the win.

### Migration note

Existing saves keep their stored turnovers until the next offseason wipes `played`. That is
fine and needs no migration — but if you want the size back immediately on load, that's a
`migrate.ts` change and a deliberate decision, not a freebie.

### Verifying

Sim a season headlessly and check `played`'s byte size and event-type histogram; confirm
`touchStats.test.ts` still passes unchanged (this is the proof that rng order was untouched).

---

## 2. Loan returns hand players back with an already-expired contract

**Severity: high · present in all six saves · 71–281 players each**

### Evidence

Every save has players on a senior roster with `contract.expiresSeason < league.season` —
strictly past the release point, some by **six seasons**. In every save, **100% of them are
players who returned from loan at that rollover**. Zero exceptions, zero on the user's club,
and it occurs on saves with god mode off.

| Save | Season | Stale | Share of rostered | All from loan return? |
|---|---|---|---|---|
| Birmingham City | 10 | 281 | 3.5% | yes (281/281) |
| Glastonbury | 47 | 244 | — | yes |
| Arsenal | 27 | 217 | — | yes |
| Real Madrid | 21 | 159 | — | yes |
| Tottenham Hotspur | 30 | 156 | — | yes |
| Ipswich Town | 75 | 71 | 1.2% | yes (71/71) |

The affected population is exactly what the mechanism predicts: ages 19–24 (median 22, max 24
= `LOAN_AI_MAX_AGE` 23 plus a year), median ovr 38 — young, buried, loaned-out players.

### Semantics, so the bug isn't misread

`contractTerms` stamps `expiresSeason = season + lengthSeasons` (`src/core/contracts.ts:57`)
and `canExtend` is `expiresSeason <= season` (`src/core/contracts.ts:61-64`). So
`expiresSeason === N` means the deal **covers** season N and he leaves in the offseason after
it. `expiresSeason === league.season` is the normal final-year state. Only
`expiresSeason < league.season` is anomalous.

### Root cause

Step ordering in `simOffseason`:

1. **Step 0** `runAIContractRenewals` iterates `team.roster` (`src/core/ai/renewals.ts:51`).
   A loaned-out player sits on the **loanee's** roster, so his owner never gets to renew him —
   only the borrowing club does, and only if *its* valuation clears `AI_RENEWAL_MARGIN`.
2. **Step 1** `releaseExpiredContracts` (`src/core/offseason.ts:127`, impl
   `src/core/freeAgency.ts:52-67`) drops him from the *loanee's* roster. `activeLoans` is
   untouched, so he is now on no roster and also not a free agent (`freeAgentPids` excludes
   on-loan pids).
3. **Step 1.5** `processLoanReturns` (`src/core/offseason.ts:133`) appends him to his
   **parent's** roster (`src/core/loans.ts:140-144`) carrying the dead contract. Nothing
   downstream re-checks expiry. Contracts are deliberately untouched by loans
   (`src/core/loans.ts:62-68`).
4. **Step 6.46** `runAILoanMarket` can loan him straight back out — it screens on age and
   "outside the XI", **not on contract status** — restarting the loop. That is where multi-season
   staleness comes from.

### Consequences

- `departsAtRollover` is true (`src/core/transfers/negotiation.ts:142`), so the market refuses
  to buy a player it believes is about to walk for free — permanently, for someone who never walks.
- `trueTransferValue` computes `yearsRemaining = max(0, expiresSeason - season)` = 0
  (`src/core/finance/valuation.ts:68-72`), pinning him at the minimum contract multiplier forever.
- A permanent "Final year" badge in the UI (`Roster.tsx:183`, `PitchField.tsx:243`,
  `PowerRankings.tsx:375`).
- Wages are still charged normally, so there is **no money hole** — this is not a finance bug.

### Fix shape — three options, pick deliberately

1. Run the expiry sweep **after** `processLoanReturns`.
2. Exclude on-loan pids from step 1 and re-check them at return.
3. Have `processLoanReturns` resolve the returning contract explicitly (extend or expire).

Option 1 is smallest but reorders the offseason, and **offseason order is rng-load-bearing** —
a player released or not released changes downstream draws. Expect a full dynasty re-baseline
and treat any single-season metric move as noise until re-measured over ≥15 seasons.

### Related latent bug, same root cause

A **multi-season** loan (only the user can create 1–3 season loans, `src/core/loans.ts:270-278`)
whose contract expires mid-loan leaves the player removed from the loanee's roster at step 1 but
still in `activeLoans` for another 1–2 seasons — on **no roster, not a free agent, invisible and
unpaid** — until `processLoanReturns` hands him back. Measured as 0 occurrences in these six
saves, because AI loans are always 1 season (`src/core/loans.ts:442-445`) so release and return
land in the same offseason. Whichever fix you choose should close this too.

### Also arguably wrong, flagged not fixed

The **borrowing** club, not the owner, decides renewals for a loaned-in player
(`src/core/ai/renewals.ts:46-68`). That is what saves the other 73% of loan returns from this
bug, so it is load-bearing as written — but it is worth a deliberate decision rather than
being left as an accident.

### Verifying

Re-run `scripts/playerSaveAudit.ts` on a headlessly-simmed league: the
`rostered player whose contract already expired` ERROR should read 0. The audit already prints
how many of them were loan returns, so a partial fix is visible.

---

## 3. Retirement doesn't scrub international squads

**Severity: low today, latent throw · present in all six saves · one-line fix**

### Evidence

Every save carries dead pids in `league.international.qualifying.squads[].pids` (43–387 of
them). In the Birmingham save the live campaign holds 1,119 squad pids of which 36 are dead,
and **17 are provably in `retiredPlayers`** — the archive only ever contains retirees, so
retirement is the source (the remaining 19 are retirees who failed `isArchiveWorthy`).

### Root cause

Retirement (`src/core/offseason.ts:199-225`) scrubs `activeLoans`, `negotiations`,
`inboundOffers`, `loanListings` and `loanRejections`. It does **not** scrub international
squads. Only the free-agent cull does, via `scrubInternational`
(`src/core/players/freeAgentCull.ts:174,189-210`).

`transfers`, `newsEvents` and cup box scores are deliberately left alone (comment at
`src/core/offseason.ts:211-217`) — that is correct and should stay. `scoutingObserved` and
`stageInjuries` self-heal each rollover. International squads are the only state nothing repairs.

### Why it matters despite being cosmetic

The qualifying play path filters to living pids each leg
(`src/core/international/qualifying.ts:176-178`) — but it filters a **local copy and never
writes back**, so the stored list keeps accumulating. The Rosters UI filters too
(`src/ui/pages/nationalTeams/Rosters.tsx:21`).

The **tournament** path does not filter at all: `src/core/international/tournament.ts:89,121`
passes `tournament.squads` straight to `nationMatchData`, and
`src/core/league/composites.ts:38` dereferences with
`t.roster.map((pid) => byPid.get(pid)!).filter((p) => !p.injury)` — the non-null assertion makes
a missing pid `undefined`, and `.filter((p) => !p.injury)` then **throws** on it. That is safe today only because a tournament is drawn and fully played inside one
offseason, before step-3 retirement runs. It is a timing guarantee, not a structural one.

### Fix shape

Add the existing `scrubInternational` to retirement's scrub list. Pure state cleanup, no rng
draw, so sim results stay bit-identical. Closing it also removes the reliance on the ordering
guarantee above.

---

## 4. Honours boards go blank as a dynasty ages

**Severity: medium, player-visible · scales with dynasty length · needs a design call**

### Evidence

| Save | Season | Award pids | Resolve to nothing | Distinct unnameable players |
|---|---|---|---|---|
| Birmingham City | 10 | 1,240 | 106 (8.5%) | 1,712 |
| Real Madrid | 21 | 1,940 | 148 (7.6%) | 2,987 |
| Arsenal | 27 | 3,106 | 783 (25.2%) | 6,797 |
| Tottenham Hotspur | 30 | 2,685 | 728 (27.1%) | 5,863 |
| Glastonbury | 47 | 5,294 | 2,864 (54.1%) | 15,233 |
| **Ipswich Town** | **75** | 6,703 | **4,638 (69.2%)** | **20,855** |

At season 75, seven in ten historical award slots are empty, and 20,855 distinct players render
as `Player <pid>` across Transfers, News Feed and Club History.

### Root cause

`RETIREE_ARCHIVE_LIMIT` is 2,000 and prunes by career score, but honours accumulate without
bound (~90 award pids per season across competitions plus the world awards). By season 75 the
archive holds roughly 4% of everyone who ever retired, so most historical award winners are gone.
This is the documented consequence of the archive cap meeting an uncapped honours history — not
a regression.

### The trade, measured

A name-only row — `pid`, `name`, `nationality`, `pos` — is ~68 bytes of JSON. Covering **every**
unnameable player on the worst save costs **1.42 MB** and fixes all 20,855 broken names *and*
every blank honours slot. For scale, the turnover events on that same save cost 57 MB and buy
nothing (item 1).

An `ArchivedPlayer` row is ~2.2 KB, so simply raising `RETIREE_ARCHIVE_LIMIT` is ~30× more
expensive per player rescued and was already cut 4000 → 2500 → 2000 for save-size reasons.
A separate, much smaller name table is the cheaper shape.

**This is a user design call** — it adds a persisted structure and a migration. Do not ship it
unilaterally. Options worth putting to them: name-table-for-everyone; name-table for award
winners only (bounded, far smaller); or accept and document.

---

## 5. AI free agency is tier-blind

**Severity: low — latent, fires only when the market is already broken · 1 of 6 saves**

**Read the correction before acting on this.** It looks like a serious bug and is not currently
one.

### Evidence

On the Ipswich save only, 13 clubs are under 18 players, 3 under 11, and **3 have no goalkeeper
on the senior roster at all** (RB Leipzig, UD Oliveirense, Santa Clara) — `selectXI` then puts an
outfielder in goal and corrupts the keeping composite. Loans do not explain it: those clubs have
zero players loaned out.

Schalke 04 sit in German tier 2 at season 75 with **8 players** and $168M:
`GK75 FB69 ST68 ST67 ST60 ST54 CB41 ST36`. In season 75 they signed free agents at
`GK81 GK81 GK80 CB79 CB79 FB78 FB78 DM79 CM81 CM80 CM80` — and every one is now at a German
tier-1 club, at zero fee. 159 fee-0 club-to-club moves that season.

### Root cause

1. `src/core/offseason.ts:319` — first `enforceDivision2Ceiling` pass strips the relegated club.
   Deliberately placed **before** free agency so it can backfill.
2. `src/core/offseason.ts:328` — `runAIFreeAgency` backfills each position with the
   **highest-ovr** free agent available. `src/core/freeAgency.ts` never mentions `tier` or
   `DIVISION_2_REFUSAL_OVR_THRESHOLD`; it is entirely tier-blind, unlike the market and loan
   paths which both guard.
3. `src/core/offseason.ts:438` — second ceiling pass sweeps all of them straight back out.
4. Nothing refills afterwards. The club plays the season with 8 players.

### Correction — this is downstream, not independent

It only fires when the free-agent pool holds many players at the tier-2 ceiling, which happened
solely because that save's transfer market was broken (item 6):

| Save | Season | Free agents | **≥70 ovr** | Squads <18 |
|---|---|---|---|---|
| **Ipswich Town** | 75 | 5,503 | **351** | 13 |
| Tottenham Hotspur | 30 | 2,166 | 14 | 0 |
| Glastonbury | 47 | 2,812 | 11 | 0 |
| Arsenal | 27 | 2,816 | 8 | 0 |
| Real Madrid | 21 | 2,205 | 6 | 0 |
| Birmingham City | 10 | 2,548 | 2 | 0 |

Healthy saves hold 2–14 such players and show **zero** thin squads.

### Fix shape

A tier guard in `runAIFreeAgency` mirroring the market's, placed so it cannot shift rng draw
count (the market's guards sit after the jitter draw for exactly this reason). Worth hardening
as defence-in-depth; not urgent. It changes which players get signed, so dynasty-audit it.

Separately, there is **no roster floor for AI clubs** — `ensureUserRosterSafety` covers only the
user. A floor would make this class of failure structurally impossible rather than contingent.
That is a design decision.

---

## 6. Already fixed — do not re-investigate

The transfer market shutting down and the country strength ladder inverting is
`AI_MARKET_AVAILABILITY`, **already diagnosed and fixed**. Recorded here only so the field data
isn't mistaken for a live bug.

- Introduced by **PR #202**, 8 Aug 21:55. Removed by **PR #212**
  (*Let clubs sell their best players, restoring the league strength ladder*) on
  **11 Aug 17:41**, commit `54344fb`, an ancestor of `origin/main`. The constant now survives
  only in two explanatory comments. The buggy window was ~68 hours. Full diagnosis:
  `docs/transfer-mobility.md`.
- Field signature, on the Ipswich save: total transfer volume −47% at season 51 but
  **top-flight-to-top-flight moves −85%** (3,289 → 450 per decade). Portugal then climbs from
  9.2 ovr below England to above it by season 74.
- Confirmation that main is healthy: Glastonbury, created 13 Aug *after* the fix, runs 47
  seasons with 1,148–1,756 T1→T1 moves per decade and a correctly-ordered ladder. Birmingham
  (15 Aug) likewise.

**Caveat worth knowing:** a save carries **no build stamp** — `meta` is only
`{name, created, userTid}` — so build attribution is inferred from behaviour and creation dates.
Stamping the build version into `meta` on save is cheap and would make every future player save
diagnosable. That is a small, safe improvement someone should just do.

---

## 7. Not bugs — checked, don't chase

**User academies over `ACADEMY_ROSTER_CAP`** (13, 14 and 20 seen). The cap gates
`signToAcademy` only (`src/core/freeAgency.ts:361`); youth intake is deliberately ungated, by
the same convention as `ROSTER_CAP`, and the constant's own comment says so
(`src/core/constants.ts:919-926`). Three live cohorts of a 3–5 player intake on a two-season
deal is a steady state of 9–15, and the save data matches cohort-for-cohort. God mode cannot
add to an academy at all.

Two genuine inconsistencies did fall out of it, both small and both worth a user call:

- Incoming Talent tells the player "your academy is full (10/10)" while the game itself
  routinely pushes them to 13–15.
- `extendAcademyContract` (`src/ui/context/LeagueContext.tsx:380-381`) bypasses **both** the cap
  and the `PROSPECT_AGE_MAX` gate that `signToAcademy` enforces (`src/core/freeAgency.ts:357`).
  That is how the Tottenham save has a **27-year-old on a youth stipend**.

---

## 8. Balance observations — not defects, but the audits don't cover them

### The country strength ladder erodes with no floor

Even on healthy saves the gap halves: Glastonbury goes England→Turkey **11.2 → 5.4 ovr over 47
seasons**. By season 75 (on the broken-market save) it had fully inverted. `weakLeaguesAudit.ts`
gates at 20 seasons and passes cleanly while this is underway.

The convergence looks asymptotic toward `GROWTH_DAMPING_START`, which is a **single global
threshold** — so every country eventually arrives at the same ceiling, and a weak league grows
undamped until it gets there. `docs/transfer-mobility.md` and CLAUDE.md both warn against making
that threshold league-relative (it reopens inflation), so this needs thought rather than a knob.

**Concrete, cheap action: raise the audit horizon past 20 seasons**, because the failure mode
only appears well beyond where it currently gates.

### What came back healthy — useful as regression baselines

- **Anti-inflation holds long-run.** Tier-1 mean team ovr drifts +1.1 to +2.9 across every save
  and plateaus rather than ratcheting — including at season 75 (64.2 → 66.5).
- **The value rescale works.** On the save spanning it, fees ≥$100M fall 7–9% of paid moves →
  0.8%, mean fee $46M → $24M.
- **Title races are open.** 87 distinct tier-1 champions over 74 seasons; 100 over 46 on another.
- **The free-agent pool plateaus** rather than growing without bound.
- **The division-2 ceiling holds** — 0 to 3 breaching AI players per save.
- **`archiveCup` works in the wild** — cup box-score bytes are 0.00 MB in all six saves.

### Two things worth a second look

- **Champion points reach 99–102** on four saves, against the M1 standings gate's 78–94 band.
  The gate samples five seasons and these are 20–75-season maxima, so a high tail is expected —
  but 102 is a long way outside.
- **Generational talents do appear, but the two longest dynasties never produced one.** Measured
  as career *peak* ovr across living players' `hist` plus the retiree archive (an earlier pass
  that read living players' *current* ovr wrongly concluded none existed anywhere):

  | Save | Seasons | Best ever | 90+ | 88+ | 85+ |
  |---|---|---|---|---|---|
  | Arsenal | 27 | **93** (B. Bafdili, AM) | 1 | 5 | 19 |
  | Real Madrid | 21 | **93** (Davide Russo, CM) | 2 | 2 | 11 |
  | Tottenham | 30 | 90 (Toby White, CM) | 1 | 3 | 21 |
  | Glastonbury | 47 | 89 | 0 | 2 | 23 |
  | **Ipswich Town** | **75** | 89 | **0** | 5 | 23 |
  | Birmingham | 10 | 87 | 0 | 0 | 5 |

  The design target is a 90+ legend roughly once per 30 seasons. Arsenal and Real Madrid clear
  it; **Ipswich went 75 seasons and Glastonbury 47 without one**, which is the opposite of what
  more seasons should produce. Worth a look, with one caveat: `RETIREE_ARCHIVE_LIMIT` prunes by
  career score, so a very long save may simply have dropped an old legend — check whether that
  can happen to a 90+ player before treating this as a generation problem.

---

## Gating any of this

Per the repo's conventions:

- Items 1 and 3 are **pure post-sim/state changes with no rng draw** — sim results must stay
  bit-identical, and `test/engine/touchStats.test.ts` passing unchanged is the proof.
- Item 2 reorders the offseason and **will** shift the rng stream. Re-baseline the dynasty
  audits; do not read a single-season metric move as a regression until it's re-measured over
  ≥15 seasons.
- Item 5 changes which players get signed — dynasty-audit it.
- Anything player-visible needs the Manual (`src/ui/pages/Manual.tsx`) and the Changelog
  (`src/core/changelog.ts`) updated in the same PR. Items 2, 4 and 5 are player-visible; item 1
  is not (it removes data nobody ever saw).
