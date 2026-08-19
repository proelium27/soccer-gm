# Publishing to CrazyGames

How to build the CrazyGames bundle, what to put in the upload form, and the
decisions behind the build target so nobody has to re-derive them.

## Building the bundle

```bash
npm run package:crazygames
```

Writes `dist-crazygames/`. The script fails loudly if the bundle still carries
AdSense or PostHog, or if the SDK script tag went missing — all three would fail
review, and all three are easy to reintroduce by accident.

**Don't zip it.** The portal's upload zone rejects archives outright: *"Archive
files are not supported, please drag and drop the files directly in the upload
zone."* Open `dist-crazygames/`, select all four entries — `index.html`,
`favicon.png`, `apple-touch-icon.png` and the `assets/` folder — and drag those
into the zone. Dragging the `dist-crazygames` folder itself buries `index.html`
one level down, and the form rejects that too, for not containing one.

To check it by hand before uploading, serve the repo root and open the harness,
which loads the built game in an iframe the way CrazyGames do:

```bash
python3 -m http.server 4173
# then open http://localhost:4173/dist-crazygames-harness.html
```

The iframe is the point. Loading `dist-crazygames/index.html` directly in a tab
passes even when relative paths are broken, because the page is at the root.

## The upload form

| Field | Answer |
| --- | --- |
| Game name | `World Soccer Simulator` (35 char max; matches the `<title>` and the in-game brand) |
| Game engine | **HTML5** |
| Does your game save progress? | **No, the game does not need progress save** — see below |
| The game supports mobile devices | **unchecked** |
| The game is an online multiplayer game | unchecked |
| The game supports CrazyGames muting audio through SDK | unchecked (the game has no audio) |

### Why "no progress save" when the game obviously saves

It saves, but not through anything CrazyGames can sync, and none of the three
options describes that honestly. The two "yes" options both commit you to their
infrastructure:

- The **Data module** is a `localStorage`-shaped key/value store capped at
  **1 MB of JSON**. A save here is IndexedDB and runs to tens of MB — the
  14-season save measured 88 MB before the split-player-storage work, and even a
  3-season one is ~9 MB. It does not fit, and it will not fit.
- **Automatic Progress Save** backs up `localStorage` for HTML5 games and
  IndexedDB only for Unity. An HTML5 game storing in IndexedDB gets nothing.

So saves stay device-local inside their iframe, exactly as they are on itch.
Worth saying in the QA notes when you submit, so it reads as a considered
decision rather than an oversight: *saves are held in IndexedDB and are far
larger than the 1 MB data module allows, so they're local to the device;
players can move a save between devices with Export Save.*

Verified by hand: creating a league, reloading the iframe, and finding the save
still listed. Two caveats that are worth re-testing rather than assuming:

- **Safari.** Third-party frames get partitioned storage, and Safari evicts
  script-writable storage more aggressively than Chrome. Their rules require
  Safari to work or the game gets disabled there.
- Storage is partitioned per top-level site, so a save made on crazygames.com is
  not the same save as one made on worldsoccersim.org. That is expected, but
  players will report it as a bug.

## What the build target changes

`npm run build:crazygames` (`--mode crazygames`, `.env.crazygames`) differs from
the normal build in five ways. Each one is a requirement, not a preference.

1. **Relative asset paths** (`base: "./"`). Their rule is explicit: "Use only
   relative paths when referring to other files in the game bundle. Never use
   absolute paths." Shared with the itch target via `EMBEDDED` in
   `vite.config.ts`.
2. **Hash routing.** There is no server behind the bundle to answer a
   history-API deep link. Shared with itch.
3. **No AdSense.** Only ads served through their SDK are allowed, so the loader
   is stripped from `index.html` by the `crazygames-html` plugin. The plugin
   keys off marker comments and **throws if they go missing**, so a future edit
   to the head can't quietly ship AdSense to review.
4. **No PostHog.** `posthog-js` is aliased to `src/ui/vendor/posthogNoop.ts`.
   Their rules require a player-facing terms/privacy notice for a game
   collecting personal data beyond their own SDK events, and a build with no
   analytics dashboard behind it isn't worth that. Drops ~50 kB too.
5. **No SEO block.** Stripped from `index.html`, and `<RouteSeo />` is not
   rendered — otherwise `useRouteSeo` recreates the canonical tag at runtime.
   It points at worldsoccersim.org, a playable copy of this same game, and
   their rules single out links to a playable web version as not allowed.

