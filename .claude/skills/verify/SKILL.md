---
name: verify
description: Build, launch, and drive soccer-gm in a browser to verify a change end-to-end.
---

# Verifying soccer-gm changes

- Install: `npm install` (fresh worktrees have no `node_modules`; the main checkout may not either).
- Launch: `npm run dev -- --port <port> --strictPort`, open `http://localhost:<port>/`. Saves live in IndexedDB per-origin, so a fresh port = a blank slate with no leagues (useful for clean-state runs).
- First run lands on `/leagues` → "Start New League" → pick a club → "Start League" → `/dashboard`.
- Drive: the Dashboard has the sim buttons (one game / end of month / transfer deadline / end of season) and, when the season is over, the "Advance to Season N+1" button. Sim-to-end-of-season takes ~15–20s with a progress overlay.

Gotchas:

- The roster fills to 30/30 after the first offseason (youth intake), which disables transfer Offer buttons until you Release someone on the Roster page.
- At $0 scouting spend, offering the suggested "scout value" usually collapses talks instantly as a lowball (valuation noise is ±35% at zero spend). To complete a transfer quickly, offer well above scout value and accept the counter.
- State persists across reloads (IndexedDB + a localStorage active-league pointer); to reset, use a new port or delete the league on `/leagues`.
