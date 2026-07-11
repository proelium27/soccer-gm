---
name: verify
description: How to build, launch, and drive soccer-gm for runtime verification of a change.
---

# Verifying soccer-gm changes

Client-side Vite + React app; all state lives in the browser (IndexedDB, per origin **including port**).

## Launch

```bash
npm install            # if node_modules is missing (fresh worktree)
npm run dev -- --port 5199 --strictPort   # pick an uncommon port; background it
curl -s -o /dev/null -w "%{http_code}" http://localhost:5199/   # 200 = up
```

Drive it with the claude-in-chrome tools. No login, no backend. A fresh port =
a blank IndexedDB origin with no leagues (useful for clean-state runs).

## Gotchas

- **Don't mutate a save you didn't create.** The origin may hold a real save
  (auto-loaded on visit). Go to `/leagues` → "Start New League" → pick a club →
  scroll down → **"Start League"** (clicking a club row only selects it; the
  submit button is below the fold). When done, `/leagues` → Enter on the
  original league to restore `localStorage["soccer-gm:activeLid"]`.
- **Never click the Delete button on `/leagues`** — dialog risk, and it's user data.
- **HTML5 drag-and-drop (Roster page) cannot be driven by `left_click_drag`** —
  it silently no-ops. Dispatch real DragEvents from `javascript_tool` instead:
  create one `DataTransfer`, fire `dragstart` on the source `<tr>`, then
  `dragover` + `drop` (both `cancelable: true`) on the target `<tr>`, then `dragend`.
- Element-ref clicks sometimes report success without dispatching (button state
  never changes). If nothing happened, re-click by coordinate or call
  `button.click()` from `javascript_tool`, then confirm via a DOM read.
- League creation takes a few seconds (generates ~500 players synchronously);
  the sim overlay auto-closes when its animation ends — wait ~5-8s after "Sim
  One Game" before asserting. Sim-to-end-of-season takes ~15-20s; afterwards
  the Dashboard shows an "Advance to Season N+1" button (offseason phase).
- The roster fills to 30/30 after the first offseason (youth intake), which
  disables transfer Offer buttons until you Release someone on the Roster page.
- At $0 scouting spend, offering the suggested "scout value" usually collapses
  talks instantly as a lowball (valuation noise is ±35% at zero spend). To
  complete a transfer quickly, offer well above scout value and accept the
  counter. Mid-season buys/signings also charge the player's season wages up
  front on top of the fee.

## Useful routes

`/dashboard` (sim buttons, budget, wage bill, scouting slider), `/roster`
(release/extend/drag-swap; header shows "x/30"), `/transfers`, `/finance`
(offseason cash flow, wage table, transfer history, league finances),
`/incoming-talent` (free agents), `/schedule` → played rows link to
`/box-score/<i>`, `/leagues`.

## Fast assertions

Read state from the DOM via `javascript_tool` rather than screenshots where
possible, e.g. roster count: `document.querySelector("h4 small").textContent`;
row scan: `[...document.querySelectorAll("tbody tr")].map(tr => tr.textContent)`.
Box scores are the ground truth for "did the lineup/sim actually use X".
