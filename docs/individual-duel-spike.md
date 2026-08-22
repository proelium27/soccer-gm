# Individual duel sim — spike results

Branch: `worktree-individual-sim-spike`. Not merged, not proposed for merge as-is.

The question: the match sim decides outcomes from five team composites and only
afterwards picks a player to pin each event on, so no individual ever influences
a result. Can that be inverted without wrecking a calibrated engine, and is the
result actually different enough to be worth it?

Short answer: **calibration survives completely, individual influence goes up
about 25–45%, and team-composition effects do not move at all — the last one for
a structural reason that no amount of tuning will fix.**

## What was built

`src/engine/duels.ts` plus a ~30-line change to `simMatchDetailed`'s tick loop.

Each tick now draws the two players actually contesting the ball — the carrier
(weighted by `CARRIER_WEIGHTS × dribbling`) and the defender closing him down
(`TACKLE_WEIGHTS × tackling`) — *before* deciding what happens to it. Their
`duelEdge` then shifts that tick's turnover probability and its chance-creation
probability. Three consequences:

- **Per-player fatigue.** Each actor's attributes are scaled by *his own* energy
  instead of the side's average, which is what makes an individually knackered
  defender exploitable. `applyFatigue`'s team term is untouched.
- **Earned defensive stats.** The man who wins the duel is the man credited with
  the tackle or interception, replacing a second, unrelated weighted draw.
- **Coherent injuries.** The man hurt in a challenge is the man who was carrying
  the ball, not a fresh pick.

Every duel term is a **deviation from the actor's own group pick-weighted mean**.
Because a player is drawn with probability proportional to his weight and is then
measured against the mean of that same weighted distribution, the deviation has
expectation exactly zero. That is what let this bolt onto a tuned engine without
retuning anything — and, as below, it is also the design's central limitation.

Duel strength is set by `DUEL_TURNOVER_WEIGHT` (0.1) and `DUEL_CHANCE_WEIGHT`
(0.02), both env-overridable **for the spike only** — the `envNum` indirection in
`engine/constants.ts` must be deleted before this could ship, since the browser
build has no `process.env`.

## Method

Every comparison is against **the same build with both weights at 0**, not
against `main`. The duel draws two extra rng values per tick either way, so the
zero-weight arm keeps the streams aligned and removes stream-shift as a
confound; only the weights differ.

Arms also share seeds match-for-match, so differences are **paired**. This
matters more than it sounds: at 6000 matches the unpaired interval on a
difference is ±0.057 goals/match and the paired one is ±0.027. An early
unpaired read at 1500 matches produced a "5× more sensitive" number that did not
survive either fix — see *Corrections* below.

Scripts: `scripts/duelIndividuality.ts`, `duelCalibration.ts`, `duelTiming.ts`,
`fatigueShotsProbe.ts`.

## Result 1 — calibration is untouched

League-scale, 16 competitions, 2 seasons per arm (`duelCalibration.ts`):

| | control | duels on |
|---|---|---|
| goals per game | 3.02 | 3.02 |
| champion points | 80.50 | 81.13 |
| bottom points | 27.19 | 27.19 |
| champion − bottom | 53.31 | 53.94 |
| top scorer | 26.75 | 27.25 |

**All 20 validation gates pass**, including M1 table spread (champion 78–94 over
20 seeded seasons), M3 top scorer, M4 multi-season stability and M4 multi-season
integrity. Goals/game still lands at 3.393 against control's 3.396 at **3× the
duel weights**, so this is not a knife-edge that happens to hold at one setting.

The mean-zero construction did exactly what it was designed to do.

## Result 2 — individual influence rises, moderately

30 rating points on one starting centre-back, measured as the club's goals
conceded per match, paired, 6000 matches per arm:

| duel weight | goals/match | paired 95% CI |
|---|---|---|
| 0 (composites only) | 0.059 | ±0.027 |
| 1× (shipped default) | 0.074 | ±0.027 |
| 3× | 0.085 | ±0.033 |

Monotonic in the weight: **+25% at 1×, +44% at 3×**. Each arm is individually
significant. The *difference between* arms is not resolvable at this sample size,
so treat the direction as established and the magnitude as approximate.

Defensive stats also become better earned — correlation between a defender's
tackling/interceptions rating and his defensive actions per appearance, over one
simmed season:

