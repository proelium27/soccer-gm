# M1 — Players → Composites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the match engine's hardcoded team composites with composites rolled up from generated players, so a full generated league still hits the M0 Monte-Carlo benchmarks and produces a realistic end-of-season table spread.

**Architecture:** Pure, Node-importable, seeded `src/core/` modules generate players (hybrid talent model: league base + per-team target + position archetype), compute per-position OVR, select a starting XI per formation, roll the XI up into the engine's five `Composites`, and z-normalize composites across the league so the average XI sits at 0.5. A minimal shared round-robin + standings module lets validation sim a full season. The M0 engine (`src/engine/`) is consumed unchanged; `core` depends on `engine`, never the reverse.

**Tech Stack:** TypeScript (strict, ESM/NodeNext — relative imports use `.js` extensions), Vitest, seeded mulberry32 RNG. No `Math.random()` anywhere.

---

## File Structure

**Create (source):**
- `src/core/constants.ts` — M1 tunables (team spread, noise, roster composition, tier offsets).
- `src/core/players/types.ts` — `Position`, `SkillKey`, `PlayerRatings`, `Player`, and stub `SeasonStats`/`RatingsSnapshot`.
- `src/core/players/templates.ts` — Table A (generation offsets), Table B (OVR weights), height ranges.
- `src/core/players/ovr.ts` — `computeOvr(player)`.
- `src/core/players/names.ts` — `generateName(rng, nationality)`.
- `src/core/players/generate.ts` — `generatePlayer(rng, pos, base, pid)`.
- `src/core/lineup/formations.ts` — `FORMATIONS` (four shapes as slot lists).
- `src/core/lineup/selectXI.ts` — `selectXI(roster, formation)`.
- `src/core/composites.ts` — `rollupComposites(startingXI, teamName)` → engine `Composites`.
- `src/core/league/generate.ts` — `generateLeague(rng, opts)` → `{ teams, players }`.
- `src/core/league/normalize.ts` — `normalizeLeague(rawComposites)`.
- `src/core/schedule.ts` — `doubleRoundRobin(teamIds)`.
- `src/core/standings.ts` — `computeStandings(results)`.
- `src/core/index.ts` — barrel export.

**Create (tests):**
- `test/core/ovr.test.ts`, `test/core/names.test.ts`, `test/core/generate.test.ts`,
  `test/core/formations.test.ts`, `test/core/selectXI.test.ts`, `test/core/rollup.test.ts`,
  `test/core/normalize.test.ts`, `test/core/schedule.test.ts`, `test/core/standings.test.ts`,
  `test/core/league.test.ts`
- `test/validation/m1-benchmarks.test.ts`, `test/validation/m1-table-spread.test.ts`

**Consume unchanged:** `src/engine/composites.ts` (`Composites`, `makeTeam`), `src/engine/rng.ts` (`mulberry32`), `src/engine/matchSim.ts` (`simMatch`), `src/engine/montecarlo.ts` (`runScenario`).

---

## Task 1: Player types and M1 constants

**Files:**
- Create: `src/core/players/types.ts`
- Create: `src/core/constants.ts`
- Test: `test/core/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/core/types.test.ts
import { describe, it, expect } from "vitest";
import { SKILL_KEYS, POSITIONS } from "../../src/core/players/types.js";
import { ROSTER_COMPOSITION, TIER_OFFSET } from "../../src/core/constants.js";

describe("player types + constants", () => {
  it("has 14 skill keys and 8 positions", () => {
    expect(SKILL_KEYS).toHaveLength(14);
    expect(POSITIONS).toHaveLength(8);
  });
  it("roster composition sums to 25 and covers every position", () => {
    const total = POSITIONS.reduce((s, p) => s + ROSTER_COMPOSITION[p], 0);
    expect(total).toBe(25);
    for (const p of POSITIONS) expect(ROSTER_COMPOSITION[p]).toBeGreaterThan(0);
  });
  it("tier offsets are ordered star > H > M > L > VL", () => {
    expect(TIER_OFFSET.star).toBeGreaterThan(TIER_OFFSET.H);
    expect(TIER_OFFSET.H).toBeGreaterThan(TIER_OFFSET.M);
    expect(TIER_OFFSET.M).toBeGreaterThan(TIER_OFFSET.L);
    expect(TIER_OFFSET.L).toBeGreaterThan(TIER_OFFSET.VL);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/types.test.ts`
Expected: FAIL — cannot resolve `../../src/core/players/types.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/core/players/types.ts
export const POSITIONS = ["GK", "CB", "FB", "DM", "CM", "AM", "W", "ST"] as const;
export type Position = (typeof POSITIONS)[number];

export const SKILL_KEYS = [
  "speed", "strength", "stamina", "jumping",
  "shortPass", "longPass", "crosses",
  "dribbling", "longShot", "finishing",
  "tackling", "interceptions", "positioning", "goalkeeping",
] as const;
export type SkillKey = (typeof SKILL_KEYS)[number];

export type PlayerRatings = Record<SkillKey, number>;

/** Placeholder shapes — populated in later milestones (M3/M4). */
export interface SeasonStats { season: number; }
export interface RatingsSnapshot { season: number; ratings: PlayerRatings; ovr: number; }

export interface Player {
  pid: number;
  name: string;
  nationality: string;
  born: number;
  pos: Position;
  heightCm: number;
  ratings: PlayerRatings;
  ovr: number;
  potential: number;
  contract: { salary: number; expiresSeason: number };
  injury: { gamesRemaining: number; type: string } | null;
  stats: SeasonStats[];
  hist: RatingsSnapshot[];
}
```

```ts
// src/core/constants.ts
import type { Position } from "./players/types.js";

/** League-average base rating; a team's base = LEAGUE_BASE + its strength target. */
export const LEAGUE_BASE = 52;

/** Half-range of per-team strength targets. THE dial for table spread. */
export const TEAM_STRENGTH_SPREAD = 12;

/** Std dev of per-player, per-rating gaussian noise. */
export const RATING_NOISE_SD = 6;

/** Absolute-low pool for position-exclusive stats (independent of base). */
export const ABS_LOW_MIN = 5;
export const ABS_LOW_MAX = 20;

/** Ratings are clamped to this inclusive range. */
export const RATING_MIN = 1;
export const RATING_MAX = 99;

/** Players generated per team, by position (sums to 25). */
export const ROSTER_COMPOSITION: Record<Position, number> = {
  GK: 3, CB: 4, FB: 4, DM: 2, CM: 4, AM: 2, W: 3, ST: 3,
};

/** Generation-offset tier → additive offset (Table A). */
export const TIER_OFFSET = { star: 18, H: 10, M: 2, L: -12, VL: -25 } as const;

export const NUM_TEAMS = 20;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/types.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/players/types.ts src/core/constants.ts test/core/types.test.ts
git commit -m "feat(core): player types and M1 constants"
```

