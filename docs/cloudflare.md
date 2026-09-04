# Publishing to worldsoccersim.org

**The live site deploys itself.** Cloudflare Workers Builds is connected to this
repository and builds and publishes on every push to `main`. There is no deploy
step to run, no secret to add, and nothing in `.github/workflows/` that does it.

This doc exists because that is not discoverable from the repo. All the repo
contains is `wrangler.jsonc` and no workflow beside it, which reads exactly like
a deploy somebody has to run by hand — and on 2026-09-04 that inference was
drawn twice in one session, each time confidently, each time wrong. It cost an
hour and very nearly shipped a second deploy pipeline racing the real one.

## The three deploy targets

| Target | URL | Deploys when |
| --- | --- | --- |
| **Cloudflare Workers Builds** | worldsoccersim.org | push to `main`, automatically |
| GitHub Pages (`pages.yml`) | proelium27.github.io/world-soccer-sim/ | push to `main` |
| Vercel | a `*.vercel.app` URL | push, automatically |

**The Vercel project is a leftover of the pre-2026-08-15 host and the domain is
not pointed at it.** It still builds every push, including a `Production`
deployment, so a current Vercel link proves the code is on `main` and proves
nothing at all about worldsoccersim.org. That is the single most misleading
thing about this setup: the two look connected and are not. `curl -I` on the
domain shows `server: cloudflare` and no `x-vercel-*` header of any kind.

## The deploy takes a few minutes, and that is the whole story

Measured merge-to-live:

| commit | merged | live | lag |
| --- | --- | --- | --- |
| #331 `745cb4a` | 01:32:37 | 01:38:58 | **6m 21s** |
| #329 `973ceda` | 00:13:01 | 00:31:36 | ~19 min |
| #316 `349bc0a` | 22:33:22 | 22:53:17 | ~20 min |

Single-digit minutes usually, up to about twenty when Cloudflare's dependency
cache is cold. **So the domain is legitimately behind `main` for a few minutes
after every merge.** Checking inside that window and finding your feature
missing is not a bug — in the incident above it read as one, because the
symptom is "I merged this and it isn't in the game", which points at the
feature rather than at the clock.

Two quirks worth knowing so they do not read as failures:

- **Rapid merges are coalesced.** #318 merged at 00:11 and #329 at 00:13, and
  Cloudflare built only #329 — which contains #318. An *absent* check run on a
  commit is normal; it means a later commit superseded it.
- **Nothing gates the deploy on tests.** Cloudflare publishes on push, so main
  goes live whether or not `ci.yml` is green. PR runs are what gate merges.

## How to check what is live

The workflow below does this automatically, but by hand:

```bash
# Which build is live?
curl -s https://worldsoccersim.org/ | grep -oE 'index-[A-Za-z0-9._-]+\.js'

# Analytics survived the build. Zero means this build has no key.
curl -s "https://worldsoccersim.org$(curl -s https://worldsoccersim.org/ \
  | grep -oE '/assets/index-[A-Za-z0-9._-]+\.js' | head -1)" | grep -c phc_

# Deep links work (SPA fallback).
curl -s https://worldsoccersim.org/manual | grep -c '/assets/index-'
```

**To find out whether a specific commit is live, rebuild it and compare hashes**
— do not guess from feature greps, which is what produced the wrong answer the
first time. Vite output is deterministic given the same source and lockfile:

```bash
git archive <sha> | tar -x -C /tmp/dc && cd /tmp/dc
ln -s /path/to/repo/node_modules node_modules
npx vite build && ls dist/assets | grep -E '^index-.*\.js$'
```

`349bc0a` produces `index-BSYiCOl2.js` at 1,748,391 bytes, which is how the
deployed commit was identified exactly.

> **Do not date a bundle by grepping changelog text.**
> `src/core/changelog/index.ts` globs its entries and Vite code-splits them into
> `Changelog-*.js`, so every changelog string reads 0 in the index chunk
> whatever the commit — a decisive-looking negative that is pure noise.

## The two guards

Neither replaces the deploy; both cover things it does not check.

**`ci.yml` builds the bundle and asserts it carries `phc_`.** Vite inlines
`import.meta.env.VITE_*` at build time, so a build that cannot see
`VITE_POSTHOG_KEY` hands `posthog.init(undefined)` to production and nothing
throws, nothing logs, and the site reports no pageviews, no gameplay events and
no crashes while looking perfectly healthy — five real days of that after the
host move. Running `npm run build` on the PR also means a bundle that fails to
build fails before merge rather than in a pipeline nobody watches.

**`verify-live-site.yml` fires on Cloudflare's own check run** and turns it into
a signal you cannot miss: red if the Workers Build failed (otherwise a grey
check on a commit that scrolls away, while the site sits silently on the
previous build), and otherwise an assertion that the domain really is serving a
healthy bundle with its analytics key and a working SPA fallback. It does not
deploy anything. It will not run on the PR that adds it — GitHub only dispatches
`check_run` against workflows already on the default branch.

## Deploying by hand

Works, and is occasionally the right thing — publishing something deliberately
not on `main`, or pushing a fix out without waiting for the queue:

```bash
npm run build
npx wrangler deploy      # first time: npx wrangler login
```

It publishes the same Worker Cloudflare's build publishes, so the two do not
conflict; the next push to `main` simply overwrites whatever you pushed.
Prefer a merge where you can, so the live site keeps corresponding to a commit.

## Rolling back

`git revert` and push is the honest option — the live site keeps matching
`main`, and the revert redeploys on its own within a few minutes. Cloudflare
also keeps previous versions and can roll back from the dashboard, which is
faster but leaves the site not matching any commit on `main`.
