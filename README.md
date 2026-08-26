# soccer-gm

A soccer management sim that runs entirely in your browser, in the spirit of
[Basketball GM](https://basketball-gm.com/). Take over a club and run it season
after season: pick the XI and the formation, work two transfer windows, develop
an academy, keep the books straight, and chase promotion, the league, a
continental cup and the World Cup.

**Play it: [worldsoccersim.org](https://worldsoccersim.org)** — no account, no
download, no server. Every save lives in your own browser's IndexedDB.

## What it actually is

- **A world, not a league.** 16 competitions across 8 countries (England, Spain,
  Italy, Germany, France, Portugal, Belgium, Turkey), two tiers each, 320 clubs,
  ~7,000 players, promotion and relegation every summer.
- **A real match engine.** A tick loop with a gate cascade — turnover, then
  escalation, then a shot resolved through blocked / on-target / saved — driven
  by five team composites rolled up from whoever is actually on the pitch. CI
  holds it to real-football aggregates — 2.6–2.9 goals a game, 23–28% draws,
  5–9% goalless — with favourites who mostly but not always win. Every match
  yields a full box score.
- **Deterministic.** Seeded RNG throughout, no bare `Math.random()` in the sim.
  The same seed gives the same world, which is what makes the balance audits in
  `scripts/` and the validation gates in `test/validation/` possible at all.
- **Fictional clubs and players.** Deliberately: no real names, no licences, no
  trademark exposure. (A dev-only EA FC roster converter exists for local play —
  it never ships. See `docs/eafc-import.md`.)

The game explains itself in-app at `/manual`, and `/changelog` lists every
player-visible change with dates.

## Quick start

Needs Node 20+.

```bash
npm install
npm run dev        # Vite dev server
```

| Command | What it does |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build (the worldsoccersim.org target) |
| `npm test` | full vitest suite (164 files) |
| `npm run test:watch` | vitest in watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run cli` | headless sim harness, for audits |

There are two embedded build targets besides the default —
`npm run build:itch` and `npm run package:crazygames` — for platforms that host
the game inside an iframe at a path we don't control. `docs/crazygames.md` has
the runbook.

**First `npm test` after a `src/core` change is slow.** Generating a 320-club
world costs a few seconds and most test files want one, so worlds are cached on
disk and keyed by a hash of all of `src/core`. A core edit buys one rebuild
(~60s) and is free after that. `SOCCER_GM_NO_FIXTURE_CACHE=1` skips the cache.

## How the code is laid out

```
src/
  engine/   the match sim — pure, no DOM, no storage
  core/     league logic: season loop, progression, transfers, AI, cups, finance
  db/       IndexedDB persistence + migrations + JSON export/import
  worker/   web worker entry and its typed message protocol
  ui/       React app (pages, components, LeagueContext)
test/
  validation/   the Monte Carlo and multi-season gates
scripts/    audits, probes and one-off measurement tools (run with tsx)
```

`engine/` and `core/` import zero browser APIs, which is what lets the audit
scripts and CI run them in plain Node.

Two things are load-bearing and easy to break by accident:

- **RNG stream order.** Inserting or removing a draw from the shared `rng`
  shifts every result downstream of it. New per-player traits and post-hoc
  attribution must come off their own seeded stream.
- **The anti-inflation equilibrium.** Youth intake anchors to a fixed-at-
  generation club value, never to the current squad, and several mechanics exist
  only to hold ratings flat across a long dynasty. Anything that touches
  progression wants a dynasty audit from `scripts/`, not just a green test run.

Both are covered properly in CLAUDE.md, which you should read before changing
sim code.

## Documentation

**`CLAUDE.md` is the current record** — architecture, invariants, and a feature
ledger explaining what each system is, where it lives, and its non-obvious
traps. Everything else is narrower:

| Doc | What it is |
|---|---|
| `SOCCER_GM_SPEC.md` | The original 2026-07 build brief. **Historical** — the engine spec and validation gates still hold; its world and roadmap sections describe a game that diverged. Its header box lists where. |
| `DESIGN.md` / `PRODUCT.md` | The visual design system and the product brief. `src/ui/styles.css` is the source of truth for tokens. |
| `docs/finance-design.md` | Design intent of the finance layer. |
| `docs/transfer-mobility.md` | Postmortem: how the country strength ladder once inverted. |
| `docs/save-performance-plan.md` | Why saves are split across IndexedDB stores. |
| `docs/player-save-findings.md` | A live work queue built from real player saves. |
| `docs/eafc-import.md` | The dev-only EA FC roster converter. |
| `docs/crazygames.md` | Building and shipping the CrazyGames bundle. |
| `docs/analytics.md` | PostHog pointers; `src/ui/analytics.ts` owns the event set. |

## Testing

CI runs two jobs: a typecheck, and the suite sharded across 6 runners (the
wall-clock is dominated by a handful of full-world multi-season sims, so
sharding beats a single machine).

`test/validation/` holds the realism gates — goals per game, draw rate, table
spread, top scorer, multi-season integrity. They are bands, not exact values,
and the standing rule when one fails is **fix the statistic, not the band**.
That lesson has been learned four separate times and each instance is written
up in CLAUDE.md.

## Licence

No licence file, so default copyright applies: all rights reserved. The source
is public to read, not to reuse.

The engine takes structural *inspiration* from ZenGM's hockey sim (the tick
loop, the gate cascade, composite ratings), whose source is readable but not
open source. Every line here is original, and it needs to stay that way — don't
copy code, constants, structure or comments from that project.
