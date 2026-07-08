# M1 — Players → Composites (Design Spec)

**Milestone:** M1 of the Soccer GM build order (see `SOCCER_GM_SPEC.md` §7).
**Date:** 2026-07-08
**Status:** Design approved, ready for implementation planning.

## 1. Purpose

M1 replaces the proof-of-concept's hardcoded team composites (`{attack: 0.5, ...}`)
with composites **rolled up from generated players**. It is the bridge from a
roster of individuals to the five team-level composites the (M0) match engine
consumes. It changes no scoreline math.

M1 is planned **assuming M0 exists**: a typed, tested engine package that exposes
seeded RNG, tuned constants, and `simMatch(rng, homeComposites, awayComposites)`.
The assumed M0 interface is restated in §2.

## 2. M0 interface (the boundary — reconciled against the real code)

M0 exists in `src/engine/` (the PoC has been ported to typed, tested modules).
M1 consumes it as a black box. The **actual** signatures:

- `engine/rng.ts` — `mulberry32(seed: number): () => number`. Floats in `[0, 1)`.
- `engine/constants.ts` — the validated tunables (`MATCH_SECONDS`, `BASE_CHANCE`,
  `STRENGTH_K`, `HOME_ATTACK_BONUS`, …), all `export const`.
- `engine/composites.ts` — `interface Composites { name: string; attack; finishing;
  defense; keeping; control }` (each `0..1`, `0.5` = league average) **plus a
  `name` field**; a factory `makeTeam(name, overrides?: CompositeOverrides)` that
  defaults any unset composite to `0.5`; and `clamp` lives in `matchSim.ts`.
- `engine/matchSim.ts` — `simMatch(rng, home: Composites, away: Composites):
  MatchResult`, where `MatchResult = { home: number; away: number;
  possessionHome: number; stat: { home: TeamMatchStat; away: TeamMatchStat } }`
  and `TeamMatchStat = { goals; shots; sot; ticks }`. Possession % is already
  computed by the engine.
- `engine/montecarlo.ts` — `runScenario(home, away, n, seed): ScenarioResult`
  (goals/shots/SOT/win-draw-loss %, top scores) and `PRESETS` (`equal`/`strong`/
  `weak`). This is the harness M1's benchmark validation reuses (§11).
- `engine/index.ts` — barrel re-exporting all of the above.

**Conventions M1 must follow:** the codebase is ESM/NodeNext — relative imports
carry explicit `.js` extensions (e.g. `import { Composites } from "./composites.js"`).
Strict TypeScript, seeded RNG only, no `Math.random()`.

M1 **produces** the composite rollup (extending `engine/composites.ts` with a
`rollupComposites` function that returns a `Composites`) and everything upstream.
It does not modify the tick loop, the shot cascade, or any engine constant.

## 3. Scope

**In scope**
- Player data model + the 15-stat rating set (+ height attribute).
- Player generation via a hybrid talent model (league distribution + per-team target).
- Per-position OVR from position-specific weight tables.
- Starting-XI selection for the 4 formation shapes (no composite multipliers).
- Composite rollup from the on-pitch 11.
- League normalization so an average starting XI produces 0.5 on every composite.
- A minimal shared round-robin + standings module for validation.
- Validation: Monte-Carlo benchmarks still pass; season table spread is realistic.

**Out of scope (deferred, per SOCCER_GM_SPEC.md)**
- Formation/tactics multipliers on composites (M6).
- In-match fatigue/energy scaling (M5); season congestion (v2).
- Synergy/chemistry (v1.5).
- Attribution / box scores (M3).
- Persistence, worker, UI (M2).
- Progression, aging, transfers, contracts (M4).

## 4. Player data model