| duel weight | r | slope (actions per 10 rating pts) |
|---|---|---|
| 0 | 0.314 | +0.524 |
| 1× | 0.338 | +0.573 |
| 3× | 0.396 | +0.758 |

## Result 3 — the null, and why it is structural

**A lopsided back line is still not punished.** At identical mean quality, CB
85/55 concedes *less* than CB 70/70, and the duel model does not change that at
any weight tested:

| | control | duels 1× | duels 3× |
|---|---|---|---|
| lopsided 85/55 vs balanced 70/70 | −0.021 | −0.025 | −0.022 |
| lopsided 95/45, tackling equalized | −0.045 | −0.050 | −0.043 |

The second row is a follow-up control: `drawContester` weights the draw by
`tackling + 10`, so the obvious suspect was that the *better* defender gets
pulled into more duels and covers for the worse one. Holding both centre-backs'
tackling at 70 equalizes how often each is challenged while leaving the quality
gap intact. It changed nothing, so that hypothesis is wrong.

The real cause is the mean-zero centring itself. Each actor is measured against
**his own team's** pick-weighted mean, so the duel term averages to zero across a
match *by construction* — which means a team's expected result mathematically
cannot move based on how its quality is distributed. The property that kept every
gate green is the same property that makes the model inert at team level.

**This is not a tuning problem.** Raising `DUEL_TURNOVER_WEIGHT` raises how much
an individual matters (Result 2) but can never make composition matter, and the
3× row above is the evidence. Fixing it means centring on something exogenous —
a league-wide or pooled-across-both-teams baseline — which reintroduces exactly
the recalibration burden this design was built to avoid.

That is the real finding, and it is the trade the whole project turns on:

> Centre on the team's own mean → safe, calibrated, and unable to express team
> composition. Centre on a league baseline → expressive, and every gate needs
> re-tuning.

## Result 4 — cost

`duelTiming.ts`, 3000 matches, same file run against main's engine files:

| | ms/match | 6080-fixture season |
|---|---|---|
| main | 1.548 | 9.41 s |
| spike, first cut | 3.966 | 24.11 s |
| spike, allocation-free | 2.999 | 18.24 s |

**~1.9×.** The first cut was 2.6× purely from allocation: the obvious
implementation `filter()`s for outfielders and builds a weights array and a
quality array, ~3,800 array allocations per match, and spent more time in GC than
in the sim. `drawActor` is now two arithmetic passes with the GK skipped inline
and quality computed only for the man drawn.

The remaining obvious win is caching the (constant) per-side weight table and
invalidating it on subs and red cards, leaving only the O(11) energy pass. Not
done here because mis-invalidation would corrupt silently.

Practical note: the slowdown is enough to push several sim-heavy test files past
runtimes they previously met.

## Test status

- **20/20 validation gates pass.**
- **354 core tests pass**, run in batches: season/composites/normalize/rollup/
  injuries/suspensions/powerRanking (67), cup/awards/world awards/frivolities/
  honours/club history (153), simThrough (15), cup integration (2), domestic cup
  integration (3), and difficulty/progression/youth/retirements/freeAgentCull/
  standings/schedule/calendar (114).
- The last batch matters most for risk: **progression, youth, retirements and
  freeAgentCull all pass**, so the anti-inflation equilibrium is undisturbed —
  expected, since nothing outside `simMatchDetailed` was touched, but worth
  having measured rather than assumed.
- **Not run:** `offseason`, `international`, `worldIntegration` and `autopilot`
  each exceed the 600s foreground budget available in this environment, and
  background runs are killed here. They are the remaining coverage gap.
- Two failures, both understood:
  - `touchStats.test.ts` scoreline hash — the documented rebase for an
    intentional match-outcome change.
  - `fatigue.test.ts` "low-stamina squads generate fewer shots" — failed at 5166
    vs 5159. **Not a regression.** The effect it asserts is ~0.2% and it measures
    it with ~0.3% noise at 200 trials, so it was passing on luck; its own comment
    records being bumped 40 → 200 trials for the same reason after one extra rng
    draw. At 3000 trials (`fatigueShotsProbe.ts`) the relationship holds and is
    slightly *stronger* with duels on (0.245% vs 0.212% control). The test needs
    more trials, not a code fix.

