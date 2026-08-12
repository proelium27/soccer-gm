# The transfer market was the brake on league convergence

How the strength ladder came to invert in shipped code, and why the fix is one
constant. Written 2026-08-11.

## The symptom

Over a 20-season dynasty on `main`, England — the strongest league by design —
finished **below** Portugal, the weakest. Both seeds, same direction:

```
seed 1  generated:  ENG 63.9   FRA 59.2   POR 54.3
        20 seasons: ENG 54.3   FRA 57.1   POR 56.8    INVERTED
seed 2  generated:  ENG 64.0   FRA 59.5   POR 54.2
        20 seasons: ENG 54.5   FRA 58.0   POR 56.3    INVERTED
```

The premise that the big four are stronger than the selling leagues — which
`COUNTRY_STRENGTH_OFFSET`, the cup's shared baseline and the whole selling-league
design rest on — was upside-down by season 20.

**It shipped unnoticed because the audit printed `ordering BROKEN` and then
exited 0.** CI was green. A stricter version of the audit (added on the
Belgium/Turkey branch, which exits non-zero) is what surfaced it.

## Attribution

Bisected with `scripts/weakLeaguesAudit.ts`, 20 seasons x 2 seeds per point:

| code | seed 1 outcome |
|---|---|
| before the transfer-realism rework (#202) | ENG 56.7 > FRA 53.7 > POR 51.2, ordering OK |
| after it | ENG 54.3 < POR 56.8, **inverted** |

The pre-rework erosion (England→Portugal 9.6 → 5.5) matches what CLAUDE.md
documents exactly, so the recorded behaviour was accurate — the rework
invalidated it.

**The decisive detail is which side moved.** England's decline worsened only
modestly (−7.2 → −9.6). Portugal swung from **losing 3.1 to gaining 2.5**. The
weak league started climbing. That rules out any "clubs can no longer afford to
renew/replace" explanation: those drain everyone, hitting the strongest hardest,
but they do not make Portugal *better*.

## Mechanism

`runAITransferMarket` only ever *shops* a player when

```ts
reservation = keepValueToClub(player, sellerCtx) * settledMultiplier(...)
if (reservation > market * AI_MARKET_AVAILABILITY) continue;   // was 0.95
```

Keep-side valuation was introduced by the same rework, and it exists to price a
club's own best player *above* market — it asks what the club would fall back to
without him. So `reservation <= market * 0.95` is a test his own club's
valuation is built to fail. Measured on a season-6 world
(`scripts/availabilityProbe.ts`):

```
                     reservation/market          shoppable at 0.95
all rostered         median 1.40                 15.6%
each club's BEST     median 1.96                  0.0%   (0 of 239 clubs)
```

Not "stars rarely move" — a club's best player could never be offered at all,
before any buyer was consulted. Confirmed against the market audit:

```
                        pre-rework   main
paid moves/season           889       430    −52%
star moves/season          74.9      14.4    −81%
stars to a WEAKER squad     17%        3%
fees >= $100M/season       42.4       5.7
free-agent pool            1716      1755    unchanged
```

Free agency is untouched, so this is specifically the *paid* market failing to
clear. Two individually sensible changes — pricing your own players honestly, and
tightening 1.05 → 0.95 — were jointly fatal.

**Note the fee rescale is innocent here.** `reservation` and `market` both scale
linearly with `VALUATION_OVR_COEFF`, so their ratio is invariant to it. Halving
the value scale cannot move this gate; only the keep-side switch and the
threshold tightening can.

## Why a stalled market inverts the ladder

CLAUDE.md attributes country-gap erosion to `growthDamping` — positive growth is
throttled only *above* a global ovr threshold, so leagues below it grow freely
while the big four are damped. That attribution is correct about the cause.

What it missed is that **the transfer market was the brake.** Talent draining
upward from weak leagues to rich ones continuously opposed that convergence. It
was never identified as load-bearing because, while it worked, net erosion looked
like a manageable ~43%.

Cut star mobility by 81% and the brake comes off. England's squad ages with no
way to restock; Portugal's sub-threshold players grow undamped and are never sold
upward. The leagues converge and cross. This also explains the asymmetry:
Portugal's +2.5 is not England's loss redistributed, it is Portugal growing in
place with nothing draining it.

## The fix

**Delete the availability pre-filter**, and `AI_MARKET_AVAILABILITY` with it.

The filter is not mis-tuned, it is a category error: it compares a club-relative
keep value against a club-blind market price. No threshold has a principled value
because the two quantities are not commensurable — tuning it only fits the
distribution. It is also *vestigial*. What it exists to prevent ("don't let a
rich rival walk off with our irreplaceable core player") is exactly what a
keep-side reservation expresses, enforced by making a buyer clear it by
`AI_MARKET_MIN_SURPLUS`. Protection by price, not by veto — and a veto has no
number at which a deal can happen.

```
                      seed 1                          seed 2
main today   ENG 54.3 < POR 56.8  BROKEN    ENG 54.5 < POR 56.3  BROKEN
removed      FRA 55.4 > ENG 55.1 > POR 54.7  ENG 56.5 > FRA 54.6 > POR 51.2  OK
             ENG/FRA inverted by 0.3
pre-rework   ENG 56.7 > FRA 53.7 > POR 51.2  ENG 57.0 > FRA 52.2 > POR 50.4  OK
```

Seed 2 nearly restores pre-rework (England 56.5 vs 57.0, Portugal 51.2 vs 50.4,
England→Portugal spread 5.3 against the original 6.6). Seed 1 keeps a 0.3
England/France inversion — inside the 0.5 tolerance the Belgium/Turkey branch's
audit uses for exactly this seed noise, though `main`'s older script has no
tolerance and reports any inversion. Solvency is healthy throughout
(£16.4M / £19.8M minimum).

Checked against **seeds 3 and 4, which nothing here was tuned on** — both fully
correct, and solvent:

```
seed 3   ENG 56.8 > FRA 54.3 > POR 53.5   ordering OK
seed 4   ENG 55.9 > FRA 54.5 > POR 53.7   ordering OK
```

So three of four seeds are clean and the fourth is inside tolerance, against
`main` being fully inverted on both seeds tested. `SEEDS=` on the audit is now
overridable precisely so a change can be checked on worlds it was not fitted to.

With the audit's own gate applied (0.5 inversion tolerance, non-zero exit — see
below), all four seeds report `ordering OK` and `SOLVENT`, and the script exits
0. On `main` the same script exits 0 too, while printing `**BROKEN**` — which is
the point of fixing it here.

Cost, measured over four seeds rather than asserted from one:

```
              seed 1   seed 2   seed 3   seed 4      main   pre-rework
paid moves      554      566      554      557        430      889
star moves      11%      12%      11%      13%        10%      56%
downhill         8%       8%       6%       5%         3%      17%
fees >=$100M    6.2      5.6      5.3      6.5        5.7     42.4
lowest budget  $17M     $19M     $16M     $16M       $17M        —
```

Moves to a weaker squad settle at **5–8%** — stable across seeds, not climbing,
and well under the 17% that motivated the original rework. Everything else is
flat: paid moves vary by 2%, star mobility by 2 points, and no club's budget goes
anywhere near zero.

**Runtime cost is real and was initially reported wrong here.** The deleted line
was also the only early-out ahead of the O(teams) buyer loop, and only ~15.6% of
rostered players passed it, so removing it makes the loop ~7× more expensive: one
market run goes **~52ms → ~357ms** on a 320-club world (`scripts/marketTiming.ts`,
best of 5, same world both sides). That is roughly 0.7s per simulated season
across two windows, in the sim worker rather than on the main thread. An earlier
draft of this doc claimed "no measurable runtime cost" — that was inferred from
audit wall-clock rather than measured, and it was false.

A replacement prune is worth having, but it must bound the **best possible buyer
valuation** against the reservation. Anything that compares the reservation to
club-blind market value reintroduces exactly this bug, and an unsound bound
silently re-excludes players — the same failure mode, harder to see. Deliberately
left as a follow-up rather than rushed into this change.

### Three things that were measured and rejected

**Tuning the threshold instead of removing it.** At 1.5 the ladder improves but
less (seed 2 spread 3.5 vs removal's 5.3) and seed 1 keeps a *larger* 0.7
inversion. It also leaves an unprincipled constant on an incommensurable
comparison, which the next person has no way to reason about.

**Raising the threshold further.** At 2.0 star mobility did not improve (12% vs
13% of the pool) while moves to a weaker squad nearly doubled and the poorest
club's budget fell ($15M → $7M). The two market gates sit **in series**: this
filter decides who is offered, `AI_MARKET_MIN_SURPLUS` decides which offers
clear. Past ~1.5 the second binds, so loosening the first is all cost.

**Lowering `AI_MARKET_MIN_SURPLUS`.** At 0.05 the residual inversion shrank but
the whole ladder compressed — England fell ~1 ovr on both seeds and
England→France collapsed from 2.0 to 0.2. The distinction that matters:

- the availability screen **sorts** — it decides whether a big club can prise
  away a small club's best player, which is exactly the upward drain the world
  needs;
- the surplus margin **stirs** — it admits marginal deals in every direction.

More transfers is not the goal. Selective transfers are.

## The audit that let this ship

`scripts/weakLeaguesAudit.ts` on `main` prints `ordering **BROKEN**` and then
**exits 0**. It detected this regression correctly and reported success, so CI
stayed green through a fully inverted ladder. A gate that reports failure and
returns success is worse than no gate — it reads as positive evidence that the
invariant holds.

**Fixed here rather than deferred.** The script now collects failures (ladder
inversions, and any AI club in deficit) and exits non-zero with a summary.
`SEEDS` is also parsed defensively — `SEEDS=` is an empty string rather than
nullish so `??` alone would not fall back, and `Number("")` is 0 rather than NaN,
so a stray comma would otherwise have quietly run seed 0 and printed a confident
verdict.

**A second calibration bug in the same gate, found when this landed on the
8-country branch (2026-08-11).** The tolerance above was set at 0.5 on the
reasoning that adjacent rungs coin-flip between seeds — which is true, and is
exactly why 0.5 was the wrong number: it sits *below* the noise it was
acknowledging. Measured 4 seeds × 20 seasons on the 16-competition world:

    Portugal→Belgium   +0.24  -0.44  +1.51  +1.75    mean +0.77
    Belgium→Turkey     -1.33  +0.48  -0.45  +0.06    mean -0.31

Per-seed values straddle zero with ~±1 ovr of spread, so a 0.5 per-seed gate
fails on seed choice alone. Order is now gated at two scales: a single seed can
only resolve a **gross** inversion (`SEED_INVERSION_TOLERANCE` 2.0), while a
**systematic** one shows up in the **mean across seeds**
(`MEAN_INVERSION_TOLERANCE` 1.0), where the noise averages down. Both real
failures are caught twice over, because both were present on every seed: the
Belgium/Turkey budget inversion at -2.23 and the market inversion at -2.5.
`SEEDS` defaults to four for that reason, and the script warns below three.
**The wrong fix here is tightening the per-seed tolerance; that is the bug.**

## What is deliberately not changed

- **The rework's actual fixes stay.** Stars moving to a weaker squad stays at 5%
  against a pre-rework 17%; the downhill protection lives in `moveAppealBetween`
  at the *clearing* test, not in this filter, so the two move independently.
  Fees do not re-inflate (biggest fee $187M vs $233M on main, $346M pre-rework).
- **`growthDamping` is untouched.** Making its threshold league-relative would
  hand every weak league its own elites and reopen the rating inflation the
  equilibrium exists to prevent. It is the underlying force, but it is not the
  regression, and it is not the thing to tune.
- **Keep-side valuation is untouched.** It is correct, and it fixed a real bug
  (a club valuing its own 85-ovr player at $132M against a $350M market).
- **`LOAN_AVAILABILITY` still makes the same comparison, and is deliberately
  left alone for now — but it is not clean.** `runAILoanMarket` screens on
  `keepValueToClub(p) > market * 0.95`, the identical club-relative-vs-club-blind
  test. Measured with `scripts/loanAvailabilityProbe.ts` at season 6:

      loan-eligible (outside XI, age <= 23)   median ratio 1.12   passes: 33.7%
      best loan-eligible player per club      median ratio 1.30   passes: 28.9%

  The catastrophic form does **not** reproduce (28.9% vs the market's 0.0%),
  because the loan market pre-filters to players outside the starting XI and
  aged <= LOAN_AI_MAX_AGE, so a club's best player — the population the market
  screen silently removed — never reaches this test. But the distortion is the
  same and in the same direction: keep-side is *built* to exceed market, so the
  median eligible youngster sits at 1.12x and a 0.95 threshold excludes about
  two thirds of them by construction, biting harder on the better ones. The
  consequence is only "fewer loans happen", with no feedback loop into league
  strength, which is why this is a separate follow-up rather than part of the
  market fix. **If it is changed, measure loan volume against the existing
  guardrails first — removing the screen could roughly triple it.**

## The gap this exposes: no need-to-sell term

`AI_NEED_BUY_MIN_SURPLUS` is 0, so a buyer with a genuine positional gap clears
at the seller's bare reservation with no margin at all. That was safe while the
availability screen kept a club's best players out of the buyer loop entirely;
they now reach it, so a favourable scouting-noise draw alone can move one. This
is the most likely source of the 3% → 5-8% rise in downhill moves.

The underlying asymmetry is worth naming, because it is the better fix:

**The market models the buyer's urgency and gives the seller no way to express
theirs.** A club with a hole gets its required margin dropped to zero; a club
under no pressure whatsoever to sell prices the player identically to one that
desperately needs the cash. In real football that is the whole negotiation — a
content selling club simply says no, at any sane price, and the buyer's need is
the buyer's problem.

Every input for a need-to-sell term already exists: financial pressure, genuine
surplus at the position, final contract year, age past peak. And because
`COUNTRY_BUDGET_SCALE` makes weak leagues poor by construction while wages are
country-independent, keying it on financial pressure would make weak-league clubs
the willing sellers and rich clubs the reluctant ones — the selling-league
dynamic, emergent rather than scripted.

**One trap, and it is severe.** There are two ways to write such a term and only
one is safe:

- *content clubs demand more* — raises reservations broadly, so **fewer deals
  clear**, which is exactly the mechanism that inverted the ladder. This would
  re-break the world while looking like a realism improvement.
- *pressured clubs discount* — lowers reservations for clubs that need to move
  him, leaving overall volume intact.

Same relative ordering, opposite effect on mobility. It must be a discount on
pressured sellers, never a premium on content ones.

## But is the term necessary? Measured 2026-08-12 — no, and the probe found worse

`scripts/needBuyMarginProbe.ts` mirrors the candidate loop of
`runAITransferMarket` on the same seeded jitter stream and reports the margin
each executed deal actually cleared by. It is self-checking: every executed deal
must be found among the mirrored candidates or it says the numbers are
unreliable. (It cannot answer this by editing `AI_NEED_BUY_MIN_SURPLUS` and
re-running — the constant is live during the warm-up seasons too, so the two
runs would be probing different worlds.) Season 6, seeds 1 and 2, all 389 / 378
deals reproduced:

|                                     | seed 1        | seed 2        |
| ----------------------------------- | ------------- | ------------- |
| deals executed                      | 389           | 378           |
| **need buys (relaxed bar)**         | **359 (92%)** | **351 (93%)** |
| cleared by under 5% margin          | 59 (15%)      | 69 (18%)      |
| …of those, downhill by squad ovr    | 31            | 47            |
| …of those, rated 78+                | 3             | 2             |

Three separate things get bundled under "need to sell", and they have different
answers:

1. **Sell to survive.** Not necessary — the condition does not occur. 0 deficits
   across 4 seeds × 20 seasons, worst-case minimum AI budget +£0.01M. The
   insolvency this was queued for was a *symptom* of the availability bug (a
   club could not shed wages by selling its highest earner), and that is fixed.
2. **Sell the surplus.** Already in `keepValueToClub` — incumbent is
   `posSecondBestOvr`, depth counted as `depth-1`, so a club deep at a position
   already prices its fourth-choice low. A depth-driven term double-counts it.
3. **Express the *absence* of pressure** — the real gap, and the narrow one. A
   need buy clears at the bare reservation, so the seller captures nothing and
   the noise draw decides. That is 15-18% of deals, of which the star component
   is 2-3 per window out of ~380.

**The unplanned finding is the one to act on: the exception is the rule.** 92-93%
of executed deals are need buys, so `hasPositionalGap` fires for nearly every
buyer and `AI_MARKET_MIN_SURPLUS` (0.15, the "only buy bargains" bar) is close to
inert — the market effectively runs at a 0% margin bar, which is not what that
constant's documentation describes. Order of work therefore: check whether
`hasPositionalGap` is too loose first, since tightening it restores
`AI_MARKET_MIN_SURPLUS`'s intended role *and* shrinks the zero-margin population
as a side effect; only if the thin-margin deals still look wrong, floor
`AI_NEED_BUY_MIN_SURPLUS` at something small. A need-to-sell term is a new
mechanic that raises mobility, and it should not be built to fix a gap that a
single loosened predicate is producing.

Two caveats on the table. It is one window each on two seeds at season 6. And
"downhill by squad ovr" here counts *all* deals (64%/70%), most of them squad
players moving for game time — it is not comparable to the 5-8% figure quoted
above for players rated 78+.

## Residual, known

Seed 1's France/Portugal rungs still sit within ~0.7 of each other. Adjacent weak
rungs are only ~1 `COUNTRY_STRENGTH_OFFSET` point apart (≈0.9 ovr at generation)
and are not individually resolvable across a dynasty even in healthy code — see
CLAUDE.md. The headline failure, the big-four league finishing below a selling
league, is fixed on both seeds.
