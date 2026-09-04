# Publishing to worldsoccersim.org

The live site is a **Cloudflare assets-only deploy**: a static bundle uploaded
straight to Cloudflare with no Worker script of its own. `wrangler.jsonc` is the
whole configuration — the `dist` directory and an SPA fallback — and it is
deliberately explicit so `wrangler deploy` does not try to auto-detect a
framework and reach for `@cloudflare/vite-plugin`, which needs Vite 6+ and would
fail the build on our Vite 5.

The site moved here from Vercel on 2026-08-15.

## The thing to understand first: there are three deploy targets

| Target | URL | Deploys when |
| --- | --- | --- |
| **Cloudflare** | worldsoccersim.org | push to `main` (`deploy.yml`) |
| GitHub Pages | proelium27.github.io/world-soccer-sim/ | push to `main` (`pages.yml`) |
| Vercel previews | a `*.vercel.app` URL | push, automatically |

They serve the same game from the same source. **The Vercel project is a
leftover of the old host and the domain is no longer pointed at it** — that is
the single most confusing thing about this setup, so it is worth saying twice.
A Vercel preview URL showing a feature tells you the code is on `main`. It tells
you nothing whatsoever about worldsoccersim.org.

This doc exists because that gap went unnoticed. Until 2026-09-03 the Cloudflare
deploy was the only one nobody automated: it ran by hand, from a laptop, when
someone remembered. The two mirrors nobody plays on stayed current and the real
site fell several PRs behind — measured, worldsoccersim.org was serving a bundle
from around #326 while Pages had #329 — and it surfaced as "I merged this
feature and I can't see it in the game", which reads like a bug in the feature.

It is the same shape as the analytics outage `.env.production` describes: the
preview deploys kept reporting normally for five days while production reported
nothing, which is what made a build problem look like a PostHog outage. **When
production and a preview disagree, suspect the deploy before the code.**

## How it runs

`.github/workflows/deploy.yml` builds and deploys on every push to `main`, and
on demand from the Actions tab (**Deploy to Cloudflare** → Run workflow).

It does *not* wait for `ci.yml`. The commit is a merge of a PR that already went
green, CI on main takes ~30 minutes across six shards, and chaining on
`workflow_run` fails open in ways worse than what it would guard.

The workflow checks three things that are otherwise invisible until a player
hits them:

- **The secrets exist**, before the build rather than after it — an absent token
  otherwise surfaces as a wrangler auth error at the very end, which reads like
  a Cloudflare outage rather than a repo that was never configured.
- **The bundle carries the analytics key** (`grep -rq phc_ dist/assets`). A
  build without it throws nothing and logs nothing; the site reports no
  pageviews, no gameplay events and no crashes while looking perfectly healthy.
- **The domain is actually serving the new bundle.** A successful deploy and a
  live domain are not the same claim, and telling them apart by hand is exactly
  what nobody did. It polls the live `index.html` for the asset hash this run
  built.

## One-time setup

Two repository secrets, under **Settings → Secrets and variables → Actions**:

- `CLOUDFLARE_API_TOKEN` — create at *My Profile → API Tokens → Create Token*
  using the **Edit Cloudflare Workers** template. Do not use a Global API Key.
- `CLOUDFLARE_ACCOUNT_ID` — the account ID on the Cloudflare dashboard sidebar,
  or `npx wrangler whoami`.

Until both are set the workflow fails on its first step with a message naming
the missing one. It fails rather than skipping on purpose: a deploy workflow
that quietly does nothing is how the site drifts in the first place.

The domain itself is attached in the Cloudflare dashboard (the Worker's
**Settings → Domains & Routes**), not from this repo. If a deploy succeeds and
the final check still reports the old asset, that attachment is what to look at.

## Deploying by hand

Still works, and is unchanged — the workflow runs the same two commands, so a
laptop deploy and a CI deploy produce the same site:

```bash
npm run build
npx wrangler deploy      # first time: npx wrangler login
```

Reach for this when Actions is down or you need to publish something that is
deliberately not on `main`. Otherwise prefer a push, so the live site always
corresponds to a commit.

## Verifying a deploy

Do not assume. Both of these are one line and both have caught a real problem:

```bash
# Which build is live? Compare against `ls dist/assets` after a local build.
curl -s https://worldsoccersim.org/ | grep -oE 'index-[A-Za-z0-9._-]+\.js'

# Analytics survived the build. Zero means this build has no key.
curl -s "https://worldsoccersim.org$(curl -s https://worldsoccersim.org/ \
  | grep -oE '/assets/index-[A-Za-z0-9._-]+\.js' | head -1)" | grep -c phc_
```

To check whether a specific feature is live, grep the bundle for a string only
that feature ships — a route path is usually the cleanest:

```bash
curl -s "https://worldsoccersim.org$(curl -s https://worldsoccersim.org/ \
  | grep -oE '/assets/index-[A-Za-z0-9._-]+\.js' | head -1)" | grep -c youth-intake
```

And confirm the SPA fallback, which is `not_found_handling:
single-page-application` in `wrangler.jsonc` rather than a file on disk — a deep
link has no file behind it, and a broken fallback is invisible from the entry
page:

```bash
curl -s https://worldsoccersim.org/manual | grep -c "World Soccer Simulator"
```

## Rolling back

Two options, both fine:

- **Revert and push.** `git revert <sha>` on `main` redeploys on its own. This
  is the honest one — the live site keeps matching `main`.
- **Redeploy an older commit.** Actions → *Deploy to Cloudflare* → Run workflow,
  choosing an earlier ref. Faster, but it leaves the live site ahead of or
  behind `main`, so follow it with a real fix.

Cloudflare also keeps previous versions and can roll back from the dashboard.
Prefer a push where you can, so the deployed bundle always corresponds to a
commit somebody can read.