## Corrections to earlier readings

Recorded because both were wrong in the direction of flattering the change:

1. **"~5× more sensitive"** came from 1500 unpaired matches. At 6000 paired
   matches it is +25%. Small samples on a noisy metric.
2. **The harness silently cancelled its own experiment at first.** Weakening a
   centre-back made `selectXI` bench him, so the "lopsided" arm quietly fielded a
   natural replacement and measured nothing — visible only because two arms
   returned byte-identical numbers. `runArm` now pins the natural XI as manual
   `starters` first.

## Extension — earned attacking credit

Added after the above, on the observation that goals and assists had the same
"assigned, not earned" problem, and that assists are in the class the mean-zero
design *can* fix (who gets credit within a team is redistribution, not team
strength).

**What was wrong.** `pickAssister` ran strictly inside `if (outcome === "goal")`,
so the assister was chosen after the goal already existed and his attributes
changed nothing about whether it happened. Measured on main: league assists are a
flat **0.735 x** league goals — the 25% no-assist roll and nothing else — so a
team's assist total carried no information at all beyond its goal total. Goals
were in better shape already: `SHOOTER_FINISH_WEIGHT` (0.3) has let a finisher's
own skill move conversion since July.

**What changed.** `drawCreator` picks the creator *before* the shot resolves,
and his mean-zero quality feeds the chance through `resolveShot`'s new
`chanceAdj`. He is now drawn on **passing** rather than dribbling — `MatchPlayer`
gained an optional `passing`, which it simply never carried before, which is why
`pickAssister` used dribbling as its creativity proxy.

`chanceAdj` enters xG where `finishAdj` deliberately does not. That asymmetry is
the point: a better pass really does produce a higher-xG chance, while a better
finisher does not — so "goals vs xG" still isolates finishing.

**Measured** (`scripts/assistProbe.ts`, one simmed league season, AM/W/CM with
10+ appearances; the middle column is the extension with
`CREATOR_CHANCE_WEIGHT=0`, i.e. the creator drawn early but inert):

| | main | drawn early, inert | full |
|---|---|---|---|
| r(passing, assists/app) | **0.077** | 0.309 | **0.318** |
| slope per 10 passing pts | +0.0053 | +0.0238 | **+0.0244** |
| r(dribbling, assists/app) | 0.320 | 0.158 | 0.178 |
| r(creator quality) | 0.285 | 0.375 | 0.397 |
| slope per 10 creator pts | +0.0335 | +0.0491 | +0.0518 |

A playmaker's actual passing ability went from **essentially unrelated to his
assists (r = 0.077) to genuinely predictive (r = 0.318)** — a 4.6x slope. As
designed, dribbling's grip loosens: assists were a dribbling stat and are now a
passing stat.

**Be honest about where the win came from.** Most of it is the attribute change
(main → inert: slope +47%), and only a small increment is the earning mechanism
itself (inert → full: +6%). The big fix was plumbing `passing` onto
`MatchPlayer` at all; the mean-zero machinery adds texture on top of that rather
than being the main event.

**Calibration. All 20 validation gates pass again with the extension in place**
— M1 table spread (20 seeded seasons), M3 top scorer, M4 multi-season, M4
multi-season integrity, and both benchmark files. At the
2-season league scale goals/game reads 3.07 against the duels-only 3.02, but
that is **stream shift, not the new term** — setting `CREATOR_CHANCE_WEIGHT=0`
gives 3.08, i.e. indistinguishable from the full weight, so the extra per-shot
draws moved the dice and the quality term itself did not move scoring. No new
test failures: the same two as above (`touchStats` hash, the under-powered
fatigue assertion) and nothing else.

## If this were to go further

1. Ship nothing as-is. The `envNum` override must go, and the scoreline hash and
   fatigue trial count need rebasing.
2. The open design question is the centring, not the weight. A pooled
   both-teams-on-the-pitch baseline is the smallest change that could express
   composition; it costs 4 baseline passes per tick instead of 2, and it needs
   the full gate suite plus a dynasty audit, because double-counting team
   strength against the composites would widen champion points.
3. Channels remain unbuilt and untested. `FORMATION_LAYOUTS` already carries x/y
   per slot in the UI layer; nothing in the engine consumes it.
