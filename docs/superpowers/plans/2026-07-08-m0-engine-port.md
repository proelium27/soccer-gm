# M0 Engine Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the proven `soccer-ticksim.mjs` proof-of-concept into typed, tested TypeScript modules under `src/engine/`, with a shared Monte Carlo validation harness, §8 CI gates, and a `match`/`bench` CLI.

**Architecture:** Pure-TypeScript engine (no DOM, no storage) importable in plain Node. A single `runScenario` harness is the shared source of truth: the `bench` CLI prints its result, the CI test asserts §8 ranges on it. Engine math is copied verbatim from the PoC — this is a retyping, not a retuning.

**Tech Stack:** TypeScript (strict, ESM), Vitest, tsx, Node `util.parseArgs`, GitHub Actions. No Vite/React/bundler in M0.

---

## Reference: the PoC

The source of truth for all engine math is `soccer-ticksim.mjs` at the repo root. Every constant and every arithmetic expression below is copied from it unchanged. If a value here disagrees with the PoC, the PoC wins — stop and reconcile.

## File Structure

```
package.json                       # scripts, deps, "type": "module"
tsconfig.json                      # strict ESM
src/engine/
  rng.ts                           # mulberry32
  constants.ts                     # tunables (PoC lines 26-40)
  composites.ts                    # Composites type + makeTeam()
  matchSim.ts                      # resolveShot() + simMatch()
  montecarlo.ts                    # runScenario() + preset teams
  index.ts                         # public re-exports
scripts/
  cli.ts                           # match + bench subcommands
test/
  rng.test.ts
  matchSim.test.ts
  validation/benchmarks.test.ts    # §8 gates
.github/workflows/ci.yml
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "soccer-gm",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "cli": "tsx scripts/cli.ts",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src", "scripts", "test"]
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
*.log
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `node_modules/` populated, `package-lock.json` created, no errors.

- [ ] **Step 5: Verify the toolchain runs**

Run: `npx vitest run`
Expected: exits successfully reporting "No test files found" (no tests yet).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore
git commit -m "chore: scaffold TS + Vitest project for M0 engine"
```

---

### Task 2: Seeded RNG

**Files:**
- Create: `src/engine/rng.ts`
- Test: `test/rng.test.ts`

- [ ] **Step 1: Write the failing test**

`test/rng.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mulberry32 } from "../src/engine/rng.js";

describe("mulberry32", () => {
  it("returns numbers in [0, 1)", () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 1000; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("is deterministic: same seed yields the same sequence", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("different seeds yield different sequences", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toEqual(b());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/rng.test.ts`
Expected: FAIL — cannot resolve `../src/engine/rng.js`.

- [ ] **Step 3: Write the implementation (verbatim from PoC lines 15-23)**

`src/engine/rng.ts`:

```ts
/** Seeded RNG — mulberry32. Returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/rng.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/rng.ts test/rng.test.ts
git commit -m "feat: add seeded mulberry32 RNG"
```

---

### Task 3: Constants

**Files:**
- Create: `src/engine/constants.ts`

No test — these are plain value exports, exercised by every later test.

- [ ] **Step 1: Write the constants (verbatim from PoC lines 26-40)**

`src/engine/constants.ts`:

```ts
/** Every tunable engine value. Copied verbatim from the validated PoC. */
export const MATCH_SECONDS = 5400; // 90 minutes
export const MIN_DT = 2; // seconds per tick (min)
export const MAX_DT = 10; // seconds per tick (max)

export const BASE_CHANCE = 0.032; // per-tick prob the team on the ball creates a shot
export const STRENGTH_K = 0.8; // how much attack-vs-defense edge swings chance frequency

export const BLOCK_BASE = 0.28; // shot gets blocked
export const ONTARGET_BASE = 0.47; // unblocked shot is on target
export const SAVE_BASE = 0.68; // on-target shot is saved (else goal)

export const TURNOVER_BASE = 0.14; // per-tick prob possession changes hands
export const REBOUND_PROB = 0.12; // after a saved/blocked shot, attacker keeps it

export const HOME_ATTACK_BONUS = 0.1; // home advantage, applied to home attack composite
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/engine/constants.ts
git commit -m "feat: add engine constants from PoC"
```

---

### Task 4: Composites

**Files:**
- Create: `src/engine/composites.ts`
- Test: `test/composites.test.ts`

- [ ] **Step 1: Write the failing test**

