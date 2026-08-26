# Analytics

The game runs entirely client-side — state lives in IndexedDB and never reaches
a server — so product analytics is the only window into what players actually
do. **PostHog is the only provider**; Vercel Web Analytics ran alongside it for
a while and has been removed.

This file exists to hold the dashboard links and to point at the two places that
actually govern analytics. It is deliberately thin: everything here that could
drift lives somewhere better.

- **What we report** → `src/ui/analytics.ts`. The `GameEvents` interface names
  every event, types its properties exactly, and documents each one in a doc
  comment. Don't keep a copy of that list anywhere else; the wizard-generated
  one this file replaced went stale within a month. Two standing rules, both
  explained in that file: keep the set **small and stable** (a handful of
  meaningful moments, not one event per click), and keep every property
  **low-cardinality** — enumerated strings and bucketed counts, never raw
  player/team ids or names.
- **How it's configured and how it has broken** → CLAUDE.md's **"Analytics &
  deploy config"** section. Read it before touching env vars, adding events, or
  moving hosts. Short version: the PostHog key is inlined at *build* time and is
  committed per build target, a build without it fails completely silently, and
  autocapture is off because it exhausted the 1M-event free tier once.

## Dashboards

Built by the PostHog setup wizard, 2026-07-19. Project 519849.

- [Analytics basics (wizard)](https://us.posthog.com/project/519849/dashboard/1873085) — the dashboard
- [New leagues created](https://us.posthog.com/project/519849/insights/VO5LwqXA)
- [Player engagement funnel (create → sim → advance)](https://us.posthog.com/project/519849/insights/65hyMgJs)
- [Simulation depth by type](https://us.posthog.com/project/519849/insights/JkSg4Lmn)
- [Transfer market activity](https://us.posthog.com/project/519849/insights/ReErI7Qz)
- [Roster management actions](https://us.posthog.com/project/519849/insights/2xoZ0xUs)

**These insights are older than several of the events.** They were built against
14 events; there are 19 now, and `season_simmed.through` was reshaped since. So
the dashboard under-reports rather than misreports — worth knowing before
reading a flat line as a flat metric.

## Known gap

**No source-map upload.** `.github/workflows/ci.yml` typechecks and shards the
test suite; nothing uploads source maps, so production stack traces in error
tracking stay minified. Since `capture_exceptions` is on and the
`ErrorBoundary` reports too (CLAUDE.md, "Crash visibility"), the reports exist —
they're just harder to read than they need to be.