---

## Task 2: Archetype templates (Table A + Table B)

**Files:**
- Create: `src/core/players/templates.ts`
- Test: `test/core/templates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/core/templates.test.ts
import { describe, it, expect } from "vitest";
import { GEN_OFFSETS, OVR_WEIGHTS, HEIGHT_RANGES } from "../../src/core/players/templates.js";
import { POSITIONS, SKILL_KEYS } from "../../src/core/players/types.js";

describe("archetype templates", () => {
  it("every position defines an offset tier for every skill", () => {
    for (const pos of POSITIONS)
      for (const s of SKILL_KEYS)
        expect(GEN_OFFSETS[pos][s]).toBeDefined();
  });
  it("every position's OVR weights sum to 100", () => {
    for (const pos of POSITIONS) {
      const sum = Object.values(OVR_WEIGHTS[pos]).reduce((a, b) => a + b, 0);
      expect(sum).toBe(100);
    }
  });
  it("GK is goalkeeper-dominant, ST is finishing-dominant", () => {
    expect(OVR_WEIGHTS.GK.goalkeeping).toBe(78);
    expect(OVR_WEIGHTS.ST.finishing).toBe(26);
    expect(GEN_OFFSETS.GK.goalkeeping).toBe("star");
    expect(GEN_OFFSETS.ST.goalkeeping).toBe("ABS");
  });
  it("every position has a valid height range low <= high", () => {
    for (const pos of POSITIONS) {
      const [lo, hi] = HEIGHT_RANGES[pos];
      expect(lo).toBeLessThanOrEqual(hi);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/templates.test.ts`
Expected: FAIL — cannot resolve `templates.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/core/players/templates.ts
import type { Position, SkillKey } from "./types.js";

/** Generation-offset tier. "ABS" = drawn from the absolute-low pool. */
export type Tier = "star" | "H" | "M" | "L" | "VL" | "ABS";

/** Table A — generation offsets (center of the roll) per position per skill. */
export const GEN_OFFSETS: Record<Position, Record<SkillKey, Tier>> = {
  GK: { speed: "L", strength: "M", stamina: "L", jumping: "H", shortPass: "M", longPass: "H", crosses: "ABS", dribbling: "ABS", longShot: "ABS", finishing: "ABS", tackling: "ABS", interceptions: "L", positioning: "H", goalkeeping: "star" },
  CB: { speed: "M", strength: "H", stamina: "M", jumping: "H", shortPass: "M", longPass: "M", crosses: "L", dribbling: "L", longShot: "L", finishing: "L", tackling: "star", interceptions: "H", positioning: "H", goalkeeping: "ABS" },
  FB: { speed: "H", strength: "M", stamina: "H", jumping: "L", shortPass: "M", longPass: "M", crosses: "H", dribbling: "M", longShot: "L", finishing: "L", tackling: "H", interceptions: "H", positioning: "M", goalkeeping: "ABS" },
  DM: { speed: "M", strength: "H", stamina: "H", jumping: "M", shortPass: "H", longPass: "H", crosses: "L", dribbling: "M", longShot: "M", finishing: "L", tackling: "H", interceptions: "star", positioning: "H", goalkeeping: "ABS" },
  CM: { speed: "M", strength: "M", stamina: "H", jumping: "M", shortPass: "star", longPass: "H", crosses: "M", dribbling: "H", longShot: "M", finishing: "M", tackling: "M", interceptions: "M", positioning: "H", goalkeeping: "ABS" },
  AM: { speed: "H", strength: "L", stamina: "M", jumping: "L", shortPass: "H", longPass: "H", crosses: "M", dribbling: "star", longShot: "H", finishing: "H", tackling: "L", interceptions: "L", positioning: "H", goalkeeping: "ABS" },
  W:  { speed: "star", strength: "L", stamina: "H", jumping: "L", shortPass: "M", longPass: "L", crosses: "H", dribbling: "star", longShot: "M", finishing: "H", tackling: "L", interceptions: "L", positioning: "M", goalkeeping: "ABS" },
  ST: { speed: "H", strength: "H", stamina: "M", jumping: "H", shortPass: "M", longPass: "L", crosses: "L", dribbling: "M", longShot: "H", finishing: "star", tackling: "VL", interceptions: "L", positioning: "star", goalkeeping: "ABS" },
};

/** Table B — OVR weights (%). Keys may include "height". Each row sums to 100. */
export type OvrKey = SkillKey | "height";
export const OVR_WEIGHTS: Record<Position, Partial<Record<OvrKey, number>>> = {
  GK: { goalkeeping: 78, positioning: 8, jumping: 5, height: 4, longPass: 3, shortPass: 2 },
  CB: { tackling: 20, interceptions: 18, positioning: 16, strength: 14, jumping: 10, height: 6, speed: 6, longPass: 5, shortPass: 5 },
  FB: { speed: 15, tackling: 14, interceptions: 13, stamina: 12, crosses: 12, positioning: 10, shortPass: 8, dribbling: 8, strength: 8 },
  DM: { interceptions: 18, positioning: 16, tackling: 15, shortPass: 15, longPass: 12, stamina: 10, strength: 8, dribbling: 6 },
  CM: { shortPass: 18, longPass: 15, positioning: 14, stamina: 12, dribbling: 12, longShot: 8, interceptions: 8, tackling: 7, finishing: 6 },
  AM: { dribbling: 18, finishing: 15, shortPass: 14, positioning: 14, longShot: 13, longPass: 12, speed: 8, crosses: 6 },
  W:  { speed: 20, dribbling: 18, crosses: 16, finishing: 14, stamina: 10, longShot: 8, shortPass: 8, positioning: 6 },
  ST: { finishing: 26, positioning: 20, longShot: 14, speed: 12, strength: 10, jumping: 8, height: 5, dribbling: 5 },
};

/** Height range [lowCm, highCm] per position. */
export const HEIGHT_RANGES: Record<Position, [number, number]> = {
  GK: [188, 198], CB: [185, 195], FB: [172, 182], DM: [178, 188],
  CM: [175, 185], AM: [170, 180], W: [170, 180], ST: [178, 190],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/templates.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/players/templates.ts test/core/templates.test.ts
git commit -m "feat(core): archetype generation-offset and OVR-weight tables"
```

---

## Task 3: OVR computation

