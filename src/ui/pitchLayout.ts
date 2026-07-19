import type { FormationId } from "../core/lineup/formations.js";

export interface SlotCoord {
  x: number;
  y: number;
}

/**
 * Pitch coordinates for each formation, as percentages within the pitch
 * container. The pitch is drawn horizontally: x:0 = the GK's own goal line
 * (left), x:100 = the attacking end (right); y:0 = top touchline, y:100 =
 * bottom. Each array is index-aligned with that formation's slot array in
 * FORMATIONS, so slot i renders at coordinate i. Per-formation (rather than
 * per-position) so back-3/back-5 shapes and pushed-up wing-backs lay out
 * correctly instead of reusing a fixed two-CB template.
 */
export const FORMATION_LAYOUTS: Record<FormationId, SlotCoord[]> = {
  // GK, CB, CB, FB, FB, DM, CM, CM, W, W, ST
  "4-3-3": [
    { x: 8, y: 50 },
    { x: 25, y: 35 },
    { x: 25, y: 65 },
    { x: 28, y: 12 },
    { x: 28, y: 88 },
    { x: 42, y: 50 },
    { x: 55, y: 35 },
    { x: 55, y: 65 },
    { x: 75, y: 15 },
    { x: 75, y: 85 },
    { x: 90, y: 50 },
  ],
  // GK, CB, CB, FB, FB, W, CM, CM, W, ST, ST
  "4-4-2": [
    { x: 8, y: 50 },
    { x: 25, y: 38 },
    { x: 25, y: 62 },
    { x: 25, y: 12 },
    { x: 25, y: 88 },
    { x: 52, y: 12 },
    { x: 50, y: 38 },
    { x: 50, y: 62 },
    { x: 52, y: 88 },
    { x: 88, y: 38 },
    { x: 88, y: 62 },
  ],
  // GK, CB, CB, CB, FB, FB, CM, CM, AM, ST, ST
  "3-5-2": [
    { x: 8, y: 50 },
    { x: 24, y: 25 },
    { x: 24, y: 50 },
    { x: 24, y: 75 },
    { x: 48, y: 10 },
    { x: 48, y: 90 },
    { x: 46, y: 38 },
    { x: 46, y: 62 },
    { x: 66, y: 50 },
    { x: 88, y: 38 },
    { x: 88, y: 62 },
  ],
  // GK, CB, CB, CB, FB, FB, DM, CM, CM, ST, ST
  "5-3-2": [
    { x: 8, y: 50 },
    { x: 24, y: 30 },
    { x: 24, y: 50 },
    { x: 24, y: 70 },
    { x: 28, y: 10 },
    { x: 28, y: 90 },
    { x: 48, y: 50 },
    { x: 58, y: 32 },
    { x: 58, y: 68 },
    { x: 88, y: 38 },
    { x: 88, y: 62 },
  ],
};

/** The pitch coordinates for a formation, one per slot, index-aligned with FORMATIONS[formation]. */
export function layoutSlots(formation: FormationId): SlotCoord[] {
  return FORMATION_LAYOUTS[formation];
}
