# M0 — Engine Port Design

**Date:** 2026-07-08
**Milestone:** M0 (per `SOCCER_GM_SPEC.md` §7)
**Status:** Approved for planning

## Goal

Port the proven proof-of-concept (`soccer-ticksim.mjs`) into typed, tested TypeScript
modules under `src/engine/`, add a shared Monte Carlo validation harness with CI gates,
and provide a small CLI to drive the engine. **This is a retyping, not a retuning** — the
constants and arithmetic are copied verbatim from the PoC so the validation gates remain
meaningful.

The PoC currently passes all §8 validation gates (verified 2026-07-08):

```
Two average teams (20k): 2.79 goals/game, 25.76 shots, 8.70 SOT,
                         home 39.8% / draw 25.3% / away 34.9%, 0-0 6.2%
Strong (home) vs Weak:   home 76.5%
Weak (home) vs Strong:   home 10.7% (weak avoids defeat 27.4%)
```

## Scope

**In:** typed engine modules, shared Monte Carlo harness, §8 CI gates, a CLI with
`match` and `bench` subcommands, unit tests, a GitHub Actions CI workflow.

**Out (later milestones):** players / ratings / ovr, composite rollup + league
normalization (M1), schedule / table / season loop / persistence / worker (M2), attribution
& box scores (M3), dynasty mechanics (M4), match texture — cards / subs / injuries (M5),
React UI and Vite (arrive at M2). No Vite, no browser APIs in M0.

## Architecture

Everything in M0 is pure TypeScript — no DOM, no storage — so it runs in Node, CI, and
(later) a Web Worker unchanged, satisfying §2's "engine/ and core/ importable in Node with
zero browser APIs" requirement.

```
src/engine/
  rng.ts          # mulberry32 → () => number in [0,1). Nothing else.
  constants.ts    # every tunable from PoC lines 26-40, one export each
  composites.ts   # Composites type + makeTeam() factory (the current team())
  matchSim.ts     # resolveShot() + simMatch() — the tick loop, math untouched
  montecarlo.ts   # runScenario() shared harness + preset teams (equal/strong/weak)
  index.ts        # re-exports the public surface
scripts/
  cli.ts          # `match` and `bench` subcommands over the engine
test/
  validation/
    benchmarks.test.ts   # §8 gates
  rng.test.ts
  matchSim.test.ts
.github/workflows/
  ci.yml          # on push → npm test
```

### Types

```ts
// composites.ts
interface Composites {
  attack: number; finishing: number; defense: number;
  keeping: number; control: number;   // each 0..1, 0.5 = league average
}

// matchSim.ts
interface TeamMatchStat { goals: number; shots: number; sot: number; ticks: number; }
interface MatchResult {
  home: number; away: number;          // final goals
  possessionHome: number;              // derived from ticks (0..1); no new math
  stat: { home: TeamMatchStat; away: TeamMatchStat };
}

// montecarlo.ts
interface ScenarioResult {
  n: number; seed: number;
  goalsPerGame: number; homeGoals: number; awayGoals: number;
  shotsPerGame: number; sotPerGame: number;
  homeWinPct: number; drawPct: number; awayWinPct: number;
  nilNilPct: number;
  topScores: Array<{ score: string; pct: number }>;
}
```

### Key rules

- **Math is copied verbatim.** `constants.ts` values and `matchSim.ts` arithmetic match the
  PoC exactly. The gates only mean something if the math is provably identical.
- **RNG is injected.** `simMatch(rng, home, away)` and `runScenario` take a seeded
  `() => number`; no module reaches for a global RNG or `Math.random`.
- **Single source of truth (Approach A).** `runScenario` *computes* a `ScenarioResult`; it
  never prints. The `bench` CLI prints it, the CI test asserts ranges on it. A number seen
  while tuning is provably the number CI guards.
- **Possession %** is surfaced from the `ticks` the loop already counts (§5 wants it, `bench`
  displays it) — no new scoreline math.

## Data flow

```
seed ─► mulberry32 ─► rng()
                        │
        Composites ─────┼──► simMatch ──► MatchResult ──► CLI `match` (verbose one game)
                        │
                        └──► runScenario(n games) ──► ScenarioResult ──┬─► CLI `bench` (print)
                                                                       └─► benchmarks.test (assert)
```

## Validation gates (CI)

`test/validation/benchmarks.test.ts` encodes the §8 table. Because the seed is fixed and the
RNG deterministic, each metric is a single fixed number, not a distribution — **zero
flakiness**, no tolerance tuning. Seeds reuse the PoC's (12345 / 6789 / 4242). As a one-time
step, the current passing numbers are pinned into the assertions so the gate reflects reality.
40k games run in well under a second — a normal fast unit test.

Gates asserted in M0 (from §8):

| Metric | Target | Scenario |
|---|---|---|
| Goals/game | 2.6–2.9 | equal |
| Shots/game | 23–27 | equal |
| Shots on target | 8–9.5 | equal |
| Draw rate | 23–28% | equal |
| 0-0 rate | 5–9% | equal |
| Home win rate | 38–46% | equal |
| Strong-home win | 70–80% | strong vs weak |
| Weak avoids defeat vs strong | ≥20% | weak vs strong |

The M1+ / M3+ rows in §8 (season points spread, top scorer) are noted as stubs for later
milestones, not asserted in M0.

## CLI

```
npm run cli match --home strong --away weak --seed 42
  → sims ONE game; prints score + per-team stat line (shots, SOT, possession%)

npm run cli bench --scenario equal --n 20000 --seed 12345
  → runs runScenario(); prints the §8 aggregate report (the PoC's current output)
```

`match` → `simMatch`; `bench` → `runScenario`. Presets (`equal`/`strong`/`weak`) resolve to
the shared team definitions in `montecarlo.ts`. Args parsed with Node's built-in
`util.parseArgs` (no dependency). Bare `match` / `bench` use sensible defaults.

## Tooling

Deliberately minimal — no Vite yet:

- **TypeScript**, strict mode, ESM.
- **Vitest** — runs validation gates and unit tests.
- **tsx** — runs the TS CLI with no build step.
- **npm** package manager.
- No React, no bundler, no IndexedDB (arrive at M2).

`package.json` scripts:

```
test        → vitest run     (what CI runs)
test:watch  → vitest
cli         → tsx scripts/cli.ts
```

## Testing beyond the gates

- `rng.test.ts` — mulberry32 is deterministic: same seed → same sequence.
- `matchSim.test.ts` — `resolveShot` probabilities clamp correctly at rating extremes; a
  fixed-seed single match returns a stable known result (a golden snapshot guarding against
  accidental math changes).

## CI

`.github/workflows/ci.yml`: on every push → checkout → install deps → `npm test`. Red if the
benchmarks drift out of the §8 ranges.

## Definition of done

1. `npm test` green — §8 gates passing with the PoC's real numbers pinned.
2. `npm run cli match` and `npm run cli bench` both work.
3. CI workflow runs the suite on push.
4. `src/engine/` imports cleanly in plain Node — zero browser APIs.
