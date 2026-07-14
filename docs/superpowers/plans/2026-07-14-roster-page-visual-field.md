# Roster Page Visual Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Roster page's "Starting XI" table with a soccer-pitch visualization (11 slot chips in formation positions), with a Depth Chart toggle that shows each starter's best-fit bench backup, while keeping the Bench table exactly as it is today.

**Architecture:** Two new pure/presentational units — a `bestFit` position-matching helper exported from the existing `selectXI.ts`, and a `layoutSlots` pure coordinate function in a new `src/ui/pitchLayout.ts` — feed a new `PitchField` React component that renders the pitch, chips, drag/drop targets, and a click-triggered actions popover (Extend/Release). `Roster.tsx` swaps its old starters `RosterTable` call for `PitchField`, keeping the bench `RosterTable` untouched.

**Tech Stack:** TypeScript, React 19, Vite, Bootstrap 5 (already imported globally), Vitest.

## Global Constraints

- Formation is hard-coded to `FORMATIONS["4-3-3"]` — no formation picker (per the design spec's non-goals and the existing `Roster.tsx` hard-code).
- No changes to `selectXI`, `resolveXI`, `isValidStarters`, `LeagueContext`, or any persisted schema — UI-layer only, plus one new exported (additive) function on `selectXI.ts`.
- Depth-chart backups are computed fresh on every render, never persisted.
- Pitch chips are not drag sources; swapping is bench-table-row → pitch-slot only, using the existing `DRAG_MIME = "application/x-soccer-gm-pid"` drag protocol.
- Follow the repo's existing dark theme via the `--sg-*` CSS custom properties in `src/ui/styles.css` — no new literal colors.
- Reference spec: `docs/superpowers/specs/2026-07-14-roster-page-visual-field-design.md`.

---

## Task 1: Export `bestFit` from `selectXI.ts`

**Files:**
- Modify: `src/core/lineup/selectXI.ts`
- Test: `test/core/selectXI.test.ts`

**Interfaces:**
- Produces: `bestFit(slot: Position, candidates: Player[]): Player | null` — exported from `src/core/lineup/selectXI.js`. Given a formation slot position and a pool of candidate players, returns the best-fit candidate (exact position first, then adjacent per the existing `ADJACENCY` table, then anyone; ties broken by higher `ovr`, then lower `pid` for determinism), or `null` if `candidates` is empty.

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `test/core/selectXI.test.ts` (keep the existing `roster()` helper and `describe("selectXI", ...)` block above untouched, add a new import and a new `describe` block below it):

```ts
import { selectXI, bestFit } from "../../src/core/lineup/selectXI.js";
```

(This replaces the existing `import { selectXI } from "../../src/core/lineup/selectXI.js";` line with the two-name import.)

```ts
function mkPlayer(pid: number, pos: Position, ovr: number): Player {
  return {
    pid,
    name: `Player ${pid}`,
    nationality: "ENG",
    born: 2000,
    pos,
    heightCm: 180,
    ratings: Object.fromEntries(SKILL_KEYS.map((k) => [k, 50])) as Player["ratings"],
    ovr,
    potential: ovr,
    contract: { salary: 10000, expiresSeason: 5 },
    injury: null,
    stats: [],
    hist: [],
  };
}

describe("bestFit", () => {
  it("prefers an exact position match over a higher-ovr adjacent one", () => {
    const cb = mkPlayer(1, "CB", 60);
    const dm = mkPlayer(2, "DM", 90); // DM is adjacent-fit for CB slot, but not exact
    expect(bestFit("CB", [dm, cb])).toBe(cb);
  });

  it("picks the higher-ovr candidate among equally-good fits", () => {
    const cbLow = mkPlayer(1, "CB", 55);
    const cbHigh = mkPlayer(2, "CB", 70);
    expect(bestFit("CB", [cbLow, cbHigh])).toBe(cbHigh);
  });

  it("falls back to an adjacent position when no exact fit exists", () => {
    const dm = mkPlayer(1, "DM", 65);
    const st = mkPlayer(2, "ST", 80); // not adjacent to CB at all
    expect(bestFit("CB", [dm, st])).toBe(dm);
  });

  it("breaks exact ties by lower pid, deterministically", () => {
    const a = mkPlayer(5, "CB", 70);
    const b = mkPlayer(2, "CB", 70);
    expect(bestFit("CB", [a, b])).toBe(b);
  });

  it("returns null for an empty candidate pool", () => {
    expect(bestFit("CB", [])).toBeNull();
  });
});
```

Also add `SKILL_KEYS` to the existing type-only import line at the top of the file — change:

```ts
import { POSITIONS } from "../../src/core/players/types.js";
import type { Player } from "../../src/core/players/types.js";
```

to:

```ts
import { POSITIONS, SKILL_KEYS } from "../../src/core/players/types.js";
import type { Player } from "../../src/core/players/types.js";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- test/core/selectXI.test.ts`
Expected: FAIL — `bestFit` is not exported from `selectXI.ts` (TypeScript/import error).

- [ ] **Step 3: Implement `bestFit`**

In `src/core/lineup/selectXI.ts`, add this new exported function below the existing `fitRank` function (keep `fitRank`, `ADJACENCY`, and `selectXI` exactly as they are — this is purely additive):

```ts
/**
 * Best-fit candidate for a slot from an arbitrary pool (e.g. the bench), independent
 * of `selectXI`'s whole-roster greedy fill. Same fit/ovr ordering as selectXI, with an
 * explicit pid tiebreak for determinism (selectXI relies on Set iteration order instead,
 * which is fine there since it only ever compares distinct players one at a time).
 */
export function bestFit(slot: Position, candidates: Player[]): Player | null {
  let best: Player | null = null;
  let bestKey: [number, number, number] | null = null; // [fitRank, -ovr, pid]
  for (const p of candidates) {
    const key: [number, number, number] = [fitRank(slot, p.pos), -p.ovr, p.pid];
    const better =
      !bestKey ||
      key[0] < bestKey[0] ||
      (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])));
    if (better) {
      best = p;
      bestKey = key;
    }
  }
  return best;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- test/core/selectXI.test.ts`
Expected: PASS (9 tests: 4 existing `selectXI` tests + 5 new `bestFit` tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/lineup/selectXI.ts test/core/selectXI.test.ts
git commit -m "Export bestFit position-matching helper from selectXI"
```

---

## Task 2: Pitch coordinate layout

**Files:**
- Create: `src/ui/pitchLayout.ts`
- Test: `test/ui/pitchLayout.test.ts`

**Interfaces:**
- Consumes: `Position` type from `src/core/players/types.js`.
- Produces: `interface SlotCoord { x: number; y: number }` and `layoutSlots(slots: Position[]): SlotCoord[]` — both exported from `src/ui/pitchLayout.js`. `x`/`y` are percentages (0-100) for absolute positioning within a pitch container, `y: 0` = attacking end (top), `y: 100` = defensive end (bottom, where the GK sits). Output array is index-aligned with the input `slots` array (same convention `resolveXI`/`selectXI` already use).

- [ ] **Step 1: Write the failing test**

Create `test/ui/pitchLayout.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { layoutSlots } from "../../src/ui/pitchLayout.js";
import { FORMATIONS } from "../../src/core/lineup/formations.js";

describe("layoutSlots", () => {
  it("returns one coordinate per slot, index-aligned", () => {
    const slots = FORMATIONS["4-3-3"];
    const coords = layoutSlots(slots);
    expect(coords).toHaveLength(slots.length);
  });

  it("places the GK deepest (highest y) and the ST furthest forward (lowest y)", () => {
    const slots = FORMATIONS["4-3-3"]; // ["GK","CB","CB","FB","FB","DM","CM","CM","W","W","ST"]
    const coords = layoutSlots(slots);
    const gkY = coords[0].y;
    const stY = coords[coords.length - 1].y;
    expect(gkY).toBeGreaterThan(stY);
    for (const c of coords) {
      expect(gkY).toBeGreaterThanOrEqual(c.y);
      expect(stY).toBeLessThanOrEqual(c.y);
    }
  });

  it("spaces duplicate-position slots apart (the two CBs don't overlap)", () => {
    const slots = FORMATIONS["4-3-3"];
    const coords = layoutSlots(slots);
    const cbIndices = slots.map((p, i) => (p === "CB" ? i : -1)).filter((i) => i >= 0);
    expect(cbIndices).toHaveLength(2);
    const [cb1, cb2] = cbIndices.map((i) => coords[i]);
    expect(cb1.x).not.toBe(cb2.x);
  });

  it("all coordinates stay within the 0-100 percentage bounds", () => {
    const coords = layoutSlots(FORMATIONS["4-3-3"]);
    for (const c of coords) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(100);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(100);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- test/ui/pitchLayout.test.ts`
Expected: FAIL — `src/ui/pitchLayout.ts` does not exist yet.

- [ ] **Step 3: Implement `pitchLayout.ts`**

Create `src/ui/pitchLayout.ts`:

```ts
import type { Position } from "../core/players/types.js";

export interface SlotCoord {
  x: number;
  y: number;
}

/**
 * Fixed 4-3-3 layout, percentages within the pitch container (y:0 = attacking end
 * at the top, y:100 = the GK's end at the bottom). Positions with more than one
 * slot in a formation (e.g. two CBs) list coordinates left-to-right; a formation
 * needing a third instance of a position (not currently wired up anywhere) would
 * need a third entry added here.
 */
const SLOT_LAYOUT: Record<Position, SlotCoord[]> = {
  GK: [{ x: 50, y: 92 }],
  CB: [{ x: 35, y: 75 }, { x: 65, y: 75 }],
  FB: [{ x: 12, y: 72 }, { x: 88, y: 72 }],
  DM: [{ x: 50, y: 58 }],
  CM: [{ x: 35, y: 42 }, { x: 65, y: 42 }],
  AM: [{ x: 50, y: 30 }],
  W: [{ x: 15, y: 22 }, { x: 85, y: 22 }],
  ST: [{ x: 50, y: 10 }],
};

/**
 * Maps each slot in `slots` to a pitch coordinate, index-aligned with the input.
 * When a position repeats (e.g. two CBs), successive occurrences pull the next
 * coordinate from that position's list; if a formation ever asks for more
 * occurrences than SLOT_LAYOUT has entries for, the last entry is reused.
 */
export function layoutSlots(slots: Position[]): SlotCoord[] {
  const seen: Partial<Record<Position, number>> = {};
  return slots.map((pos) => {
    const index = seen[pos] ?? 0;
    seen[pos] = index + 1;
    const coords = SLOT_LAYOUT[pos];
    return coords[Math.min(index, coords.length - 1)];
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- test/ui/pitchLayout.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/pitchLayout.ts test/ui/pitchLayout.test.ts
git commit -m "Add pitch slot coordinate layout for the 4-3-3 formation"
```

---

## Task 3: `PitchField` component + styles

**Files:**
- Create: `src/ui/components/PitchField.tsx`
- Modify: `src/ui/styles.css`

**Interfaces:**
- Consumes: `bestFit` (Task 1, from `../../core/lineup/selectXI.js`), `layoutSlots`/`SlotCoord` (Task 2, from `../pitchLayout.js`), `getRatingColor` (existing, `../utils/ratingColor.js`), `PlayerRatingsTooltip` (existing, `./PlayerRatingsTooltip.js`), `Flag` (existing, `./Flag.js`), `canExtend`/`contractTerms` (existing, `../../core/contracts.js`), `formatWeeklyWage`/`seasonYear` (existing, `../format.js`), `Player`/`Position` types (`../../core/players/types.js`).
- Produces: `export interface PitchFieldProps { starters: Player[]; slots: Position[]; bench: Player[]; showDepthChart: boolean; season: number; releasablePids: Set<number>; onRelease: (pid: number) => void; onExtend: (pid: number) => void; dragOverSlotIndex: number | null; setDragOverSlotIndex: (i: number | null) => void; onDropOnSlot: (slotIndex: number, draggedPid: number) => void; }` and `export function PitchField(props: PitchFieldProps): JSX.Element` from `src/ui/components/PitchField.js`. `starters` must be index-aligned with `slots` (i.e. pass the raw array `resolveXI` returns, not a re-sorted copy).

This task has no automated test (the repo has no React component test setup — `test/ui/ratingColor.test.ts` is the only precedent and it tests a pure function, not a component). Verification is TypeScript compilation plus the manual browser check in Task 5.

- [ ] **Step 1: Create `PitchField.tsx`**

Create `src/ui/components/PitchField.tsx`:

```tsx
import { useState } from "react";
import type { Player, Position } from "../../core/players/types.js";
import { bestFit } from "../../core/lineup/selectXI.js";
import { layoutSlots } from "../pitchLayout.js";
import { getRatingColor } from "../utils/ratingColor.js";
import { PlayerRatingsTooltip } from "./PlayerRatingsTooltip.js";
import { Flag } from "./Flag.js";
import { canExtend, contractTerms } from "../../core/contracts.js";
import { formatWeeklyWage, seasonYear } from "../format.js";

const DRAG_MIME = "application/x-soccer-gm-pid";

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

export interface PitchFieldProps {
  starters: Player[];
  slots: Position[];
  bench: Player[];
  showDepthChart: boolean;
  season: number;
  releasablePids: Set<number>;
  onRelease: (pid: number) => void;
  onExtend: (pid: number) => void;
  dragOverSlotIndex: number | null;
  setDragOverSlotIndex: (i: number | null) => void;
  onDropOnSlot: (slotIndex: number, draggedPid: number) => void;
}

export function PitchField({
  starters,
  slots,
  bench,
  showDepthChart,
  season,
  releasablePids,
  onRelease,
  onExtend,
  dragOverSlotIndex,
  setDragOverSlotIndex,
  onDropOnSlot,
}: PitchFieldProps) {
  const [openPid, setOpenPid] = useState<number | null>(null);
  const coords = layoutSlots(slots);

  return (
    <div className="pitch-field">
      {starters.map((p, i) => {
        const coord = coords[i];
        const backup = showDepthChart ? bestFit(slots[i], bench) : null;
        const isOpen = openPid === p.pid;
        return (
          <div
            key={p.pid}
            className={
              "pitch-slot" + (dragOverSlotIndex === i ? " pitch-slot--drag-over" : "")
            }
            style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOverSlotIndex(i);
            }}
            onDragLeave={() => setDragOverSlotIndex(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverSlotIndex(null);
              const raw = e.dataTransfer.getData(DRAG_MIME);
              if (!raw) return;
              onDropOnSlot(i, Number(raw));
            }}
          >
            <button
              type="button"
              className={"pitch-chip" + (p.pos === "GK" ? " pitch-chip--gk" : "")}
              style={{ borderColor: getRatingColor(p.ovr) }}
              onClick={() => setOpenPid(isOpen ? null : p.pid)}
            >
              <PlayerRatingsTooltip player={p}>
                <span className="pitch-chip-name">{shortName(p.name)}</span>
              </PlayerRatingsTooltip>
              <span className="pitch-chip-ovr">{p.ovr}</span>
            </button>
            {showDepthChart && (
              <div className="pitch-chip-backup">
                {backup ? `${shortName(backup.name)} ${backup.ovr}` : "—"}
              </div>
            )}
            {isOpen && (
              <div className="pitch-chip-actions">
                <div className="pitch-chip-actions-title">
                  {p.name} <Flag nationality={p.nationality} /> &middot; OVR {p.ovr} / POT{" "}
                  {p.potential}
                </div>
                <div className="pitch-chip-actions-meta">
                  {formatWeeklyWage(p.contract.salary)} &middot;{" "}
                  {p.contract.expiresSeason <= season
                    ? "Final year"
                    : `Through ${seasonYear(p.contract.expiresSeason)}`}
                </div>
                <div className="d-flex gap-1 mt-2">
                  {canExtend(p, season) &&
                    (() => {
                      const terms = contractTerms(p, season);
                      return (
                        <button
                          className="btn btn-sm btn-outline-success text-nowrap"
                          onClick={() => {
                            onExtend(p.pid);
                            setOpenPid(null);
                          }}
                        >
                          Extend {terms.lengthSeasons}y &middot; {formatWeeklyWage(terms.salary)}
                        </button>
                      );
                    })()}
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => {
                      onRelease(p.pid);
                      setOpenPid(null);
                    }}
                    disabled={!releasablePids.has(p.pid)}
                    title={
                      releasablePids.has(p.pid)
                        ? undefined
                        : `Can't release: squad would be too thin at ${p.pos}`
                    }
                  >
                    Release
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add pitch styles to `styles.css`**

Append to the end of `src/ui/styles.css`:

```css
/* =========================================================================
   Pitch field (Roster page — Starting XI visualization)
   ========================================================================= */
.pitch-field {
  position: relative;
  width: 100%;
  max-width: 520px;
  aspect-ratio: 68 / 100;
  margin: 0 auto 1rem;
  background: linear-gradient(180deg, var(--sg-green-deep) 0%, var(--sg-green-deep-2) 100%);
  border: 1px solid var(--sg-border-strong);
  border-radius: var(--sg-radius);
}
.pitch-field::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  border-top: 1px solid oklch(0.9 0.01 155 / 0.25);
}
.pitch-field::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 22%;
  aspect-ratio: 1;
  border: 1px solid oklch(0.9 0.01 155 / 0.25);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.pitch-slot {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  z-index: 1;
}
.pitch-slot--drag-over .pitch-chip {
  box-shadow: 0 0 0 3px var(--sg-green-wash);
}
.pitch-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--sg-surface-2);
  border: 2px solid var(--sg-border-strong);
  border-radius: 999px;
  color: var(--sg-text);
  font-size: var(--sg-text-sm);
  font-weight: var(--sg-weight-semibold);
  line-height: 1.4;
  cursor: pointer;
  white-space: nowrap;
}
.pitch-chip--gk {
  box-shadow: 0 0 0 2px var(--sg-warn);
}
.pitch-chip-ovr {
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}
.pitch-chip-backup {
  font-size: var(--sg-text-xs);
  color: var(--sg-text-muted);
  background: var(--sg-surface);
  border: 1px solid var(--sg-border);
  padding: 0 6px;
  border-radius: 999px;
  white-space: nowrap;
}
.pitch-chip-actions {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 6px;
  z-index: 1060;
  width: 240px;
  background: var(--sg-surface-2);
  border: 1px solid var(--sg-border-strong);
  border-radius: var(--sg-radius);
  box-shadow: var(--sg-shadow);
  padding: 0.5rem 0.75rem;
  font-size: var(--sg-text-sm);
  text-align: left;
  white-space: normal;
}
.pitch-chip-actions-title {
  font-weight: var(--sg-weight-semibold);
  color: var(--sg-text);
}
.pitch-chip-actions-meta {
  color: var(--sg-text-muted);
  margin-top: 2px;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/PitchField.tsx src/ui/styles.css
git commit -m "Add PitchField component: pitch visualization for the Starting XI"
```

---

## Task 4: Wire `PitchField` into the Roster page

**Files:**
- Modify: `src/ui/pages/Roster.tsx`

**Interfaces:**
- Consumes: `PitchField`/`PitchFieldProps` (Task 3, from `../components/PitchField.js`).

- [ ] **Step 1: Add the `PitchField` import**

In `src/ui/pages/Roster.tsx`, add to the imports (alongside the existing `PlayerRatingsTooltip` import):

```ts
import { PitchField } from "../components/PitchField.js";
```

- [ ] **Step 2: Capture `slots` and drop the now-unused sorted `starters`**

Find this block inside `export function Roster()`:

```ts
  const xi = resolveXI(players, FORMATIONS["4-3-3"], userTeam.starters);
  const starterPids = xi.map((p) => p.pid);
  const starterPidSet = new Set(starterPids);
  const starters = sortByPosThenOvr(xi);
  const bench = sortByPosThenOvr(players.filter((p) => !starterPidSet.has(p.pid)));
```

Replace it with:

```ts
  const slots = FORMATIONS["4-3-3"];
  const xi = resolveXI(players, slots, userTeam.starters);
  const starterPids = xi.map((p) => p.pid);
  const starterPidSet = new Set(starterPids);
  const bench = sortByPosThenOvr(players.filter((p) => !starterPidSet.has(p.pid)));
```

(`starters` is dropped because `PitchField` renders directly from `xi`, which must stay index-aligned with `slots` — the old `sortByPosThenOvr(xi)` re-ordering was only needed for the table view being replaced.)

- [ ] **Step 3: Add depth-chart and pitch drag-over state**

Find:

```ts
  const { league, releasePlayerAction, extendContractAction, setLineupAction } = useLeague();
  const [dragOverPid, setDragOverPid] = useState<number | null>(null);
```

Replace with:

```ts
  const { league, releasePlayerAction, extendContractAction, setLineupAction } = useLeague();
  const [dragOverPid, setDragOverPid] = useState<number | null>(null);
  const [dragOverSlotIndex, setDragOverSlotIndex] = useState<number | null>(null);
  const [showDepthChart, setShowDepthChart] = useState(false);
```

- [ ] **Step 4: Add `handleDropOnSlot`**

Find the existing `handleSwap` function:

```ts
  function handleSwap(draggedPid: number, targetPid: number) {
```

Immediately after the closing brace of `handleSwap` (i.e. after its `}`), add:

```ts

  function handleDropOnSlot(slotIndex: number, draggedPid: number) {
    const targetPid = starterPids[slotIndex];
    handleSwap(draggedPid, targetPid);
  }
```

- [ ] **Step 5: Replace the Starting XI section's JSX**

Find:

```tsx
          <p className="text-muted small mb-1">
            Drag a player onto another to swap them between the Starting XI and the bench.
          </p>
          <h6 className="mt-3">Starting XI</h6>
          <RosterTable
            players={starters}
            season={league.season}
            hasStats={hasStats}
            onRelease={releasePlayerAction}
            onExtend={extendContractAction}
            releasablePids={releasablePids}
            dragOverPid={dragOverPid}
            setDragOverPid={setDragOverPid}
            onSwap={handleSwap}
          />
```

Replace with:

```tsx
          <p className="text-muted small mb-1">
            Drag a bench player onto a pitch slot to swap them into the Starting XI.
          </p>
          <h6 className="mt-3">Starting XI</h6>
          <div className="form-check form-switch mb-2">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="depth-chart-toggle"
              checked={showDepthChart}
              onChange={(e) => setShowDepthChart(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="depth-chart-toggle">
              Depth Chart
            </label>
          </div>
          <PitchField
            starters={xi}
            slots={slots}
            bench={bench}
            showDepthChart={showDepthChart}
            season={league.season}
            releasablePids={releasablePids}
            onRelease={releasePlayerAction}
            onExtend={extendContractAction}
            dragOverSlotIndex={dragOverSlotIndex}
            setDragOverSlotIndex={setDragOverSlotIndex}
            onDropOnSlot={handleDropOnSlot}
          />
```

- [ ] **Step 6: Typecheck and run the full test suite**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run test`
Expected: all tests pass (no regressions; this file has no dedicated test suite itself, but `LeagueContext`/integration tests elsewhere must still pass).

- [ ] **Step 7: Commit**

```bash
git add src/ui/pages/Roster.tsx
git commit -m "Replace Roster page's Starting XI table with the pitch view"
```

---

## Task 5: Manual update and manual browser verification

**Files:**
- Modify: `src/ui/pages/Manual.tsx`

- [ ] **Step 1: Update the Manual's squad section**

In `src/ui/pages/Manual.tsx`, find this paragraph inside the `id="squad"` section:

```tsx
          <p>
            The formation is <strong>4-3-3</strong> (a formation picker hasn't been built yet). On
            the Roster page, drag and drop to swap players between the starting XI and the bench;
            your XI persists and is used every match. If your saved XI ever becomes invalid — a
            starter is sold, injured, or released — the game transparently falls back to
            auto-picking the best available XI, so you're never fielding a ghost. The bench is the
            best 7 remaining players by OVR.
          </p>
```

Replace with:

```tsx
          <p>
            The formation is <strong>4-3-3</strong> (a formation picker hasn't been built yet). On
            the Roster page, your Starting XI is shown on a pitch, one chip per slot; drag a bench
            player from the table below the pitch onto a slot to swap them in — the outgoing
            starter drops to the bench automatically. Click a chip to extend or release that
            player. A <strong>Depth Chart</strong> toggle above the pitch shows each starter's
            current best-fit backup from the bench alongside their chip. Your XI persists and is
            used every match. If your saved XI ever becomes invalid — a starter is sold, injured,
            or released — the game transparently falls back to auto-picking the best available XI,
            so you're never fielding a ghost. The bench is the best 7 remaining players by OVR.
          </p>
```

Also update the shorter mention earlier in the page. Find:

```tsx
            <li><strong>Roster</strong> — your squad: ratings, ages, contracts, season stats (goalkeepers additionally show goals against and xG against). Drag and drop to swap players between the starting XI and the bench, extend contracts, or release players.</li>
```

Replace with:

```tsx
            <li><strong>Roster</strong> — your squad: your Starting XI on a pitch view (with an optional Depth Chart overlay) plus a bench table with ratings, ages, contracts, season stats (goalkeepers additionally show goals against and xG against). Drag a bench player onto a pitch slot to swap them into the XI, extend contracts, or release players.</li>
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/pages/Manual.tsx
git commit -m "Update Manual for the Roster page's pitch view and depth chart"
```

- [ ] **Step 4: Manual browser verification**

Run: `npm run dev` (leave running), then open the app and navigate to a save's Roster page. Confirm, per this project's convention of browser-verifying UI changes before calling them done:
- The pitch renders 11 chips in a sensible 4-3-3 shape (GK deepest, two CBs and two FBs across the back line, DM/CM/W/ST ahead).
- Toggling "Depth Chart" shows a second, dimmer line under each chip with a bench player's name + OVR (or "—" if the bench has no eligible player).
- Dragging a bench-table row onto a pitch slot swaps that player into the XI and the previous starter appears in the bench table — reload the page (or navigate away and back) and confirm the swap persisted.
- Clicking a pitch chip opens the actions popover with the player's name/flag/OVR/POT, wage, contract length, and working Extend/Release buttons (Release disabled with the depth-floor tooltip when applicable, exactly as the bench table already behaves).
- Dragging a bench GK onto an outfield slot (or vice versa) is rejected, matching today's behavior.
- The bench table below the pitch is otherwise unchanged (same columns, same drag/extend/release behavior).

Stop the dev server once verified.

---

## Self-Review Notes

- **Spec coverage:** pitch visualization (Task 3-4), depth chart toggle + backup computation (Task 1, 3), drag bench→slot swap (Task 3-4, reusing existing `handleSwap`/`setLineupAction`), click-chip actions matching today's Extend/Release (Task 3), bench table unchanged (no bench-related file touched), visual style via existing `--sg-*` tokens only (Task 3), Manual update (Task 5). All spec goals and non-goals are respected — no formation picker, no persisted backup assignment, pitch chips aren't drag sources.
- **Type consistency:** `PitchFieldProps.starters`/`slots` index-alignment is stated identically in the spec, Task 3's interface note, and Task 4's wiring (`starters={xi}` alongside the same `slots` used for `resolveXI`). `bestFit`'s signature (`Position`, `Player[]` → `Player | null`) matches its Task 1 definition and its Task 3 usage (`bestFit(slots[i], bench)`).
- **No placeholders:** every step has complete, runnable code; no TBDs remain from the spec (both were resolved during planning — `bestFit` lives on `selectXI.ts` rather than a separate `depthChart.ts` file, since a wrapper module would have added no behavior).
