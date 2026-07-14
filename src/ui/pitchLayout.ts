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