**Files:**
- Create: `src/core/players/ovr.ts`
- Test: `test/core/ovr.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/core/ovr.test.ts
import { describe, it, expect } from "vitest";
import { computeOvr, heightScore } from "../../src/core/players/ovr.js";
import type { PlayerRatings } from "../../src/core/players/types.js";

const flat = (v: number): PlayerRatings => ({
  speed: v, strength: v, stamina: v, jumping: v, shortPass: v, longPass: v,
  crosses: v, dribbling: v, longShot: v, finishing: v, tackling: v,
  interceptions: v, positioning: v, goalkeeping: v,
});

describe("computeOvr", () => {
  it("a flat-50 player scores ~50 regardless of position (height ~ mid)", () => {
    const ovr = computeOvr("CM", flat(50), 180);
    expect(ovr).toBeGreaterThanOrEqual(45);
    expect(ovr).toBeLessThanOrEqual(55);
  });
  it("weights the position's signature stat: raising GK goalkeeping moves GK ovr a lot", () => {
    const base = computeOvr("GK", flat(50), 193);
    const better = computeOvr("GK", { ...flat(50), goalkeeping: 90 }, 193);
    expect(better - base).toBeGreaterThan(25); // 78% weight * 40 points
  });
  it("ignores zero-weight stats: raising a GK's finishing barely moves ovr", () => {
    const base = computeOvr("GK", flat(50), 193);
    const same = computeOvr("GK", { ...flat(50), finishing: 99 }, 193);
    expect(Math.abs(same - base)).toBeLessThan(1);
  });
  it("heightScore maps 160cm->0 and 200cm->100, clamped", () => {
    expect(heightScore(160)).toBe(0);
    expect(heightScore(200)).toBe(100);
    expect(heightScore(150)).toBe(0);
    expect(heightScore(210)).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/ovr.test.ts`
Expected: FAIL — cannot resolve `ovr.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/core/players/ovr.ts
import type { Position, PlayerRatings } from "./types.js";
import { OVR_WEIGHTS, type OvrKey } from "./templates.js";

/** Map height in cm to a 0..100 contribution (160cm -> 0, 200cm -> 100). */
export function heightScore(cm: number): number {
  return Math.max(0, Math.min(100, ((cm - 160) / 40) * 100));
}

/** Weighted per-position overall from ratings + height. Rounded to an integer. */
export function computeOvr(pos: Position, ratings: PlayerRatings, heightCm: number): number {
  const weights = OVR_WEIGHTS[pos];
  let sum = 0;
  for (const key of Object.keys(weights) as OvrKey[]) {
    const w = weights[key]!;
    const value = key === "height" ? heightScore(heightCm) : ratings[key];
    sum += (w / 100) * value;
  }
  return Math.round(sum);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/ovr.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/players/ovr.ts test/core/ovr.test.ts
git commit -m "feat(core): per-position OVR computation"
```

---

## Task 4: Name generator

**Files:**
- Create: `src/core/players/names.ts`
- Test: `test/core/names.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/core/names.test.ts
import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generateName } from "../../src/core/players/names.js";

describe("generateName", () => {
  it("produces a non-empty 'First Last' string", () => {
    const name = generateName(mulberry32(1), "Genero");
    expect(name).toMatch(/^\S+ \S+$/);
  });
  it("is deterministic for a given seed", () => {
    expect(generateName(mulberry32(42), "Genero")).toBe(generateName(mulberry32(42), "Genero"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/names.test.ts`
Expected: FAIL — cannot resolve `names.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/core/players/names.ts
// Placeholder-grade generator: syllable assembly, nationality currently unused
// (an M2 cosmetic concern). Deterministic given the RNG stream.
const ONSETS = ["b", "d", "f", "k", "l", "m", "n", "r", "s", "t", "v", "br", "kr", "st", "gr"];
const NUCLEI = ["a", "e", "i", "o", "u", "ai", "ei", "ou"];
const CODAS = ["n", "r", "s", "l", "k", "", "", "nt", "rk"];

function syllable(rng: () => number): string {
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  return pick(ONSETS) + pick(NUCLEI) + pick(CODAS);
}

function word(rng: () => number, syllables: number): string {
  let s = "";
  for (let i = 0; i < syllables; i++) s += syllable(rng);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function generateName(rng: () => number, _nationality: string): string {
  const first = word(rng, 1 + Math.floor(rng() * 2));
  const last = word(rng, 1 + Math.floor(rng() * 2));
  return `${first} ${last}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/names.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/players/names.ts test/core/names.test.ts
git commit -m "feat(core): placeholder name generator"
```

---

## Task 5: Player generation

**Files:**
- Create: `src/core/players/generate.ts`
- Test: `test/core/generate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/core/generate.test.ts
import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generatePlayer } from "../../src/core/players/generate.js";
import { RATING_MIN, RATING_MAX, ABS_LOW_MAX } from "../../src/core/constants.js";

