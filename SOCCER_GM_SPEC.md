# Soccer GM — Design Spec & Build Brief

A single-player soccer management sim in the spirit of Basketball GM: browser-based, client-side, sim-heavy, minimal micromanagement. This document is the implementation brief. Read it fully before scaffolding.

**Status:** The core match-engine approach is already proven. A standalone proof-of-concept (`soccer-ticksim.mjs`, in this repo) validates that a hockey-style tick loop produces realistic soccer aggregates over 20k-game Monte Carlo runs: 2.79 goals/game, 25.8 shots, 8.7 on target, 25.3% draws, 6.2% 0-0s, with 1-1 / 1-0 / 2-1 as the most common scorelines. Do not redesign the engine core; extend it.

---

## 1. Goals and non-goals

**Goals**

- A playable dynasty loop: manage one club across many seasons — matches, table, transfers, youth development, finances.
- Match results that feel like real soccer: low-scoring, high-variance, favorites win most but not all of the time.
- Fully client-side (no server), fast enough to sim a 38-match season in a few seconds.
- Deterministic given a seed (reproducible leagues, debuggable sims).

**Non-goals (permanently or for now)**

- No 2D/3D match visualization. Text play-by-play at most.
- No multiplayer, no accounts, no server sync.
- No licensed real teams/players. Fictional generated players only (real-roster import can come much later as a user-supplied JSON feature).

**Licensing note:** ZenGM's source is publicly readable but NOT open source. This project takes structural *inspiration* from its hockey engine (tick loop, gate cascade, composite ratings) but every line must be original. Do not copy code, constants, file structure, or comments from the zengm repo.

---

## 2. Tech stack

- **TypeScript** throughout, strict mode.
- **Vite** for build/dev, **React** for UI, **Vercel** for deploy.
- **IndexedDB** (via `idb` package) for league persistence; a simple in-memory cache layer in front of it. Export/import league as a single JSON file from day one — this is both backup and the modding story.
- **Web Worker** for the sim so the UI never blocks during multi-season sims. UI ↔ worker via a small typed message protocol.
- Seeded RNG (mulberry32 or similar) threaded through everything. No bare `Math.random()` anywhere in the engine.
- **Vitest** for tests. The Monte Carlo validation suite (§8) runs in CI.

Suggested layout:

```
src/
  engine/          # pure, no DOM, no storage — the match sim
    matchSim.ts
    composites.ts
    constants.ts   # every tunable in one file
    rng.ts
  core/            # league logic: schedule, table, season phases, transfers, progression
  db/              # IndexedDB + cache + JSON import/export
  worker/          # worker entry, message protocol
  ui/              # React app
test/
  validation/      # Monte Carlo benchmark tests
```

`engine/` and `core/` must be importable in Node with zero browser APIs — this is what makes CLI tuning scripts and CI validation possible.

---

## 3. Data model

### Player

```ts
interface Player {
  pid: number;
  name: string;
  nationality: string;      // affects name generation only, for now
  born: number;             // season number, not calendar year
  pos: Position;            // GK | CB | FB | DM | CM | AM | W | ST
  ratings: PlayerRatings;   // current
  potential: number;        // 0..100 ceiling hint for progression
  contract: { salary: number; expiresSeason: number };
  injury: { gamesRemaining: number; type: string } | null;
  stats: SeasonStats[];     // per-season accumulation
  hist: RatingsSnapshot[];  // one per season, for player pages
}
```

### Raw ratings (0–100, the editable/visible layer)

Keep it to 10. More ratings = more tuning surface with little gameplay payoff.

| Rating | Meaning |
|---|---|
| `pace` | speed + acceleration |
| `strength` | physical duels |
| `stamina` | fatigue resistance |
| `passing` | short + long distribution |
| `dribbling` | ball carrying, beating a man |
| `shooting` | finishing, shot power/placement |
| `heading` | aerial ability (attacking + defending) |
| `tackling` | winning the ball |
| `positioning` | reading the game (off and on ball — the "IQ" stat) |
| `keeping` | goalkeeping (near-zero for outfielders) |

`ovr` is computed per-position from a weighted blend (a ST weights shooting/pace; a CB weights tackling/positioning/heading; a GK is ~90% keeping). Store the weight tables in `constants.ts`.

### Team

```ts
interface Team {
  tid: number;
  name: string; abbrev: string; colors: [string, string];
  roster: number[];              // pids
  formation: FormationId;        // e.g. "4-3-3", "4-4-2", "3-5-2", "5-3-2"
  tactics: { mentality: -2|-1|0|1|2 };  // defensive..attacking; MVP keeps just this one dial
  finances: { budget: number; wageBill: number };
  hype: number;                  // drives revenue + free-agent appeal
}
```