`test/composites.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { makeTeam } from "../src/engine/composites.js";

describe("makeTeam", () => {
  it("defaults every composite to league-average 0.5", () => {
    const t = makeTeam("Average");
    expect(t).toEqual({
      name: "Average",
      attack: 0.5,
      finishing: 0.5,
      defense: 0.5,
      keeping: 0.5,
      control: 0.5,
    });
  });

  it("applies overrides and keeps defaults for the rest", () => {
    const t = makeTeam("Strong", { attack: 0.63, keeping: 0.6 });
    expect(t.attack).toBe(0.63);
    expect(t.keeping).toBe(0.6);
    expect(t.defense).toBe(0.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/composites.test.ts`
Expected: FAIL — cannot resolve `composites.js`.

- [ ] **Step 3: Write the implementation (from PoC lines 46-55)**

`src/engine/composites.ts`:

```ts
/** A team's composite ratings. Each is 0..1 with 0.5 = league average. */
export interface Composites {
  name: string;
  attack: number; // how often possession escalates into a shot
  finishing: number; // shot accuracy + conversion
  defense: number; // suppresses opponent chances, blocks shots
  keeping: number; // goalkeeper save rate
  control: number; // possession retention
}

export type CompositeOverrides = Partial<Omit<Composites, "name">>;

/** Build a team's composites, defaulting any unset composite to 0.5. */
export function makeTeam(name: string, o: CompositeOverrides = {}): Composites {
  return {
    name,
    attack: o.attack ?? 0.5,
    finishing: o.finishing ?? 0.5,
    defense: o.defense ?? 0.5,
    keeping: o.keeping ?? 0.5,
    control: o.control ?? 0.5,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/composites.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/composites.ts test/composites.test.ts
git commit -m "feat: add Composites type and makeTeam factory"
```

---

### Task 5: Match simulation

**Files:**
- Create: `src/engine/matchSim.ts`
- Test: `test/matchSim.test.ts`

This task ports `resolveShot` and `simMatch` verbatim (PoC lines 57-141) and adds a
derived `possessionHome` field. The test is a **characterization test**: implement first,
then run once to capture the stable fixed-seed result and lock it in.

- [ ] **Step 1: Write the implementation**

`src/engine/matchSim.ts`:

```ts
import {
  MATCH_SECONDS,
  MIN_DT,
  MAX_DT,
  BASE_CHANCE,
  STRENGTH_K,
  BLOCK_BASE,
  ONTARGET_BASE,
  SAVE_BASE,
  TURNOVER_BASE,
  REBOUND_PROB,
  HOME_ATTACK_BONUS,
} from "./constants.js";
import type { Composites } from "./composites.js";

export const clamp = (x: number, lo = 0, hi = 1): number =>
  Math.max(lo, Math.min(hi, x));

export interface TeamMatchStat {
  goals: number;
  shots: number;
  sot: number;
  ticks: number;
}

export interface MatchResult {
  home: number; // home goals
  away: number; // away goals
  possessionHome: number; // 0..1, home ticks / total ticks
  stat: { home: TeamMatchStat; away: TeamMatchStat };
}

export type ShotOutcome = "blocked" | "off_target" | "saved" | "goal";

/** Shot resolution cascade: block -> off target -> save -> goal. (PoC lines 57-73) */
export function resolveShot(
  rng: () => number,
  off: Composites,
  def: Composites,
): ShotOutcome {
  const blockP = clamp(BLOCK_BASE * (1 + 0.6 * (def.defense - 0.5)), 0.05, 0.6);
  if (rng() < blockP) return "blocked";

  const onTargetP = clamp(
    ONTARGET_BASE * (1 + 0.5 * (off.finishing - 0.5)),
    0.1,
    0.9,
  );
  if (rng() >= onTargetP) return "off_target";

  const saveP = clamp(
    SAVE_BASE * (1 + 0.5 * (def.keeping - 0.5)) - 0.3 * (off.finishing - 0.5),
    0.2,
    0.95,
  );
  if (rng() < saveP) return "saved";

  return "goal";
}

/** Simulate one match. (PoC lines 76-141) */
export function simMatch(
  rng: () => number,
  home: Composites,
  away: Composites,
): MatchResult {
  const homeEff: Composites = {
    ...home,
    attack: clamp(home.attack + HOME_ATTACK_BONUS),
  };
  const teams = { home: homeEff, away } as const;

  const stat = {
    home: { goals: 0, shots: 0, sot: 0, ticks: 0 } as TeamMatchStat,
    away: { goals: 0, shots: 0, sot: 0, ticks: 0 } as TeamMatchStat,
  };

  let clock = MATCH_SECONDS;
  let poss: "home" | "away" = rng() < 0.5 ? "home" : "away";

  while (clock > 0) {
    const dt = MIN_DT + rng() * (MAX_DT - MIN_DT);
    clock -= dt;

    const off = teams[poss];
    const defSide: "home" | "away" = poss === "home" ? "away" : "home";
    const def = teams[defSide];
    stat[poss].ticks++;

    const turnoverP = clamp(
      TURNOVER_BASE * (1 + 0.6 * (def.defense - off.control)),
      0.02,
      0.5,
    );
    if (rng() < turnoverP) {
      poss = defSide;
      continue;
    }

    const edge = off.attack - def.defense;
    const chanceP = clamp(BASE_CHANCE * (1 + STRENGTH_K * edge), 0.002, 0.2);
    if (rng() >= chanceP) {
      continue; // isNothing() — the escape valve
    }

    stat[poss].shots++;
    const outcome = resolveShot(rng, off, def);

    if (outcome === "saved" || outcome === "goal") stat[poss].sot++;

    if (outcome === "goal") {
      stat[poss].goals++;
      poss = defSide; // kickoff to conceding team
      continue;
    }

    if (rng() < REBOUND_PROB) {
      // attacker keeps possession (poss unchanged)
    } else {
      poss = defSide;
    }
  }

  const totalTicks = stat.home.ticks + stat.away.ticks;
  return {
    home: stat.home.goals,
    away: stat.away.goals,
    possessionHome: totalTicks === 0 ? 0.5 : stat.home.ticks / totalTicks,
    stat,
  };
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Write a characterization test with placeholder expectations**

`test/matchSim.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mulberry32 } from "../src/engine/rng.js";
import { makeTeam } from "../src/engine/composites.js";
import { resolveShot, simMatch, clamp } from "../src/engine/matchSim.js";