describe("generatePlayer", () => {
  it("returns a complete player with all ratings in range", () => {
    const p = generatePlayer(mulberry32(7), "ST", 55, 1);
    expect(p.pid).toBe(1);
    expect(p.pos).toBe("ST");
    expect(p.ovr).toBeGreaterThan(0);
    for (const v of Object.values(p.ratings)) {
      expect(v).toBeGreaterThanOrEqual(RATING_MIN);
      expect(v).toBeLessThanOrEqual(RATING_MAX);
    }
    expect(p.potential).toBeGreaterThanOrEqual(p.ovr);
  });
  it("is deterministic for a given seed", () => {
    const a = generatePlayer(mulberry32(9), "CB", 60, 3);
    const b = generatePlayer(mulberry32(9), "CB", 60, 3);
    expect(a).toEqual(b);
  });
  it("archetype holds: a generated ST out-finishes a generated CB on average", () => {
    let stFin = 0, cbFin = 0;
    for (let i = 0; i < 200; i++) {
      stFin += generatePlayer(mulberry32(1000 + i), "ST", 55, i).ratings.finishing;
      cbFin += generatePlayer(mulberry32(1000 + i), "CB", 55, i).ratings.finishing;
    }
    expect(stFin / 200).toBeGreaterThan(cbFin / 200 + 15);
  });
  it("position-exclusive stats stay low regardless of team quality", () => {
    // An elite-base striker still cannot keep goal.
    const elite = generatePlayer(mulberry32(3), "ST", 80, 1);
    expect(elite.ratings.goalkeeping).toBeLessThanOrEqual(ABS_LOW_MAX);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/generate.test.ts`
Expected: FAIL — cannot resolve `generate.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/core/players/generate.ts
import type { Player, Position, PlayerRatings, SkillKey } from "./types.js";
import { SKILL_KEYS } from "./types.js";
import { GEN_OFFSETS, HEIGHT_RANGES, type Tier } from "./templates.js";
import { computeOvr } from "./ovr.js";
import { generateName } from "./names.js";
import {
  TIER_OFFSET, RATING_NOISE_SD, ABS_LOW_MIN, ABS_LOW_MAX,
  RATING_MIN, RATING_MAX,
} from "../constants.js";

const clampRating = (x: number): number =>
  Math.round(Math.max(RATING_MIN, Math.min(RATING_MAX, x)));

/** Standard-normal sample via Box-Muller from the seeded stream. */
function gaussian(rng: () => number): number {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function rollRating(rng: () => number, tier: Tier, base: number): number {
  if (tier === "ABS") {
    return clampRating(ABS_LOW_MIN + rng() * (ABS_LOW_MAX - ABS_LOW_MIN));
  }
  const offset = TIER_OFFSET[tier];
  return clampRating(base + offset + gaussian(rng) * RATING_NOISE_SD);
}

export function generatePlayer(
  rng: () => number,
  pos: Position,
  base: number,
  pid: number,
): Player {
  const tiers = GEN_OFFSETS[pos];
  const ratings = {} as PlayerRatings;
  for (const key of SKILL_KEYS as readonly SkillKey[]) {
    ratings[key] = rollRating(rng, tiers[key], base);
  }

  const [loH, hiH] = HEIGHT_RANGES[pos];
  const heightCm = Math.round(loH + rng() * (hiH - loH));

  const ovr = computeOvr(pos, ratings, heightCm);
  const potential = Math.min(RATING_MAX, ovr + Math.round(rng() * 15));

  return {
    pid,
    name: generateName(rng, "Genero"),
    nationality: "Genero",
    born: 0,
    pos,
    heightCm,
    ratings,
    ovr,
    potential,
    contract: { salary: 0, expiresSeason: 1 },
    injury: null,
    stats: [],
    hist: [],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/generate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/players/generate.ts test/core/generate.test.ts
git commit -m "feat(core): player generation with archetype offsets"
```

---

## Task 6: Formations

**Files:**
- Create: `src/core/lineup/formations.ts`
- Test: `test/core/formations.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/core/formations.test.ts
import { describe, it, expect } from "vitest";
import { FORMATIONS, FORMATION_IDS } from "../../src/core/lineup/formations.js";

describe("formations", () => {
  it("defines the four shapes, each with 11 slots and exactly one GK", () => {
    expect(FORMATION_IDS).toEqual(["4-3-3", "4-4-2", "3-5-2", "5-3-2"]);
    for (const id of FORMATION_IDS) {
      const slots = FORMATIONS[id];
      expect(slots).toHaveLength(11);
      expect(slots.filter((p) => p === "GK")).toHaveLength(1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/formations.test.ts`
Expected: FAIL — cannot resolve `formations.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/core/lineup/formations.ts
import type { Position } from "../players/types.js";

export const FORMATION_IDS = ["4-3-3", "4-4-2", "3-5-2", "5-3-2"] as const;
export type FormationId = (typeof FORMATION_IDS)[number];

/** Each formation is the multiset of position slots to fill (always 11). */
export const FORMATIONS: Record<FormationId, Position[]> = {
  "4-3-3": ["GK", "CB", "CB", "FB", "FB", "DM", "CM", "CM", "W", "W", "ST"],
  "4-4-2": ["GK", "CB", "CB", "FB", "FB", "W", "CM", "CM", "W", "ST", "ST"],
  "3-5-2": ["GK", "CB", "CB", "CB", "FB", "FB", "CM", "CM", "AM", "ST", "ST"],
  "5-3-2": ["GK", "CB", "CB", "CB", "FB", "FB", "DM", "CM", "CM", "ST", "ST"],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/formations.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/core/lineup/formations.ts test/core/formations.test.ts
git commit -m "feat(core): formation shapes"
```

---

## Task 7: Starting-XI selection

**Files:**
- Create: `src/core/lineup/selectXI.ts`
- Test: `test/core/selectXI.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/core/selectXI.test.ts
import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generatePlayer } from "../../src/core/players/generate.js";
import { selectXI } from "../../src/core/lineup/selectXI.js";
import { FORMATIONS } from "../../src/core/lineup/formations.js";
import { ROSTER_COMPOSITION } from "../../src/core/constants.js";
import { POSITIONS } from "../../src/core/players/types.js";
import type { Player } from "../../src/core/players/types.js";

function roster(seed: number): Player[] {
  const rng = mulberry32(seed);
  const players: Player[] = [];
  let pid = 0;
  for (const pos of POSITIONS)
    for (let i = 0; i < ROSTER_COMPOSITION[pos]; i++)
      players.push(generatePlayer(rng, pos, 52, pid++));
  return players;
}

describe("selectXI", () => {
  it("returns 11 distinct players for a 4-3-3", () => {
    const xi = selectXI(roster(1), FORMATIONS["4-3-3"]);
    expect(xi).toHaveLength(11);
    expect(new Set(xi.map((p) => p.pid)).size).toBe(11);
  });
  it("puts a natural GK in the GK slot", () => {
    const xi = selectXI(roster(2), FORMATIONS["4-3-3"]);
    expect(xi[0].pos).toBe("GK");
  });
  it("fills every slot even when a natural position is missing (adjacency fallback)", () => {
    const noFb = roster(3).filter((p) => p.pos !== "FB");
    const xi = selectXI(noFb, FORMATIONS["4-3-3"]);
    expect(xi).toHaveLength(11);
    expect(new Set(xi.map((p) => p.pid)).size).toBe(11);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/selectXI.test.ts`
Expected: FAIL — cannot resolve `selectXI.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/core/lineup/selectXI.ts
import type { Player, Position } from "../players/types.js";

/** Positions that can cover for each other when a natural fit is unavailable. */
const ADJACENCY: Record<Position, Position[]> = {
  GK: [],
  CB: ["DM", "FB"],
  FB: ["W", "CB", "DM"],
  DM: ["CM", "CB"],
  CM: ["DM", "AM"],
  AM: ["CM", "W"],
  W: ["AM", "FB", "ST"],
  ST: ["W", "AM"],
};

/** Rank a candidate for a slot: 0 = exact, 1 = adjacent, 2 = anything. Lower is better. */
function fitRank(slot: Position, candidate: Position): number {
  if (candidate === slot) return 0;
  if (ADJACENCY[slot].includes(candidate)) return 1;
  return 2;
}

/**
 * Greedily fill each slot with the best available player: prefer exact position,
 * then adjacent, then anyone; break ties by higher ovr. Deterministic.
 */
export function selectXI(roster: Player[], slots: Position[]): Player[] {
  const available = new Set(roster.map((p) => p.pid));
  const byPid = new Map(roster.map((p) => [p.pid, p]));
  const xi: Player[] = [];

  for (const slot of slots) {
    let best: Player | null = null;
    let bestKey: [number, number] | null = null; // [fitRank, -ovr]
    for (const pid of available) {
      const p = byPid.get(pid)!;
      const key: [number, number] = [fitRank(slot, p.pos), -p.ovr];
      if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
        best = p;
        bestKey = key;
      }
    }
    if (best) {
      xi.push(best);
      available.delete(best.pid);
    }
  }
  return xi;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/selectXI.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/lineup/selectXI.ts test/core/selectXI.test.ts
git commit -m "feat(core): starting-XI selection with adjacency fallback"
```

---

## Task 8: Composite rollup

**Files:**
- Create: `src/core/composites.ts`
- Test: `test/core/rollup.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/core/rollup.test.ts
import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generatePlayer } from "../../src/core/players/generate.js";
import { selectXI } from "../../src/core/lineup/selectXI.js";
import { FORMATIONS } from "../../src/core/lineup/formations.js";
import { rollupComposites } from "../../src/core/composites.js";
import { ROSTER_COMPOSITION } from "../../src/core/constants.js";
import { POSITIONS } from "../../src/core/players/types.js";
import type { Player } from "../../src/core/players/types.js";

function xiFor(seed: number, base: number): Player[] {
  const rng = mulberry32(seed);
  const players: Player[] = [];
  let pid = 0;
  for (const pos of POSITIONS)
    for (let i = 0; i < ROSTER_COMPOSITION[pos]; i++)
      players.push(generatePlayer(rng, pos, base, pid++));
  return selectXI(players, FORMATIONS["4-3-3"]);
}

describe("rollupComposites", () => {
  it("returns a named Composites with all five raw values > 0", () => {
    const c = rollupComposites(xiFor(1, 52), "Test FC");
    expect(c.name).toBe("Test FC");
    for (const k of ["attack", "finishing", "defense", "keeping", "control"] as const)
      expect(c[k]).toBeGreaterThan(0);
  });
  it("a higher-base XI rolls up stronger raw composites than a lower-base XI", () => {
    const strong = rollupComposites(xiFor(1, 66), "Strong");
    const weak = rollupComposites(xiFor(1, 40), "Weak");
    expect(strong.attack).toBeGreaterThan(weak.attack);
    expect(strong.defense).toBeGreaterThan(weak.defense);
    expect(strong.keeping).toBeGreaterThan(weak.keeping);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/rollup.test.ts`
Expected: FAIL — cannot resolve `composites.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/core/composites.ts
import type { Composites } from "../engine/composites.js";
import type { Player, Position, SkillKey } from "./players/types.js";
import { heightScore } from "./players/ovr.js";

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

/** Average a set of skills (0..100) over a group of players, returned on 0..1. */
function groupAvg(players: Player[], skills: SkillKey[]): number {
  const vals: number[] = [];
  for (const p of players) for (const s of skills) vals.push(p.ratings[s]);
  return mean(vals) / 100;
}

/** Aerial ability per player: jumping + height reach, on 0..1. */
function aerial(p: Player): number {
  return (p.ratings.jumping + heightScore(p.heightCm)) / 200;
}

const inPos = (xi: Player[], ...pos: Position[]): Player[] =>
  xi.filter((p) => pos.includes(p.pos));

/** Weighted expected shot share by position (ST > W > AM > others). */
const SHOT_SHARE: Partial<Record<Position, number>> = {
  ST: 4, W: 2.5, AM: 2, CM: 1, FB: 0.5, DM: 0.5, CB: 0.3,
};

/**
 * Roll the on-pitch 11 up into the engine's five RAW (unnormalized) composites,
 * per SOCCER_GM_SPEC.md §4 mapped onto the 15-stat set. Values are ~0..1;
 * league normalization (Task 10) rescales them so the average XI hits 0.5.
 */
export function rollupComposites(xi: Player[], teamName: string): Composites {
  const gk = xi.find((p) => p.pos === "GK");
  const outfield = xi.filter((p) => p.pos !== "GK");
  const attackers = inPos(xi, "ST", "W", "AM", "CM");
  const defenders = inPos(xi, "CB", "FB", "DM");

  const attack = groupAvg(attackers, [
    "finishing", "longShot", "dribbling", "speed", "positioning", "crosses",
  ]);

  // finishing: shot-share-weighted finishing/longShot/positioning across outfielders
  let fw = 0;
  let fsum = 0;
  for (const p of outfield) {
    const share = SHOT_SHARE[p.pos] ?? 0.3;
    const q = (p.ratings.finishing + p.ratings.longShot + p.ratings.positioning) / 3 / 100;
    fsum += share * q;
    fw += share;
  }
  const finishing = fw === 0 ? 0.5 : fsum / fw;

  const defenseBase = groupAvg(defenders, [
    "tackling", "interceptions", "positioning", "strength",
  ]);
  const defenseAerial = mean(defenders.map(aerial));
  const defense = 0.75 * defenseBase + 0.25 * defenseAerial;

  const keeping = gk
    ? 0.85 * (gk.ratings.goalkeeping / 100) + 0.15 * aerial(gk)
    : 0.5;

  const control = groupAvg(outfield, [
    "shortPass", "longPass", "dribbling", "positioning",
  ]);

  return { name: teamName, attack, finishing, defense, keeping, control };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/rollup.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/composites.ts test/core/rollup.test.ts
git commit -m "feat(core): composite rollup from starting XI"
```

---

## Task 9: League generation

**Files:**
- Create: `src/core/league/generate.ts`
- Test: `test/core/league.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/core/league.test.ts
import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generateLeague } from "../../src/core/league/generate.js";
import { NUM_TEAMS } from "../../src/core/constants.js";

describe("generateLeague", () => {
  it("creates NUM_TEAMS teams each with a 25-player roster of unique pids", () => {
    const { teams, players } = generateLeague(mulberry32(1));
    expect(teams).toHaveLength(NUM_TEAMS);
    expect(players).toHaveLength(NUM_TEAMS * 25);
    expect(new Set(players.map((p) => p.pid)).size).toBe(players.length);
    for (const t of teams) expect(t.roster).toHaveLength(25);
  });
  it("is deterministic for a given seed", () => {
    const a = generateLeague(mulberry32(5));
    const b = generateLeague(mulberry32(5));
    expect(a.teams.map((t) => t.avgOvr)).toEqual(b.teams.map((t) => t.avgOvr));
  });
  it("produces a talent ladder: team strength targets span a range", () => {
    const { teams } = generateLeague(mulberry32(2));
    const ovrs = teams.map((t) => t.avgOvr).sort((x, y) => x - y);
    expect(ovrs[ovrs.length - 1] - ovrs[0]).toBeGreaterThan(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/league.test.ts`
Expected: FAIL — cannot resolve `league/generate.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/core/league/generate.ts
import type { Player, Position } from "../players/types.js";
import { POSITIONS } from "../players/types.js";
import { generatePlayer } from "../players/generate.js";
import {
  NUM_TEAMS, LEAGUE_BASE, TEAM_STRENGTH_SPREAD, ROSTER_COMPOSITION,
} from "../constants.js";

export interface LeagueTeam {
  tid: number;
  name: string;
  roster: number[]; // pids
  avgOvr: number;
}

export interface League {
  teams: LeagueTeam[];
  players: Player[];
}

/**
 * Hybrid talent model: each team gets a strength target evenly spaced across
 * [-SPREAD, +SPREAD]; every player is generated around base = LEAGUE_BASE +
 * target, biased by position archetype. Deterministic given the RNG.
 */
export function generateLeague(rng: () => number): League {
  const teams: LeagueTeam[] = [];
  const players: Player[] = [];
  let pid = 0;

  for (let tid = 0; tid < NUM_TEAMS; tid++) {
    // Evenly spaced target: strongest at tid 0, weakest at the end.
    const frac = NUM_TEAMS === 1 ? 0 : tid / (NUM_TEAMS - 1); // 0..1
    const target = TEAM_STRENGTH_SPREAD - frac * (2 * TEAM_STRENGTH_SPREAD);
    const base = LEAGUE_BASE + target;

    const roster: number[] = [];
    let ovrSum = 0;
    for (const pos of POSITIONS as readonly Position[]) {
      for (let i = 0; i < ROSTER_COMPOSITION[pos]; i++) {
        const p = generatePlayer(rng, pos, base, pid++);
        players.push(p);
        roster.push(p.pid);
        ovrSum += p.ovr;
      }
    }
    teams.push({
      tid,
      name: `Team ${tid + 1}`,
      roster,
      avgOvr: ovrSum / roster.length,
    });
  }

  return { teams, players };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/league.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/league/generate.ts test/core/league.test.ts
git commit -m "feat(core): hybrid-talent league generation"
```

---

## Task 10: League normalization

**Files:**
- Create: `src/core/league/normalize.ts`
- Test: `test/core/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/core/normalize.test.ts
import { describe, it, expect } from "vitest";
import { normalizeLeague } from "../../src/core/league/normalize.js";
import type { Composites } from "../../src/engine/composites.js";

function raw(name: string, a: number): Composites {
  return { name, attack: a, finishing: a, defense: a, keeping: a, control: a };
}

describe("normalizeLeague", () => {
  it("maps the average team to ~0.5 on every composite", () => {
    const inputs = [raw("A", 0.4), raw("B", 0.5), raw("C", 0.6)];
    const out = normalizeLeague(inputs);
    const mid = out.find((c) => c.name === "B")!;
    for (const k of ["attack", "finishing", "defense", "keeping", "control"] as const)
      expect(mid[k]).toBeCloseTo(0.5, 5);
  });
  it("clamps to [0.05, 0.95] and preserves ordering", () => {
    const inputs = Array.from({ length: 5 }, (_, i) => raw(`T${i}`, 0.3 + i * 0.1));
    const out = normalizeLeague(inputs);
    for (const c of out)
      for (const k of ["attack", "finishing", "defense", "keeping", "control"] as const) {
        expect(c[k]).toBeGreaterThanOrEqual(0.05);
        expect(c[k]).toBeLessThanOrEqual(0.95);
      }
    expect(out[4].attack).toBeGreaterThan(out[0].attack);
  });
  it("is invariant to league-wide inflation (scaling all inputs keeps 0.5 center)", () => {
    const base = [raw("A", 0.4), raw("B", 0.5), raw("C", 0.6)];
    const inflated = [raw("A", 0.8), raw("B", 1.0), raw("C", 1.2)];
    const o1 = normalizeLeague(base);
    const o2 = normalizeLeague(inflated);
    expect(o2.find((c) => c.name === "B")!.attack).toBeCloseTo(
      o1.find((c) => c.name === "B")!.attack, 5,
    );
  });
  it("handles zero variance by returning 0.5", () => {
    const out = normalizeLeague([raw("A", 0.5), raw("B", 0.5)]);
    expect(out[0].attack).toBe(0.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/normalize.test.ts`
Expected: FAIL — cannot resolve `league/normalize.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/core/league/normalize.ts
import type { Composites } from "../../engine/composites.js";

const COMPOSITE_KEYS = ["attack", "finishing", "defense", "keeping", "control"] as const;
type CompositeKey = (typeof COMPOSITE_KEYS)[number];

const clamp = (x: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, x));

/**
 * Z-normalize each composite across all teams so the average team sits at 0.5:
 *   normalized = clamp(0.5 + 0.15 * z, 0.05, 0.95)
 * Anchored to the supplied (starting-XI) composites — the population the engine
 * actually sees. Zero variance on a composite yields 0.5 for every team.
 */
export function normalizeLeague(raw: Composites[]): Composites[] {
  const stats: Record<CompositeKey, { mean: number; sd: number }> = {} as never;
  for (const key of COMPOSITE_KEYS) {
    const vals = raw.map((c) => c[key]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    stats[key] = { mean, sd: Math.sqrt(variance) };
  }

  return raw.map((c) => {
    const out: Composites = { ...c };
    for (const key of COMPOSITE_KEYS) {
      const { mean, sd } = stats[key];
      out[key] = sd === 0 ? 0.5 : clamp(0.5 + 0.15 * ((c[key] - mean) / sd), 0.05, 0.95);
    }
    return out;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/normalize.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/league/normalize.ts test/core/normalize.test.ts
git commit -m "feat(core): league composite normalization"
```

---

## Task 11: Schedule (double round-robin)

**Files:**
- Create: `src/core/schedule.ts`
- Test: `test/core/schedule.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/core/schedule.test.ts
import { describe, it, expect } from "vitest";
import { doubleRoundRobin } from "../../src/core/schedule.js";

describe("doubleRoundRobin", () => {
  it("for 20 teams yields 380 fixtures, 38 per team", () => {
    const fixtures = doubleRoundRobin(Array.from({ length: 20 }, (_, i) => i));
    expect(fixtures).toHaveLength(380);
    for (let t = 0; t < 20; t++) {
      const played = fixtures.filter((f) => f.home === t || f.away === t);
      expect(played).toHaveLength(38);
    }
  });
  it("every ordered pair appears exactly once (home and away)", () => {
    const fixtures = doubleRoundRobin([0, 1, 2]);
    const keys = fixtures.map((f) => `${f.home}-${f.away}`).sort();
    expect(keys).toEqual(["0-1", "0-2", "1-0", "1-2", "2-0", "2-1"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/schedule.test.ts`
Expected: FAIL — cannot resolve `schedule.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/core/schedule.ts
export interface Fixture {
  home: number; // tid
  away: number; // tid
}

/**
 * Double round-robin: every distinct ordered pair of team ids plays once, so
 * each pair meets twice (home and away). Order within the list is deterministic.
 * The final table is order-independent, so no matchday interleaving is needed for M1.
 */
export function doubleRoundRobin(teamIds: number[]): Fixture[] {
  const fixtures: Fixture[] = [];
  for (const home of teamIds)
    for (const away of teamIds)
      if (home !== away) fixtures.push({ home, away });
  return fixtures;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/schedule.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/schedule.ts test/core/schedule.test.ts
git commit -m "feat(core): double round-robin schedule"
```

---

## Task 12: Standings (points table)

**Files:**
- Create: `src/core/standings.ts`
- Test: `test/core/standings.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/core/standings.test.ts
import { describe, it, expect } from "vitest";
import { computeStandings, type PlayedMatch } from "../../src/core/standings.js";

describe("computeStandings", () => {
  it("awards 3/1/0 and ranks by points", () => {
    const matches: PlayedMatch[] = [
      { home: 0, away: 1, homeGoals: 2, awayGoals: 0 }, // 0 wins
      { home: 1, away: 2, homeGoals: 1, awayGoals: 1 }, // draw
    ];
    const table = computeStandings([0, 1, 2], matches);
    expect(table[0].tid).toBe(0);
    expect(table[0].points).toBe(3);
    expect(table.find((r) => r.tid === 1)!.points).toBe(1);
    expect(table.find((r) => r.tid === 2)!.points).toBe(1);
  });
  it("breaks ties by goal difference then goals for", () => {
    const matches: PlayedMatch[] = [
      { home: 0, away: 2, homeGoals: 5, awayGoals: 0 }, // team0 +5
      { home: 1, away: 2, homeGoals: 2, awayGoals: 0 }, // team1 +2
    ];
    const table = computeStandings([0, 1, 2], matches);
    // teams 0 and 1 both have 3 pts; team0 has better GD.
    expect(table[0].tid).toBe(0);
    expect(table[1].tid).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/standings.test.ts`
Expected: FAIL — cannot resolve `standings.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/core/standings.ts
export interface PlayedMatch {
  home: number;
  away: number;
  homeGoals: number;
  awayGoals: number;
}

export interface StandingsRow {
  tid: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

/** Build a league table (3/1/0), sorted by points, then GD, then GF, then tid. */
export function computeStandings(teamIds: number[], matches: PlayedMatch[]): StandingsRow[] {
  const rows = new Map<number, StandingsRow>();
  for (const tid of teamIds)
    rows.set(tid, { tid, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });

  const record = (tid: number, gf: number, ga: number): void => {
    const r = rows.get(tid)!;
    r.played++;
    r.gf += gf;
    r.ga += ga;
    r.gd = r.gf - r.ga;
    if (gf > ga) { r.won++; r.points += 3; }
    else if (gf === ga) { r.drawn++; r.points += 1; }
    else { r.lost++; }
  };

  for (const m of matches) {
    record(m.home, m.homeGoals, m.awayGoals);
    record(m.away, m.awayGoals, m.homeGoals);
  }

  return [...rows.values()].sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.tid - b.tid,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/standings.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/standings.ts test/core/standings.test.ts
git commit -m "feat(core): standings table with tiebreaks"
```

---

## Task 13: Core barrel + league→composites helper

**Files:**
- Create: `src/core/index.ts`
- Create: `src/core/league/composites.ts`
- Test: `test/core/leagueComposites.test.ts`

This helper ties generation → XI → rollup → normalization into the normalized
per-team composites the validation suite drives the engine with.

- [ ] **Step 1: Write the failing test**

```ts
// test/core/leagueComposites.test.ts
import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generateLeague } from "../../src/core/league/generate.js";
import { leagueComposites } from "../../src/core/league/composites.js";

describe("leagueComposites", () => {
  it("returns one normalized Composites per team, averaging ~0.5 per composite", () => {
    const league = generateLeague(mulberry32(1));
    const comps = leagueComposites(league);
    expect(comps).toHaveLength(league.teams.length);
    for (const k of ["attack", "finishing", "defense", "keeping", "control"] as const) {
      const avg = comps.reduce((s, c) => s + c[k], 0) / comps.length;
      expect(avg).toBeCloseTo(0.5, 1);
    }
  });
  it("stronger teams (lower tid) get higher attack composites on average", () => {
    const league = generateLeague(mulberry32(1));
    const comps = leagueComposites(league);
    const topHalf = comps.slice(0, 10).reduce((s, c) => s + c.attack, 0) / 10;
    const bottomHalf = comps.slice(10).reduce((s, c) => s + c.attack, 0) / 10;
    expect(topHalf).toBeGreaterThan(bottomHalf);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/leagueComposites.test.ts`
Expected: FAIL — cannot resolve `league/composites.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/core/league/composites.ts
import type { Composites } from "../../engine/composites.js";
import type { Player } from "../players/types.js";
import type { League } from "./generate.js";
import { selectXI } from "../lineup/selectXI.js";
import { FORMATIONS } from "../lineup/formations.js";
import { rollupComposites } from "../composites.js";
import { normalizeLeague } from "./normalize.js";

/**
 * Full pipeline: for each team, pick a default 4-3-3 XI, roll up raw composites,
 * then z-normalize across the league. The result is what the engine consumes.
 */
export function leagueComposites(league: League): Composites[] {
  const byPid = new Map<number, Player>(league.players.map((p) => [p.pid, p]));
  const raw = league.teams.map((t) => {
    const roster = t.roster.map((pid) => byPid.get(pid)!);
    const xi = selectXI(roster, FORMATIONS["4-3-3"]);
    return rollupComposites(xi, t.name);
  });
  return normalizeLeague(raw);
}
```

```ts
// src/core/index.ts
export * from "./players/types.js";
export * from "./players/generate.js";
export * from "./players/ovr.js";
export * from "./lineup/formations.js";
export * from "./lineup/selectXI.js";
export * from "./composites.js";
export * from "./league/generate.js";
export * from "./league/normalize.js";
export * from "./league/composites.js";
export * from "./schedule.js";
export * from "./standings.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/leagueComposites.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/index.ts src/core/league/composites.ts test/core/leagueComposites.test.ts
git commit -m "feat(core): league composites pipeline + barrel export"
```

---

## Task 14: Validation gate — Monte-Carlo benchmarks on generated composites

**Files:**
- Create: `test/validation/m1-benchmarks.test.ts`

Reuses the M0 `runScenario` harness, driven by *generated + normalized* composites
instead of the hardcoded `PRESETS`. This proves gate (a): a generated league still
produces realistic match aggregates.

- [ ] **Step 1: Write the test**

```ts
// test/validation/m1-benchmarks.test.ts
import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { runScenario } from "../../src/engine/montecarlo.js";
import { generateLeague } from "../../src/core/league/generate.js";
import { leagueComposites } from "../../src/core/league/composites.js";

const N = 20_000;
const comps = leagueComposites(generateLeague(mulberry32(1)));
// Median-ranked teams as the "average" pair; ends as the strong/weak pair.
const mid = comps[Math.floor(comps.length / 2)];
const strong = comps[0];
const weak = comps[comps.length - 1];

describe("M1 §8 gates — generated average teams", () => {
  const r = runScenario(mid, mid, N, 12345);
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

describe("M1 §8 gates — generated mismatch", () => {
  it("strong home beats weak 70-80% of the time", () => {
    const r = runScenario(strong, weak, N, 6789);
    expect(r.homeWinPct).toBeGreaterThanOrEqual(70);
    expect(r.homeWinPct).toBeLessThanOrEqual(80);
  });
  it("weak home avoids defeat vs strong at least 20% of the time", () => {
    const r = runScenario(weak, strong, N, 4242);
    expect(r.homeWinPct + r.drawPct).toBeGreaterThanOrEqual(20);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run test/validation/m1-benchmarks.test.ts`
Expected: All assertions PASS. **If they don't**, the strong/weak generated composites are
too far from the `PRESETS` spread the constants were tuned for — tune
`TEAM_STRENGTH_SPREAD` in `src/core/constants.ts` (a smaller value pulls the ends
toward the middle), re-run, repeat. Do NOT change any `src/engine/` constant.

- [ ] **Step 3: Commit**

```bash
git add test/validation/m1-benchmarks.test.ts src/core/constants.ts
git commit -m "test(validation): M1 Monte-Carlo benchmarks on generated composites"
```

---

## Task 15: Validation gate — season table spread

**Files:**
- Create: `test/validation/m1-table-spread.test.ts`

Proves gate (b): a full simmed season produces a realistic table (champion 78–94,
bottom 15–32). This is the primary target for tuning `TEAM_STRENGTH_SPREAD`.

- [ ] **Step 1: Write the test**

```ts
// test/validation/m1-table-spread.test.ts
import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { simMatch } from "../../src/engine/matchSim.js";
import { generateLeague } from "../../src/core/league/generate.js";
import { leagueComposites } from "../../src/core/league/composites.js";
import { doubleRoundRobin } from "../../src/core/schedule.js";
import { computeStandings, type PlayedMatch } from "../../src/core/standings.js";

/** Sim one full season and return the final table. */
function simSeason(seed: number) {
  const rng = mulberry32(seed);
  const league = generateLeague(rng);
  const comps = leagueComposites(league);
  const teamIds = league.teams.map((t) => t.tid);
  const fixtures = doubleRoundRobin(teamIds);
  const matches: PlayedMatch[] = fixtures.map((f) => {
    const r = simMatch(rng, comps[f.home], comps[f.away]);
    return { home: f.home, away: f.away, homeGoals: r.home, awayGoals: r.away };
  });
  return computeStandings(teamIds, matches);
}

describe("M1 gate (b) — season table spread", () => {
  it("champion 78-94 pts and bottom 15-32 pts (averaged over 5 seeded seasons)", () => {
    let champSum = 0;
    let bottomSum = 0;
    const SEASONS = 5;
    for (let s = 0; s < SEASONS; s++) {
      const table = simSeason(1000 + s);
      champSum += table[0].points;
      bottomSum += table[table.length - 1].points;
    }
    const champ = champSum / SEASONS;
    const bottom = bottomSum / SEASONS;
    expect(champ).toBeGreaterThanOrEqual(78);
    expect(champ).toBeLessThanOrEqual(94);
    expect(bottom).toBeGreaterThanOrEqual(15);
    expect(bottom).toBeLessThanOrEqual(32);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run test/validation/m1-table-spread.test.ts`
Expected: PASS. **If the champion is too high / bottom too low**, the league is
too spread — *lower* `TEAM_STRENGTH_SPREAD`. If the table is too compressed
(champion < 78), *raise* it. Re-run after each change; this and Task 14 must both
pass simultaneously, so alternate between them when tuning.

- [ ] **Step 3: Commit**

```bash
git add test/validation/m1-table-spread.test.ts src/core/constants.ts
git commit -m "test(validation): M1 season table-spread gate"
```

---

## Task 16: Full suite + typecheck green

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all M0 tests (22) plus all new M1 tests PASS.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Final commit if anything was adjusted**

```bash
git add -A
git commit -m "chore(m1): full suite + typecheck green"
```

---

## Self-Review Notes (coverage against the spec)

- Spec §4 data model → Task 1. §6 generation + Table A → Tasks 2, 5. §7 OVR + Table B → Tasks 2, 3. §8 lineup/formations → Tasks 6, 7. §9 rollup → Task 8. §10 normalization → Task 10. §11 validation gates → Tasks 14, 15 (reusing M0's `runScenario` per the §2 reconciliation). Shared schedule/standings module → Tasks 11, 12. §12 unit tests distributed across Tasks 3–13. §5 module layout realized, with the one documented deviation: `rollupComposites` lives in `src/core/composites.ts` (not `engine/`) to preserve the engine's independence from `core`.
- `TEAM_STRENGTH_SPREAD` (§6) is the single tuning dial, exercised in Tasks 14–15.
- Deferred items (multipliers, fatigue, synergy, attribution, persistence, UI) are absent by design.
