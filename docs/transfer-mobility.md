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

Cost: moves to a weaker squad go 3% → 8%, still far below the 17% that motivated
the original rework, and the market stays calm otherwise (554 paid moves/season
against 430 now and 889 pre-rework; 6.2 nine-figure fees against 42.4).
Removing the prune had no measurable runtime cost.

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
stayed green through a fully inverted ladder. The stricter version on the
Belgium/Turkey branch (exits non-zero, plus an inversion tolerance for seed
noise) is what surfaced it. Whichever lands first, that script must fail when it
says it failed — otherwise the next regression here is exactly as invisible as
this one was.

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

## Residual, known

Seed 1's France/Portugal rungs still sit within ~0.7 of each other. Adjacent weak
rungs are only ~1 `COUNTRY_STRENGTH_OFFSET` point apart (≈0.9 ovr at generation)
and are not individually resolvable across a dynasty even in healthy code — see
CLAUDE.md. The headline failure, the big-four league finishing below a selling
league, is fixed on both seeds.
