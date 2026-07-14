# Roster page: visual field for the Starting XI

Date: 2026-07-14
Status: approved, ready for planning

## Background

The Roster page (`src/ui/pages/Roster.tsx`) currently renders the Starting XI and Bench as two identical dense tables (`RosterTable`, up to 19 columns: bio, ratings, wage, contract, 11 stat columns, Extend/Release actions), with drag-and-drop between rows to swap a player between the XI and bench.

Source idea, from the user's "Prompts" Google Doc ("Visual field"):
> Show the starting eleven as an actual visual field with slots for players to go in. Then the user can have a choice to display just the starting eleven on the field, or the "depth chart" which would show the starter, as well as his backup.

This spec covers replacing the Starting XI table with a pitch visualization. The Bench table is unchanged.

## Goals

- Replace the "Starting XI" `RosterTable` with a soccer-pitch visualization showing all 11 starters in their formation slots.
- Add a "Depth Chart" toggle: off shows just the starter per slot; on also shows the best-fit bench player for that slot.
- Preserve existing functionality: dragging a bench player onto a starter to swap them into the XI, and per-player Extend/Release actions.
- Keep the Bench table exactly as it is today (table, all columns, drag source, actions).

## Non-goals

- No formation picker. The team is still hard-coded to `FORMATIONS["4-3-3"]`, same as today's `Roster.tsx`. The pitch layout is written generically (keyed by `Position`, not hardcoded slot indices) so a future formation picker is a small lift, but wiring one up is out of scope here.
- No persisted "designated backup" concept. Depth-chart backups are computed fresh on every render from current bench state, not stored.
- Pitch chips are not drag *sources* in this pass. Swapping is bench-table-row → pitch-slot only (matches today's bench→starter direction plus the reverse already supported by the shared `handleSwap`, since `RosterTable` rows are draggable both ways — the pitch chips simply aren't, so a starter can't be dragged out onto the bench table via the pitch; releasing/benching a starter still works by dragging a bench player onto their slot, which swaps both directions in one drop).
- No changes to `selectXI`/`resolveXI`/`isValidStarters` logic, `LeagueContext`, or persistence — this is a UI-layer change only.

## Component design

### `src/ui/components/PitchField.tsx` (new)

A new presentational component rendering the pitch and slot chips.

**Props:**
```ts
interface PitchFieldProps {
  starters: Player[];       // xi, index-aligned with `slots`
  slots: Position[];        // FORMATIONS["4-3-3"]
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
```

**Layout:** a `<div className="pitch-field">` with `position: relative`, fixed aspect ratio (e.g. `aspect-ratio: 68 / 100`, portrait orientation, attacking direction "up"), styled with the existing `--sg-green*` tokens for turf plus simple line markings (center line, center circle, penalty boxes) drawn with CSS borders/`::before`/`::after` — no SVG/image asset needed.

**Slot coordinates:** a module-level `SLOT_LAYOUT: Record<Position, { x: number; y: number }[]>` giving one or more `{x, y}` percentage positions per `Position`, consumed in slot order. For `FORMATIONS["4-3-3"]` (`["GK","CB","CB","FB","FB","DM","CM","CM","W","W","ST"]`) a `layoutSlots(slots: Position[]): {x,y}[]` helper walks the array, pulling the next coordinate for each position from `SLOT_LAYOUT`, spacing duplicate positions evenly (e.g. the two `CB` coordinates are pre-defined as left/right; a third `CB`, as used by 3-5-2/5-3-2, would need a 3-wide entry — out of scope now since only 4-3-3 is wired up, but the lookup table is shaped to extend by adding entries per formation if that ever changes). Rows (bottom → top): GK ~y92, CB/FB back line ~y75, DM ~y58, CM ~y42, W/AM ~y25, ST ~y10.

**Each slot renders `PitchChip`:**
- A rounded chip: short display name (last name, or first-initial + last name if it overflows — reuse whatever truncation convention exists, else simple CSS `text-overflow: ellipsis` on a fixed-width chip) + OVR number, background tinted via `getRatingColor(player.ovr)` (existing helper from `src/ui/utils/ratingColor.ts`, currently used per-attribute in the tooltip — reused here at the whole-chip level).
- GK chip gets a distinct border/accent color (reuse `--sg-warn` or similar existing token) so it reads as non-swappable-with-outfielders at a glance.
- Depth chart mode: a smaller second line below the chip showing the backup's short name + OVR, dimmed (`--sg-text-muted`), or "—" if no eligible bench player exists for that slot.
- Click opens a popover anchored to the chip (absolutely positioned, same panel styling as `PlayerRatingsTooltip`'s `.player-ratings-tooltip-panel`) showing: name, flag, OVR/POT, full skill grid (delegate to `PlayerRatingsTooltip`'s existing rendering — see Implementation notes), and Extend/Release buttons matching today's `RosterTable` action cell exactly (same `canExtend`/`contractTerms`/`releasablePids` logic, same button labels/disabled-title). Only one popover open at a time; clicking elsewhere or pressing Escape closes it.
- Slot is a drop target: `onDragOver`/`onDrop` call back to `Roster.tsx` with the slot's index, matching the existing pattern in `RosterTable`'s `<tr>` handlers. Drag-over state highlights the slot (reuse a `.pitch-slot--drag-over` style analogous to today's `table-active` class).

### Depth-chart backup computation

A small pure helper (co-located in `PitchField.tsx` or a new `src/core/lineup/depthChart.ts` if it's cleaner to unit test) that, given a slot's `Position` and the current bench array, picks the bench player with the best `fitRank` (imported from `selectXI.ts` — currently unexported; export it) then highest `ovr`, ties broken by `pid` for determinism. Returns `Player | null`. This mirrors `selectXI`'s own selection logic exactly, just scoped to the bench pool instead of the whole roster, and computed per-slot without mutating a shared "already assigned" set — two slots may show the same backup if it's the bench's best fit for both (a CB gap and an FB gap could both point at the same versatile bench CB), which is fine since this is read-only display, not an assignment.

### `Roster.tsx` changes

- Import and render `PitchField` in place of the first `RosterTable` call (the `starters`/`xi` one). Keep the second `RosterTable` call (bench) unchanged.
- Add local state: `const [showDepthChart, setShowDepthChart] = useState(false)` and `const [dragOverSlotIndex, setDragOverSlotIndex] = useState<number | null>(null)` (replacing/extending the existing single `dragOverPid` state — the pitch needs to highlight by slot index since a slot's player identity changes on swap, while the bench table keeps highlighting by pid as it does today; both states coexist, each owned by its respective view).
- Add a toggle control (Bootstrap form-check switch, matching existing form-control styling elsewhere in the app) labeled "Depth Chart" above the pitch.
- New `handleDropOnSlot(slotIndex: number, draggedPid: number)`: looks up `starterPids[slotIndex]` as the target pid, reuses the existing `handleSwap(draggedPid, targetPid)` logic (GK/outfield guard, `setLineupAction` call) — `handleSwap` itself doesn't need to change, just gets called with a pid resolved from slot index instead of from a row's pid directly.
- The instructional text above the XI ("Drag a player onto another to swap...") updates to describe dragging onto a pitch slot.

## Visual style

Pitch background: a subtle radial/linear gradient between two close green shades pulled from existing tokens (e.g. `--sg-green-deep` to `--sg-green-deep-2`, already used for the top bar/sidebar) so it reads as turf without introducing new color tokens. Line markings: 1-2px `--sg-border-strong` lines at low opacity. This keeps the whole page inside the current dark theme rather than introducing a bright literal-grass green that would clash.

## Testing

- No engine/logic changes to `selectXI`, `resolveXI`, or `LeagueContext` — existing tests there are unaffected.
- New unit tests for the depth-chart backup helper (exported `fitRank` from `selectXI.ts` + the new bench-lookup function): given a bench and a slot position, returns the expected best-fit player; returns `null` on an empty bench; ties broken deterministically by pid.
- Manual browser verification (per project convention): load a save with a full roster, confirm pitch renders 11 chips in sensible 4-3-3 positions, toggle depth chart on/off, drag a bench player onto a pitch slot and confirm the swap persists (reload/re-render), click a chip to confirm the popover shows correct ratings and that Extend/Release behave identically to today's table buttons, confirm GK slot rejects an outfield drag (and vice versa) same as today.

## Files touched

- New: `src/ui/components/PitchField.tsx`
- New (or inline): depth-chart backup helper, `src/core/lineup/depthChart.ts` — TBD during planning whether it's worth a separate file or lives in `PitchField.tsx`
- Modified: `src/ui/pages/Roster.tsx`
- Modified: `src/core/lineup/selectXI.ts` (export `fitRank`, or export a small `bestFit(slot, candidates)` helper instead — TBD during planning, whichever is the smaller diff)
- Modified: `src/ui/styles.css` (pitch, chip, popover, toggle styles)
- Manual (`src/ui/pages/Manual.tsx`): add/update a short note under the Roster section describing the pitch view and depth-chart toggle, per this repo's convention that the Manual doubles as the feature ledger.