```ts
type Position = "GK" | "CB" | "FB" | "DM" | "CM" | "AM" | "W" | "ST";

interface PlayerRatings {
  // Physical (skills, 0..100)
  speed: number;
  strength: number;
  stamina: number;
  jumping: number;
  // Passing
  shortPass: number;
  longPass: number;
  crosses: number;
  // On the ball
  dribbling: number;
  // Shooting
  longShot: number;
  finishing: number;
  // Defending
  tackling: number;
  interceptions: number;
  // Mental
  positioning: number;
  // Goalkeeping
  goalkeeping: number;
}

interface Player {
  pid: number;
  name: string;
  nationality: string;
  born: number;             // season number, not calendar year
  pos: Position;
  heightCm: number;         // static physical attribute (NOT a 0..100 rating)
  ratings: PlayerRatings;   // 15 skills, every player has a number for every stat
  ovr: number;              // computed per-position from ratings + heightCm
  potential: number;        // 0..100 ceiling hint (generated now, used in M4)
  contract: { salary: number; expiresSeason: number };
  injury: { gamesRemaining: number; type: string } | null;
  stats: SeasonStats[];     // per-season accumulation (empty at generation)
  hist: RatingsSnapshot[];  // per-season snapshots (empty at generation)
}
```

**Design note — 15 skills, not the spec's original 10.** The spec (§3) proposed 10
ratings to limit tuning surface. M1 deliberately adopts a more granular,
BBGM-influenced set (15 skills + a height attribute) for richer player identity:
`passing` split into `shortPass`/`longPass`/`crosses`, `shooting` split into
`longShot`/`finishing`, `heading` replaced by `jumping` (+ the `heightCm`
attribute), and `tackling`/`interceptions` split. This supersedes §3's rating
table for the implementation. The engine still consumes exactly five composites,
so the extra ratings add no engine tuning surface — only generation/OVR surface.

**Rating-set model (BBGM/FBGM hybrid):**
- *Every player has a real number for every one of the 15 skills*, regardless of
  position (a GK has a `finishing` number; a ST has a `goalkeeping` number) —
  this is the Basketball GM approach.