### League

One division, 20 teams, double round-robin (38 matches), 3/1/0 points, tiebreak by goal difference then goals for. Season phases: `preseason → regularSeason → transferWindow → progression → draftOrYouthIntake → offseason`. Promotion/relegation is a v2 feature (§7) — but write the schedule and table code so a second division is a data change, not a rewrite.

---

## 4. Composite ratings (the bridge from players to the engine)

The engine consumes exactly five team-level composites, each 0..1 with 0.5 = league average. Before each match (and after subs/red cards), roll them up from the 11 on-pitch players:

| Composite | Built from | Notes |
|---|---|---|
| `attack` | attackers' + midfielders' shooting, dribbling, pace, positioning | how often possession escalates into a shot |
| `finishing` | weighted by expected shot share (ST > W > AM > others) shooting + positioning | shot accuracy + conversion |
| `defense` | defenders' + DM's tackling, positioning, strength, heading | suppresses opponent chances, blocks |
| `keeping` | the GK's keeping rating, mostly alone | save rate |
| `control` | all outfielders' passing + dribbling + positioning | possession retention |

Normalization: map league-wide player quality so that an average starting XI produces 0.5 on every composite. Compute the league mean/σ at season start and z-score into a squashed 0..1 (e.g. `0.5 + 0.15 * z`, clamped 0.05..0.95). This keeps the engine's tuned constants valid forever, even as league quality inflates or the user god-modes a superteam.

**Formation and tactics** apply as small multipliers on the composites, not as new engine mechanics:

- Formation shifts weight between composites (3-5-2: +control, −defense flanks → net small −defense; 5-3-2: +defense, −attack; 4-3-3: +attack, −control; 4-4-2: neutral). Keep every formation's net effect within ±0.04 on any composite.
- Mentality: each step of `mentality` = +0.02 attack / −0.02 defense (or the reverse). AI teams shift mentality when trailing after 60' (implement in the engine as a re-roll of composites at fixed match times — this also naturally produces late-game drama).

**Fatigue:** each player has in-match `energy` 1→~0.6, draining per tick weighted by stamina; a player's contribution to composites is scaled by energy. Season-level fatigue (congestion) is v2.

**Synergy** (v1.5, after MVP): small bonus for balanced squads — penalize a lineup whose composite spread is extreme (e.g. all-attack no-defense already self-punishes, but add a chemistry bonus for players with many seasons together).

---

## 5. Match engine

The proven core, restated as the spec. **The constants below are the validated values from `soccer-ticksim.mjs` — start from these exactly.**

### Loop

```
clock = 5400s (+ stoppage, v1.5)
possession = coin flip
while clock > 0:
  dt = uniform(2, 10) seconds; clock -= dt
  off = team in possession, def = other

  # gate 1: turnover
  P(turnover) = clamp(0.14 * (1 + 0.6*(def.defense - off.control)), 0.02, 0.5)
  if hit → possession flips, continue

  # gate 2: escalation (the isNothing valve — most ticks end here)
  edge = off.attack - def.defense
  P(chance) = clamp(0.032 * (1 + 0.80*edge), 0.002, 0.2)
  if not hit → continue

  # a shot: resolve cascade
  blocked?    P = clamp(0.28 * (1 + 0.6*(def.defense-0.5)), 0.05, 0.6)
  on target?  P = clamp(0.47 * (1 + 0.5*(off.finishing-0.5)), 0.1, 0.9)
  saved?      P = clamp(0.68 * (1 + 0.5*(def.keeping-0.5)) - 0.3*(off.finishing-0.5), 0.2, 0.95)
  else GOAL → kickoff to conceding team

  # non-goal shot outcome: rebound keeps possession with P=0.12, else flips
```

Home advantage: `+0.10` to the home side's `attack` composite. (Validated: gives ~40/25/35 home/draw/away for equal teams; real EPL is ~45/25/30 — acceptable for MVP, tune later.)

### Attribution (new work, not in the PoC)

Every shot needs a shooter; goals need optional assisters; saves credit the GK; tackles/interceptions credit defenders. Pick players by weighted random over on-pitch players' relevant ratings, with position multipliers (ST most likely to shoot, etc.). This is what turns team-level sim into box scores, stat leaders, and awards — it changes no scoreline math.

### Events layered onto the loop (build order in §7)