## Fitting their container

Their game container is a strict **16:9**, and it is smaller than a browser
window: measured off a live game page, **914x514** in a 1200px-wide window and
**1472x828** on a 1080p monitor. The rest of the width goes to their page chrome
and ad rail. Height is the binding constraint, and it is why a desktop web app
that looks fine maximised can look broken here.

At 1472x828 this game is comfortable. At 914x514 it was not, and three things
were eating the space:

- The announcement banner, 36px of 514 on every screen. **Dropped from this
  build only** (`announcementEnabled` in `App.tsx`), which also settles the
  question of whether a full-width "Join the Discord" bar counts as a main CTA.
  The sidebar link stays, and that is squarely allowed.
- The top bar wrapped onto two lines and truncated the season to
  "2026 — Match…". **Fixed globally**, not just here: the inline save controls
  now collapse into the existing overflow menu below `xl` (1200px) rather than
  `md` (768px). The row needs ~1020px next to the brand and season label, so it
  was equally broken in any narrow browser window on our own site.
- The 220px sidebar took 24% of the width. **Fixed globally**, narrowed to 170px
  between 768px and 1199.98px, with tighter content padding.

Net at 914x514: content went from 694x410 to 744x466. The global half of that is
in the changelog, since it is player-visible on worldsoccersim.org too.

Verify layout changes with the harness, which pins the iframe to both measured
sizes — `?w=914&h=514` and `?w=1472&h=828`. **Check both.** The failure mode of
a narrow-window fix is regressing the wide case, and 1472x828 is what most
desktop players will actually get.

## SDK integration

`src/ui/crazygames.ts` wraps every SDK call. It no-ops in every other build, and
survives a missing SDK — the script comes from `sdk.crazygames.com`, so an
adblocker or a network blip is an ordinary outcome, not an edge case.

What's wired up, which is the minimum for a Basic Launch:

- `SDK.init()` before React mounts (`main.tsx`). Everything else is queued
  behind the init promise, so no call site has to think about ordering.
- `loadingStart` / `loadingStop` around boot. This is what they use to measure
  the initial download size.
- `gameplayStart` / `gameplayStop` from `Layout`, which is the line between
  playing and being in a menu: everything inside it is a loaded save, everything
  outside it (league picker, new-league flow) is a menu. The manual and
  changelog render in the same shell via `allowNoLeague` and are excluded.

### Deliberately not integrated

**Ads.** Not required, and during Basic Launch they're disabled platform-side
with no revenue share anyway, so there is nothing to lose by adding them later.
When it's worth doing, the shape is:

- *Midgame* at a logical break — advancing a season, or finishing the offseason.
  Never during play, never on a navigation button. They rate-limit to one ad per
  three minutes on their side, so the game can just ask.
- *Rewarded* has no obvious hook here. It must be an opportunity rather than an
  expectation, can't be chained, and needs a non-ad alternative — a management
  sim has no lives to refill.
- *Banners* need a screen that's open five seconds on average and room that
  isn't covering UI. The dense tables leave little.

**The user module** (CrazyGames accounts). Only useful alongside the data
module, which the save size rules out.

## Size budget

Their limits: 50 MB initial download, 250 MB total, 1500 files. Current bundle
is ~12 MB across 171 files, so there's a lot of room.
`package:crazygames` prints all three every run, which is the cheapest way to
notice a regression.

The one number to watch is the 20 MB **initial download**, the threshold for
mobile-homepage eligibility. Not relevant while the game ships desktop-only, but
it's the first thing that would bite if that changes — and the flag SVGs are the
obvious risk there (some are 240 kB coats of arms, see the `/transfers` freeze
notes in CLAUDE.md).

## Requirements this is built against

- Technical: <https://docs.crazygames.com/requirements/technical/>
- Gameplay (external links, cross-promotion): <https://docs.crazygames.com/requirements/gameplay/>
- Advertisement: <https://docs.crazygames.com/requirements/ads/>
- SDK: <https://docs.crazygames.com/sdk/intro/>, game module <https://docs.crazygames.com/sdk/game/>, data module <https://docs.crazygames.com/sdk/data/>
- Automatic Progress Save: <https://docs.crazygames.com/other/aps/>

The Discord links in the sidebar and announcement banner are fine as they are:
community links are explicitly allowed on a game menu, as long as they don't
lead to a playable web version.
