# soccer-gm

A client-side, BBGM-style soccer management sim (TypeScript). `SOCCER_GM_SPEC.md` is the full design brief and M0-M6 build order.

## Git workflow
- Always keep work committed: after making code changes, commit them locally with a clear message rather than leaving the working tree dirty.
- Always keep the remote in sync: after committing, push to GitHub (`origin`) so local `main` and GitHub `main` never drift apart.
- Merging isn't finished until it's in both places: when a PR is merged on GitHub, also pull that merge into the local `main` branch (`git checkout main && git pull`) so the local checkout matches GitHub. Don't consider a change "done" until local `main` and GitHub `main` both have it.
- Only skip this (leave changes uncommitted/unpushed/unpulled) if the user explicitly asks you to hold off.

## Keeping this file in sync (two Claude accounts working on this repo)
Two different Claude accounts (proelium27 and joeltmeyer/joeltm82) work on this repo, each with its own local Claude Code memory that the other can't see. This file is the only shared source of truth between them, since it's the one thing that's committed to git and visible to both.
- **Whenever a milestone (M0-M6) advances, gets skipped/reordered, or a major architectural/design decision is made, update the "Milestone status" section below in the same commit/PR.** Routine small commits (typo fixes, minor UI tweaks, single bug fixes) don't need a status update.
- If you notice this file is out of date with what's actually on `main` (e.g. a milestone marked "next" is already implemented, or vice versa), fix it as part of your work rather than leaving the drift for later.
- If you're ever unsure whether a change is "milestone-significant" enough to warrant an update here, ask the user rather than guessing.

## Milestone status
(per `SOCCER_GM_SPEC.md` §7; keep this current — see above)

- **M0 — Engine port**: done, merged (`7062733`).
- **M1 — Players → composites**: done, merged (`95e3d63`). Player generation, per-position OVR, composite rollup + league normalization.
- **M2 — Season loop, persistence, minimal UI**: done, merged. Vite scaffold, IndexedDB persistence, web worker, team identity/scheduling/league state, `simThrough`, initial UI pages/routing.
- **M3 — Box scores**: done, merged (`6a22da7`). Per-player attribution (shooter/assister/tackler/GK), `simMatchDetailed`, fleshed-out `SeasonStats`, box score + stat leaders pages.
- **M4 — Dynasty mechanics**: done, merged (`6a79eb9`). Progression (BBGM-style age curve, dynamic re-rolled potential per offseason — see `src/core/players/progression.ts`), aging, retirement, youth intake, free agency, contracts, offseason orchestrator. Manually browser-verified.
  - Known gap fixed later: potential could pile up at the 99 clamp; replaced with a soft asymptotic ceiling (`bd24519`).
- **M5 — Match texture**: **not started, currently skipped/deferred.** Per spec: cards + red-card man-down, subs + fatigue, set pieces + penalties, injuries, stoppage time. `Player.injury` exists as an unused stub field only. Work jumped from M4 straight to M6 finance without an explicit decision recorded — if you're picking this up, confirm with the user whether M5 is still wanted before or after finishing M6.
- **M6 — Finances**: **in progress.** Design (budgets/scouting/hype/contracts/transfer valuation) was finalized with the user in a prior conversation (details beyond this summary live in a Google Doc the user maintains — ask if you need the full spec). Foundation landed (`1f58d9c`): equal base club budgets, season-end settlement (base allocation + rank payouts + damped hype→revenue, minus wages/scouting spend), hype tracking driven by season performance, scouting-spend slider, and an OVR/age/contract-driven transfer valuation formula with scouting-scaled noise. Transfer windows/negotiation UI not yet built.

**Known gaps carried forward:** no transfer fees/window UI yet (M6 in progress); user's own roster is never auto-trimmed by AI logic (by design); no scouting uncertainty beyond the M6 valuation noise (potential itself is still fully accurate/visible to the user).