describe("clamp", () => {
  it("clamps below, within, and above the range", () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(2, 0, 1)).toBe(1);
  });
});

describe("resolveShot", () => {
  it("returns one of the four outcomes", () => {
    const rng = mulberry32(7);
    const off = makeTeam("O");
    const def = makeTeam("D");
    const outcomes = new Set(
      Array.from({ length: 200 }, () => resolveShot(rng, off, def)),
    );
    for (const o of outcomes) {
      expect(["blocked", "off_target", "saved", "goal"]).toContain(o);
    }
  });
});

describe("simMatch", () => {
  it("produces a stable result for a fixed seed (golden snapshot)", () => {
    const rng = mulberry32(999);
    const r = simMatch(rng, makeTeam("Home"), makeTeam("Away"));
    // FILL IN after Step 4 with the observed values.
    expect(r.home).toBe(0);
    expect(r.away).toBe(0);
    expect(r.possessionHome).toBeCloseTo(0, 5);
    expect(r.stat.home.shots).toBe(0);
  });

  it("possession fractions sum to 1", () => {
    const rng = mulberry32(123);
    const r = simMatch(rng, makeTeam("Home"), makeTeam("Away"));
    const awayPoss = r.stat.away.ticks / (r.stat.home.ticks + r.stat.away.ticks);
    expect(r.possessionHome + awayPoss).toBeCloseTo(1, 10);
  });
});
```

- [ ] **Step 4: Capture the real golden values**

Run: `npx vitest run test/matchSim.test.ts` — the "golden snapshot" test will FAIL and Vitest prints the actual received values (home, away, possessionHome, home.shots). Read them from the failure diff.

- [ ] **Step 5: Lock the golden values in**

Replace the four `FILL IN` assertions in the golden-snapshot test with the exact values observed in Step 4. Example (use YOUR observed numbers, not these):

```ts
expect(r.home).toBe(2);
expect(r.away).toBe(1);
expect(r.possessionHome).toBeCloseTo(0.512, 3);
expect(r.stat.home.shots).toBe(13);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run test/matchSim.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/engine/matchSim.ts test/matchSim.test.ts
git commit -m "feat: port match simulation with possession tracking"
```

---

### Task 6: Monte Carlo harness

**Files:**
- Create: `src/engine/montecarlo.ts`
- Test: `test/montecarlo.test.ts`

- [ ] **Step 1: Write the failing test**

`test/montecarlo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { runScenario, PRESETS } from "../src/engine/montecarlo.js";