- *OVR is computed with position-specific weight tables* (a GK's OVR formula ≠ a
  ST's) — this is the Football GM approach, chosen because soccer positions are as
  differentiated as gridiron positions.
- These are two independent layers: generation (what value is rolled) and OVR
  weighting (how much a stat counts). See §6 and §7.

## 5. Module architecture

```
src/engine/
  composites.ts     # EXISTS (Composites type + makeTeam). M1 adds:
                    #   rollupComposites(startingXI, teamName) → raw Composites
src/core/
  players/
    generate.ts     # generatePlayer(rng, pos, base) → Player
    ovr.ts          # ovr(player) via per-position OVR weight tables
    names.ts        # nationality-weighted placeholder name generator
    templates.ts    # Table A (generation offsets) + Table B (OVR weights)
  lineup/
    formations.ts   # the 4 formation shapes (position slot requirements)
    selectXI.ts     # best-by-position XI for a formation
  league/
    generate.ts     # generateLeague(rng, opts) → { teams, players }  (hybrid talent)
    normalize.ts    # league-wide composite z-normalization
  schedule.ts       # pure double round-robin generator (shared with M2)
  standings.ts      # pure points table + tiebreak GD then GF (shared with M2)
test/validation/
  m1-benchmarks.test.ts     # generated league still hits §8 Monte-Carlo targets
  m1-table-spread.test.ts   # full season → champion 78–94, bottom 15–32
```

All of `engine/` and `core/` is pure, Node-importable, seeded — no DOM, no
IndexedDB, no `Math.random()`.

## 6. Player generation (hybrid talent model)

1. **League talent base.** A league-wide base level drawn from a distribution
   (normal-ish, clamped), setting overall league quality.
2. **Per-team target.** Each of the 20 teams gets a `strengthTarget` z-value spread
   across a tunable range. **`TEAM_STRENGTH_SPREAD` is the single dial for the
   table-spread gate.** Targets are ordered so the league has a believable ladder.
3. **Roster construction.** Each team gets ~25 players with a realistic positional
   distribution (≈ 3 GK, 7–8 defenders, 7–8 midfielders, 5–6 forwards) — enough to
   fill any of the 4 formations plus a bench.
4. **Per-player generation.** For a player of position `p` on a team with base
   `B` (= leagueBase + teamTarget):
   - For each skill `s`: `rating = clamp(B + offset[p][s] + noise, 1, 99)`,
     using **Table A** offsets.
   - Position-exclusive stats (marked `▪` in Table A) are drawn from an
     **absolute-low pool (~5–20), independent of `B`**, so quality never leaks
     across roles (a world-class ST still cannot keep goal).
   - `heightCm` drawn from the position's cm range.
   - `potential ≥ ovr`, generated for M4 use.
   - `name`/`nationality` from the placeholder generator (cosmetic; an M2 open
     question).

### Table A — Generation offsets (center of the roll)

Tiers: **★ +18 · H +10 · M +2 · L −12 · VL −25**; `▪` = absolute-low pool (~5–20),
independent of base.

| Pos | speed | strength | stamina | jumping | shortPass | longPass | crosses | dribbling | longShot | finishing | tackling | interceptions | positioning | goalkeeping | Height (cm) |
|-----|-------|----------|---------|---------|-----------|----------|---------|-----------|----------|-----------|----------|---------------|-------------|-------------|-------------|
| GK  | L | M | L | H | M | H | ▪ | ▪ | ▪ | ▪ | ▪ | L | H | ★ | 188–198 |
| CB  | M | H | M | H | M | M | L | L | L | L | ★ | H | H | ▪ | 185–195 |
| FB  | H | M | H | L | M | M | H | M | L | L | H | H | M | ▪ | 172–182 |
| DM  | M | H | H | M | H | H | L | M | M | L | H | ★ | H | ▪ | 178–188 |
| CM  | M | M | H | M | ★ | H | M | H | M | M | M | M | H | ▪ | 175–185 |
| AM  | H | L | M | L | H | H | M | ★ | H | H | L | L | H | ▪ | 170–180 |
| W   | ★ | L | H | L | M | L | H | ★ | M | H | L | L | M | ▪ | 170–180 |
| ST  | H | H | M | H | M | L | L | M | H | ★ | VL | L | ★ | ▪ | 178–190 |

All magnitudes are provisional and tuned against the validation gate; the table
locks the *shape* (which stats matter for which position), not the exact numbers.
ST height uses a single distribution for M1 (no target-man/poacher bimodality).

## 7. Per-position OVR

`ovr(player)` = weighted blend of the player's ratings using **Table B**. Each
position's weights sum to 100%; unlisted stats carry 0 weight. Height enters OVR
as a small component (converted from cm to a 0..100-scale contribution) only for
the aerial-reliant positions (GK/CB/ST).

### Table B — OVR weights (%)

| Pos | Weights |
|-----|---------|
| GK  | goalkeeping 78, positioning 8, jumping 5, height 4, longPass 3, shortPass 2 |
| CB  | tackling 20, interceptions 18, positioning 16, strength 14, jumping 10, height 6, speed 6, longPass 5, shortPass 5 |
| FB  | speed 15, tackling 14, interceptions 13, stamina 12, crosses 12, positioning 10, shortPass 8, dribbling 8, strength 8 |
| DM  | interceptions 18, positioning 16, tackling 15, shortPass 15, longPass 12, stamina 10, strength 8, dribbling 6 |
| CM  | shortPass 18, longPass 15, positioning 14, stamina 12, dribbling 12, longShot 8, interceptions 8, tackling 7, finishing 6 |
| AM  | dribbling 18, finishing 15, shortPass 14, positioning 14, longShot 13, longPass 12, speed 8, crosses 6 |
| W   | speed 20, dribbling 18, crosses 16, finishing 14, stamina 10, longShot 8, shortPass 8, positioning 6 |
| ST  | finishing 26, positioning 20, longShot 14, speed 12, strength 10, jumping 8, height 5, dribbling 5 |

Tables A and B are correlated (a signature stat is usually rolled high and weighted
high) but independent: Table A makes rosters *look* right on inspection; Table B
makes OVR *mean* the right thing per position.

## 8. Lineup / formation

- **Formations** as data: `4-3-3`, `4-4-2`, `3-5-2`, `5-3-2`, each a multiset of
  position slots.
- `selectXI(roster, formation)` fills each slot with the highest-`ovr` eligible
  player, with position-adjacency fallback (a CB may fill a FB slot, etc.) when a
  team is short of a natural position.
- **No composite multipliers** in M1 — formation affects only *which 11* are
  picked. The multiplier system is a labeled extension point for M6.
- For validation, every team uses a default **4-3-3**; the selector supports the
  other three shapes for free.

## 9. Composite rollup

`rollupComposites(startingXI, teamName)` produces a `Composites` (the engine's
existing type, `name` + five **raw**, unnormalized values) from the on-pitch 11,
per SOCCER_GM_SPEC.md §4, mapped onto the 15-stat set:

- **attack** ← attackers'+mids' `finishing`, `longShot`, `dribbling`, `speed`, `positioning`, `crosses`.
- **finishing** ← shot-share-weighted (ST > W > AM > others) `finishing`, `longShot`, `positioning`.
- **defense** ← defenders'+DM's `tackling`, `interceptions`, `positioning`, `strength`, and aerial (`jumping`+`heightCm`).
- **keeping** ← the GK's `goalkeeping` (+ `heightCm` for reach), mostly alone.
- **control** ← all outfielders' `shortPass`, `longPass`, `dribbling`, `positioning`.

Aerial ability is a **computed** value from `jumping` + `heightCm` (used here in
`defense`; reused for set-piece attribution in M5), not a stored rating.

## 10. League normalization

The invariant that keeps the engine's tuned constants valid forever:

- At season start, compute each raw composite across **all 20 teams' selected
  starting XIs** → per-composite league mean and σ.
- Map each team's raw composite to `0.5 + 0.15·z`, clamped `0.05..0.95`
  (per SOCCER_GM_SPEC.md §4).
- Result: the *average* starting XI sits at 0.5 on every composite, so gate (a)
  (still hitting the Monte-Carlo benchmarks) is essentially automatic.

Anchoring to starting XIs (not the whole player pool) is deliberate: the engine
only ever sees XIs, so that is the population that must average 0.5.

## 11. Validation & the M1 gate

Two Vitest suites under `test/validation/`, fixed seeds, CI-gated like M0:

1. **`m1-benchmarks.test.ts`** — build a generated + normalized league, then run
   the existing `engine/montecarlo.ts` `runScenario(home, away, n, seed)` harness
   on *generated* composites (an average generated XI, and a strong-vs-weak
   generated pair) instead of the hardcoded `PRESETS`. Assert all M0 targets still
   hold (goals/game 2.6–2.9, shots 23–27, SOT 8–9.5, draw 23–28%, 0-0 5–9%, home
   win 38–46%, strong-home 70–80%, weak avoids defeat ≥ 20%). This sits alongside
   the existing `test/validation/benchmarks.test.ts` (the M0 gate), not replacing
   it.
2. **`m1-table-spread.test.ts`** — sim one (or an averaged handful of seeded) full
   38-match seasons via `schedule.ts` + `standings.ts`, assert **champion 78–94
   pts** and **bottom 15–32 pts**. `TEAM_STRENGTH_SPREAD` is tuned against this.

`schedule.ts` + `standings.ts` are the minimal shared module — pure double
round-robin (3/1/0, tiebreak GD then GF), reused unchanged by M2's persisted
season loop.

## 12. Testing strategy (unit, beyond the gate)

- **OVR:** each position's weights sum to 100; a generated ST out-`ovr`s a
  generated GK when both are outfield-scored, etc.
- **Generation:** archetype sanity (generated ST `finishing` > generated CB
  `finishing`); position-exclusive stats stay in the absolute-low pool regardless
  of team quality.
- **Normalization:** average XI → ~0.5 on every composite; clamps hold; invariant
  to league-wide quality inflation (scale all ratings, composites still average
  0.5).
- **Schedule:** every ordered pair plays home and away exactly once; 38 rounds.
- **Standings:** points math and GD/GF tiebreaks.
- **Determinism:** same seed → identical league → identical table.

## 13. Open questions (non-blocking)

- Name-generation quality is placeholder-grade; real name lists are an M2 cosmetic
  concern.
- `TEAM_STRENGTH_SPREAD` and the Table A/B magnitudes are provisional pending the
  first tuning pass against the table-spread gate.
- Possession% is already returned by the engine (`MatchResult.possessionHome`);
  surfacing it in the UI is an M2/M3 concern, not M1 work.