- **Cards:** small per-tick foul probability on the defending side; fouls → free kick (a slightly-elevated chance for the attacker); some fouls → yellow (bookings persist per player per match), rare straight red. Red card = recompute composites with 10 men (≈ −0.06 defense, −0.06 attack, −0.04 control for the short side). Second yellow = red.
- **Set pieces:** corners happen on a fraction of blocked/off-target outcomes; a corner is one bonus shot chance using `heading`-weighted attribution. Penalties: rare foul subtype in a "box" context flag; resolve as a shot with very high on-target and low save probability (~76% conversion).
- **Substitutions:** 5 subs, 3 windows + halftime. AI sub logic: replace lowest-energy players at 60'/75', attacking subs when trailing late.
- **Injuries:** small per-tick probability, weighted to tackled players; in-match effect = forced sub; multi-game recovery handled in `core/`.
- **Stoppage time:** 1–5 minutes per half, weighted by events (goals, cards, subs).

### Play-by-play

Log every non-nothing event (`{clock, type, side, pids}`) to an array. The UI renders it as a text ticker. Cheap, and it's the debugging tool for the engine.

---

## 6. GM layer (core/)

- **Season sim:** sim day / sim week / sim to end of season, from the worker. A full season of 380 matches should run < 3s.
- **Player progression:** at season end, each rating moves by `f(age, potential, minutesPlayed, noise)`. Peak ~27, GKs peak later and decline slower. Retirement probability rises after 33.
- **Youth intake:** once per season each club receives 3–5 generated 16-year-olds (soccer's replacement for the draft). Quality weighted by club budget + a youth-facilities dial (v2). No draft mechanic.
- **Transfers:** MVP = free agents only (expired contracts, offer salary/years, player picks by money × club hype). v1.5 = transfer fees between clubs with a simple AI valuation (`ovr`, age, contract remaining). Two windows: preseason + midseason.
- **Contracts & finances:** wage bill vs. budget; budget from league position + hype. Soft constraint: can't sign if over budget. No FFP simulation.
- **AI clubs:** each offseason, AI fills roster holes by position need, signs best affordable free agent, promotes youth. Doesn't need to be clever — needs to not be degenerate (never fields 8 strikers, never goes bankrupt).
- **Awards & history:** golden boot, best XI, player of the season; franchise history pages. (This is the dynasty payoff — don't cut it.)

---

## 7. Build order

Each milestone is shippable and testable before the next starts.

1. **M0 — Engine package.** Port the PoC into `src/engine/` as typed, tested modules. CLI script `scripts/validate.ts` reruns the Monte Carlo benchmarks. CI fails if benchmarks drift (§8).
2. **M1 — Players → composites.** Player generation, per-position ovr, composite rollup + league normalization. Validation: a league of generated teams must still hit the M0 benchmarks *and* end-of-season tables must show realistic spread (champion ~80–90 pts, last place ~20–30).
3. **M2 — Season loop.** Schedule, table, worker, IndexedDB persistence, JSON export/import. Minimal UI: table, fixtures, results, sim buttons.
4. **M3 — Box scores & attribution.** Shooter/assister/GK attribution, per-player season stats, stat leaders, play-by-play view.
5. **M4 — Dynasty mechanics.** Progression, aging, retirement, youth intake, free agency, contracts, AI roster management. This is the "one more season" milestone.
6. **M5 — Match texture.** Cards + red-card man-down, subs + fatigue, set pieces + penalties, injuries, stoppage time. Re-validate after each addition.
7. **M6 — Depth (pick by fun).** Transfer fees, cup competition (single-elim knockout reusing the engine), promotion/relegation with a second division, tactics beyond one dial, synergy/chemistry, awards history polish.

---

## 8. Validation gates (CI)

`scripts/validate.ts` sims 20,000 equal-team matches and 20,000 mismatch matches with a fixed seed. Assert (±10% unless noted):

| Metric | Target |
|---|---|
| Goals/game (equal teams) | 2.6–2.9 |
| Shots/game | 23–27 |
| Shots on target | 8–9.5 |
| Draw rate | 23–28% |
| 0-0 rate | 5–9% |
| Home win rate (equal) | 38–46% |
| Strong-home vs weak: home win | 70–80% |
| Weak side avoids defeat vs strong | ≥ 20% |
| Season points spread (M1+) | champion 78–94, bottom 15–32 |
| Top scorer (M3+) | 18–32 goals |

Any engine or composite change must pass these before merge. When adding texture events (M5), if a metric drifts, retune `constants.ts` — never special-case.

---

## 9. Open questions (decide during build, don't block on them)

- League identity: fictional country? City names generated how? (Cosmetic, M2.)
- One mentality dial vs. a second "pressing" dial that trades `control` for turnover rate. (M6.)
- Should possession% be derived from tick counts and shown? (Free to compute; probably yes, M3.)
- Real-roster JSON import format. (Post-M6.)