describe("runScenario", () => {
  it("is deterministic for a fixed seed", () => {
    const a = runScenario(PRESETS.equal, PRESETS.equal, 500, 12345);
    const b = runScenario(PRESETS.equal, PRESETS.equal, 500, 12345);
    expect(a).toEqual(b);
  });

  it("reports result percentages that sum to ~100", () => {
    const r = runScenario(PRESETS.equal, PRESETS.equal, 1000, 1);
    expect(r.homeWinPct + r.drawPct + r.awayWinPct).toBeCloseTo(100, 6);
  });

  it("exposes the requested n and seed", () => {
    const r = runScenario(PRESETS.equal, PRESETS.equal, 250, 77);
    expect(r.n).toBe(250);
    expect(r.seed).toBe(77);
  });

  it("has all three presets", () => {
    expect(PRESETS.equal.attack).toBe(0.5);
    expect(PRESETS.strong.attack).toBe(0.63);
    expect(PRESETS.weak.attack).toBe(0.38);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/montecarlo.test.ts`
Expected: FAIL — cannot resolve `montecarlo.js`.

- [ ] **Step 3: Write the implementation (aggregation from PoC lines 144-178; presets from lines 184-190)**

`src/engine/montecarlo.ts`:

```ts
import { mulberry32 } from "./rng.js";
import { makeTeam, type Composites } from "./composites.js";
import { simMatch } from "./matchSim.js";

export interface ScenarioResult {
  n: number;
  seed: number;
  goalsPerGame: number;
  homeGoals: number;
  awayGoals: number;
  shotsPerGame: number;
  sotPerGame: number;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  nilNilPct: number;
  topScores: Array<{ score: string; pct: number }>;
}

/** Shared preset teams. One source of truth for CLI, tests, and tuning. */
export const PRESETS: Record<"equal" | "strong" | "weak", Composites> = {
  equal: makeTeam("Average"),
  strong: makeTeam("Strong", {
    attack: 0.63,
    finishing: 0.6,
    defense: 0.63,
    keeping: 0.6,
    control: 0.62,
  }),
  weak: makeTeam("Weak", {
    attack: 0.38,
    finishing: 0.4,
    defense: 0.38,
    keeping: 0.4,
    control: 0.38,
  }),
};

/** Run n matches of home vs away with one seeded RNG stream. Pure: computes, never prints. */
export function runScenario(
  home: Composites,
  away: Composites,
  n: number,
  seed: number,
): ScenarioResult {
  const rng = mulberry32(seed);
  let hG = 0;
  let aG = 0;
  let shots = 0;
  let sot = 0;
  let hW = 0;
  let d = 0;
  let aW = 0;
  let nilnil = 0;
  const scoreCount = new Map<string, number>();

  for (let i = 0; i < n; i++) {
    const r = simMatch(rng, home, away);
    hG += r.home;
    aG += r.away;
    shots += r.stat.home.shots + r.stat.away.shots;
    sot += r.stat.home.sot + r.stat.away.sot;
    if (r.home > r.away) hW++;
    else if (r.home < r.away) aW++;
    else d++;
    if (r.home === 0 && r.away === 0) nilnil++;
    const key = `${r.home}-${r.away}`;
    scoreCount.set(key, (scoreCount.get(key) ?? 0) + 1);
  }

  const topScores = [...scoreCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([score, count]) => ({ score, pct: (100 * count) / n }));

  return {
    n,
    seed,
    goalsPerGame: (hG + aG) / n,
    homeGoals: hG / n,
    awayGoals: aG / n,
    shotsPerGame: shots / n,
    sotPerGame: sot / n,
    homeWinPct: (100 * hW) / n,
    drawPct: (100 * d) / n,
    awayWinPct: (100 * aW) / n,
    nilNilPct: (100 * nilnil) / n,
    topScores,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/montecarlo.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/montecarlo.ts test/montecarlo.test.ts
git commit -m "feat: add shared Monte Carlo scenario harness"
```

---

### Task 7: §8 validation gates

**Files:**
- Create: `test/validation/benchmarks.test.ts`

These assert the §8 ranges directly. Seeds reuse the PoC's (12345 / 6789 / 4242). With a
fixed seed the result is a single fixed number, so these are stable, not flaky.

- [ ] **Step 1: Write the validation test**

`test/validation/benchmarks.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { runScenario, PRESETS } from "../../src/engine/montecarlo.js";

const N = 20_000;

describe("§8 validation gates — equal teams (home vs away)", () => {
  const r = runScenario(PRESETS.equal, PRESETS.equal, N, 12345);

  it("goals/game in 2.6-2.9", () => {
    expect(r.goalsPerGame).toBeGreaterThanOrEqual(2.6);
    expect(r.goalsPerGame).toBeLessThanOrEqual(2.9);
  });
  it("shots/game in 23-27", () => {
    expect(r.shotsPerGame).toBeGreaterThanOrEqual(23);
    expect(r.shotsPerGame).toBeLessThanOrEqual(27);
  });
  it("shots on target in 8-9.5", () => {
    expect(r.sotPerGame).toBeGreaterThanOrEqual(8);
    expect(r.sotPerGame).toBeLessThanOrEqual(9.5);
  });
  it("draw rate in 23-28%", () => {
    expect(r.drawPct).toBeGreaterThanOrEqual(23);
    expect(r.drawPct).toBeLessThanOrEqual(28);
  });
  it("0-0 rate in 5-9%", () => {
    expect(r.nilNilPct).toBeGreaterThanOrEqual(5);
    expect(r.nilNilPct).toBeLessThanOrEqual(9);
  });
  it("home win rate in 38-46%", () => {
    expect(r.homeWinPct).toBeGreaterThanOrEqual(38);
    expect(r.homeWinPct).toBeLessThanOrEqual(46);
  });
});

describe("§8 validation gates — mismatch", () => {
  it("strong home beats weak 70-80% of the time", () => {
    const r = runScenario(PRESETS.strong, PRESETS.weak, N, 6789);
    expect(r.homeWinPct).toBeGreaterThanOrEqual(70);
    expect(r.homeWinPct).toBeLessThanOrEqual(80);
  });

  it("weak home avoids defeat vs strong at least 20% of the time", () => {
    const r = runScenario(PRESETS.weak, PRESETS.strong, N, 4242);
    const avoidsDefeat = r.homeWinPct + r.drawPct;
    expect(avoidsDefeat).toBeGreaterThanOrEqual(20);
  });
});
```

- [ ] **Step 2: Run the gates**

Run: `npx vitest run test/validation/benchmarks.test.ts`
Expected: PASS (8 tests). If any FAIL, the ported math diverged from the PoC — diff
`src/engine/matchSim.ts` and `src/engine/constants.ts` against `soccer-ticksim.mjs`. Do NOT
loosen the ranges to make it pass; fix the math.

- [ ] **Step 3: Commit**

```bash
git add test/validation/benchmarks.test.ts
git commit -m "test: add §8 Monte Carlo validation gates"
```

---

### Task 8: Public engine surface

**Files:**
- Create: `src/engine/index.ts`
- Test: `test/index.test.ts`

- [ ] **Step 1: Write the failing test**

`test/index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as engine from "../src/engine/index.js";

describe("engine public surface", () => {
  it("re-exports the core API", () => {
    expect(typeof engine.mulberry32).toBe("function");
    expect(typeof engine.makeTeam).toBe("function");
    expect(typeof engine.simMatch).toBe("function");
    expect(typeof engine.runScenario).toBe("function");
    expect(engine.PRESETS.equal.attack).toBe(0.5);
    expect(engine.MATCH_SECONDS).toBe(5400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/index.test.ts`
Expected: FAIL — cannot resolve `index.js`.

- [ ] **Step 3: Write the barrel file**

`src/engine/index.ts`:

```ts
export * from "./rng.js";
export * from "./constants.js";
export * from "./composites.js";
export * from "./matchSim.js";
export * from "./montecarlo.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/index.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/engine/index.ts test/index.test.ts
git commit -m "feat: add engine barrel export"
```

---

### Task 9: CLI

**Files:**
- Create: `scripts/cli.ts`

Manual-run tool; no automated test (thin I/O wrapper over tested functions).

- [ ] **Step 1: Write the CLI**

`scripts/cli.ts`:

```ts
import { parseArgs } from "node:util";
import { mulberry32 } from "../src/engine/rng.js";
import { simMatch } from "../src/engine/matchSim.js";
import { runScenario, PRESETS } from "../src/engine/montecarlo.js";
import type { Composites } from "../src/engine/composites.js";

function resolvePreset(name: string): Composites {
  if (name === "equal" || name === "strong" || name === "weak") {
    return PRESETS[name];
  }
  throw new Error(`unknown preset "${name}" (use equal | strong | weak)`);
}

function pct(x: number): string {
  return x.toFixed(1) + "%";
}

function runMatch(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      home: { type: "string", default: "strong" },
      away: { type: "string", default: "weak" },
      seed: { type: "string", default: "42" },
    },
  });
  const home = resolvePreset(values.home!);
  const away = resolvePreset(values.away!);
  const rng = mulberry32(Number(values.seed));
  const r = simMatch(rng, home, away);

  console.log(`${home.name} ${r.home} - ${r.away} ${away.name}`);
  console.log(`             ${home.name.padStart(6)}  ${away.name.padStart(6)}`);
  console.log(
    `  Shots      ${String(r.stat.home.shots).padStart(6)}  ${String(r.stat.away.shots).padStart(6)}`,
  );
  console.log(
    `  On target  ${String(r.stat.home.sot).padStart(6)}  ${String(r.stat.away.sot).padStart(6)}`,
  );
  console.log(
    `  Possession ${pct(100 * r.possessionHome).padStart(6)}  ${pct(100 * (1 - r.possessionHome)).padStart(6)}`,
  );
}

function runBench(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      scenario: { type: "string", default: "equal" },
      n: { type: "string", default: "20000" },
      seed: { type: "string", default: "12345" },
    },
  });
  const scenario = values.scenario!;
  const n = Number(values.n);
  const seed = Number(values.seed);

  const pairs: Record<string, [Composites, Composites]> = {
    equal: [PRESETS.equal, PRESETS.equal],
    mismatch: [PRESETS.strong, PRESETS.weak],
    upset: [PRESETS.weak, PRESETS.strong],
  };
  const pair = pairs[scenario];
  if (!pair) throw new Error(`unknown scenario "${scenario}" (equal | mismatch | upset)`);

  const r = runScenario(pair[0], pair[1], n, seed);
  console.log(`=== ${scenario} (${n.toLocaleString()} games, seed ${seed}) ===`);
  console.log(
    `  Goals/game:    ${r.goalsPerGame.toFixed(2)}  (home ${r.homeGoals.toFixed(2)}, away ${r.awayGoals.toFixed(2)})`,
  );
  console.log(`  Shots/game:    ${r.shotsPerGame.toFixed(2)}   on target: ${r.sotPerGame.toFixed(2)}`);
  console.log(
    `  Results:       home ${pct(r.homeWinPct)} | draw ${pct(r.drawPct)} | away ${pct(r.awayWinPct)}`,
  );
  console.log(`  0-0 rate:      ${pct(r.nilNilPct)}`);
  console.log(
    `  Common scores: ${r.topScores.map((s) => `${s.score} (${pct(s.pct)})`).join(", ")}`,
  );
}

const [command, ...rest] = process.argv.slice(2);
if (command === "match") runMatch(rest);
else if (command === "bench") runBench(rest);
else {
  console.log("usage: npm run cli <match|bench> [options]");
  console.log("  match --home <preset> --away <preset> --seed <n>");
  console.log("  bench --scenario <equal|mismatch|upset> --n <n> --seed <n>");
  process.exit(command ? 1 : 0);
}
```

- [ ] **Step 2: Verify `match` runs**

Run: `npm run cli match --home strong --away weak --seed 42`
Expected: a scoreline plus a Shots / On target / Possession table.

- [ ] **Step 3: Verify `bench` runs and matches the PoC**

Run: `npm run cli bench --scenario equal --n 20000 --seed 12345`
Expected: Goals/game ≈ 2.79, Shots ≈ 25.76, on target ≈ 8.70, home ≈ 39.8% / draw ≈ 25.3% / away ≈ 34.9%, 0-0 ≈ 6.2% — matching the PoC output.

- [ ] **Step 4: Commit**

```bash
git add scripts/cli.ts
git commit -m "feat: add match and bench CLI subcommands"
```

---

### Task 10: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
```

- [ ] **Step 2: Verify the same commands pass locally**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all test files pass (rng, composites, matchSim, montecarlo, index, validation gates).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run typecheck and tests on push"
```

---

## Final verification

- [ ] Run the full suite: `npm test` → all green, including the 8 §8 gates.
- [ ] Run `npm run typecheck` → no errors.
- [ ] Run `npm run cli bench --scenario equal` → numbers match the PoC (~2.79 goals/game).
- [ ] Confirm no browser APIs in `src/engine/` — every module imports only from `./` and `node:` builtins (the CLI uses `node:util`; the engine itself uses nothing).
- [ ] Definition of done (from the design doc) all satisfied.
