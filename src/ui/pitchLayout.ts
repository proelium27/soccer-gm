import type { Position } from "../core/players/types.js";

export interface SlotCoord {
  x: number;
  y: number;
}

/**
 * Fixed 4-3-3 layout, percentages within the pitch container. The pitch is drawn
 * horizontally: x:0 = the GK's own goal line (left), x:100 = the attacking end
 * (right). Positions with more than one slot in a formation (e.g. two CBs) list
 * coordinates top-to-bottom; a formation needing a third instance of a position
 * (not currently wired up anywhere) would need a third entry added here.
 */
const SLOT_LAYOUT: Record<Position, SlotCoord[]> = {
  GK: [{ x: 8, y: 50 }],
  CB: [{ x: 25, y: 35 }, { x: 25, y: 65 }],
  FB: [{ x: 28, y: 12 }, { x: 28, y: 88 }],
  DM: [{ x: 42, y: 50 }],
  CM: [{ x: 55, y: 35 }, { x: 55, y: 65 }],
  AM: [{ x: 68, y: 50 }],
  W: [{ x: 75, y: 15 }, { x: 75, y: 85 }],
  ST: [{ x: 90, y: 50 }],
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
