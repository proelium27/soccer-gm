# Publishing to GitHub Pages

The game deployed straight from this repo, at
`https://proelium27.github.io/world-soccer-sim/`. It is a full, playable copy —
same bundle as worldsoccersim.org, built from the same source with two things
changed: the base path and an SPA fallback file.

## How it runs

`.github/workflows/pages.yml` builds and deploys on every push to `main`, and on
demand from the Actions tab (**Deploy to GitHub Pages** → Run workflow). There
is nothing to configure: no repository secrets, no variables. Analytics come
from the committed `.env.pages`, and the base path comes from the Pages API via
`configure-pages`, falling back to the repo name.

**One-time step: the source has to be "GitHub Actions".** This repo published
from a *branch* before this workflow existed, which is why the site did not
work: a branch source serves the repo as-is, and the repo's `index.html` loads
`/src/ui/main.tsx` — a path that only exists in the dev server. Visitors got the
pre-React placeholder and the app never booted. The tell is a
`pages-build-deployment` run (GitHub's own, not in this repo) on each push to
main; those stop once the source is switched.

`configure-pages` with `enablement: true` creates the site when there isn't one,
but do not rely on it to *change* an existing source. Set **Settings → Pages →
Source** to **GitHub Actions** once. Until that is done `deploy-pages` fails,
and it fails loudly rather than publishing something stale.

To build it locally:

```bash
npm run build:pages           # writes dist/ with base "/world-soccer-sim/"
PAGES_BASE=/other-name/ npm run build:pages
```

## The two things that differ from the main build

**A base path.** A project page is served from `https://<user>.github.io/<repo>/`,
so every asset URL needs that prefix — a default-base bundle asks github.io for
`/assets/index-xxx.js`, which belongs to no site of yours. `PAGES_BASE` sets it,
the workflow fills it from `configure-pages`' reported base path (the only
source that knows about a custom domain) and falls back to the repo name (right
for any project page, so a fork or a rename needs no edit), and the app reads it
back through `import.meta.env.BASE_URL` as the router's `basename`. Without the basename every route falls through to no match: the
browser is at `/world-soccer-sim/manual` and React Router would be looking for a
`/world-soccer-sim/manual` route, which does not exist.

That single value also covers `public/` files, via the existing
`publicAsset()` — the reason the top-bar logo is not a bare `/favicon.png`.

**An SPA fallback.** Pages is a static host with no rewrite rules, so a deep
link like `/world-soccer-sim/manual` has no file behind it. The one hook it offers is
`404.html`: it serves that document for any path it cannot resolve, and the
browser renders it with the requested URL still in the address bar — so a copy
of `index.html` boots the app on the right route. `vite.config.ts` writes it
during the pages build, and the workflow asserts it exists, because a missing
fallback is invisible until a player opens anything but the entry page.

The response carries a **404 status**. That is invisible to a player (the app
loads and the route renders), and it costs nothing in search, because every page
canonicalizes to worldsoccersim.org — see `src/ui/seo.ts`, whose `SITE_ORIGIN`
is absolute for exactly this reason. This mirror is not meant to be indexed in
its own right.

## Renaming the repo breaks the live site until you redeploy

The base path is baked into the bundle at build time — every asset URL in the
deployed `index.html` starts with it — so it describes where the site was *when
it was built*, not where it is now. Rename the repo and the site moves to
`/<new-name>/` while the deployed HTML still asks for `/<old-name>/assets/…`:
the page loads, every asset 404s, and you get a blank screen. This is exactly
what happened on 2026-08-26, when `soccer-gm` became `world-soccer-sim` a few
hours after the first successful deploy.

Nothing can detect this without rebuilding — a static file cannot know its own
URL changed. The fix is to **re-run the deploy** (Actions → *Deploy to GitHub
Pages* → Run workflow), which is also all that is needed: the workflow reads the
base from the Pages API and the repo name at build time, so it picks the new
name up on its own. Any push to `main` does the same thing.

So: after renaming the repo, redeploy. The same applies to adding or removing a
custom domain, for the same reason.

## Custom domain

Set it in **Settings → Pages → Custom domain** (which writes `CNAME` for you)
and the workflow follows on the next run: a custom domain serves the site from
the domain root, `configure-pages` reports `/`, and the build picks that up. No
edit here. Only if you commit `public/CNAME` by hand without setting it in
Settings — where the API still reports a project path — does the workflow need
`PAGES_BASE: /` pinned explicitly.

## Verifying a deploy

The base path is the thing that breaks, and it breaks silently at the root
(the entry page can look fine while every deep link and asset 404s). To check
the real deploy:

```bash
# assets carry the prefix
curl -s https://proelium27.github.io/world-soccer-sim/ | grep -o '/world-soccer-sim/assets/[^"]*'
# the fallback is there (a 404 status serving the app's HTML is the pass)
curl -s https://proelium27.github.io/world-soccer-sim/manual | grep -c "World Soccer Simulator"
# analytics survived the build — the same check as worldsoccersim.org, but
# following the real asset URL, since a shell glob means nothing over HTTP
SITE=https://proelium27.github.io/world-soccer-sim
curl -s "$SITE$(curl -s $SITE/ | grep -o '/world-soccer-sim/assets/index-[^"]*\.js')" | grep -c phc_
```

To check a local build the way the host serves it, the base path has to be
real — opening `dist/index.html` in a tab passes even when it is wrong, the
same trap `dist-crazygames-harness.html` exists for. `scripts/servePages.ts`
serves the bundle under the subpath with the 404 fallback in place:

```bash
npm run build:pages
npx tsx scripts/servePages.ts     # http://localhost:4174/world-soccer-sim/
```

Then open a deep link (`/world-soccer-sim/manual`), not just the entry page — the
entry page is the one URL that still works when the fallback is missing.
