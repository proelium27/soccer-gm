import { describe, it, expect } from "vitest";
import { layoutSlots, FORMATION_LAYOUTS, TOTS_LAYOUT } from "../../src/ui/pitchLayout.js";
import { FORMATIONS, FORMATION_IDS } from "../../src/core/lineup/formations.js";
import { TOTS_SLOTS } from "../../src/core/awards.js";

describe("layoutSlots", () => {
  it("returns one coordinate per slot for every formation, index-aligned", () => {
    for (const id of FORMATION_IDS) {
      const coords = layoutSlots(id);
      expect(coords).toHaveLength(FORMATIONS[id].length);
      expect(FORMATION_LAYOUTS[id]).toHaveLength(FORMATIONS[id].length);
    }
  });

  it("places the GK nearest its own goal (lowest x) and no one behind it", () => {
    for (const id of FORMATION_IDS) {
      const coords = layoutSlots(id);
      const gkX = coords[0].x; // GK is always slot 0
      for (const c of coords) {
        expect(gkX).toBeLessThanOrEqual(c.x);
      }
    }
  });

  it("spaces every same-position slot apart so none overlap", () => {
    for (const id of FORMATION_IDS) {
      const slots = FORMATIONS[id];
      const coords = layoutSlots(id);
      // Group slot indices by position and check each group's points are distinct.
      const byPos = new Map<string, { x: number; y: number }[]>();
      slots.forEach((pos, i) => {
        const arr = byPos.get(pos) ?? [];
        arr.push(coords[i]);
        byPos.set(pos, arr);
      });
      for (const points of byPos.values()) {
        const keys = points.map((p) => `${p.x},${p.y}`);
        expect(new Set(keys).size).toBe(points.length);
      }
    }
  });

  it("keeps all coordinates within the 0-100 percentage bounds", () => {
    for (const id of FORMATION_IDS) {
      for (const c of layoutSlots(id)) {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x).toBeLessThanOrEqual(100);
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(c.y).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("TOTS_LAYOUT", () => {
  it("has one coordinate per award slot, index-aligned", () => {
    // TeamOfSeasonField maps pids[i] onto COORDS[i]. A mismatch here misplaces
    // or drops a slot silently rather than throwing.
    expect(TOTS_LAYOUT).toHaveLength(TOTS_SLOTS.length);
  });

  it("puts the keeper nearest his own goal, with nobody behind him", () => {
    const gkX = TOTS_LAYOUT[0].x;
    expect(TOTS_SLOTS[0]).toBe("GK");
    for (const c of TOTS_LAYOUT) expect(gkX).toBeLessThanOrEqual(c.x);
  });

  it("keeps every slot on the pitch and none stacked on another", () => {
    for (const c of TOTS_LAYOUT) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(100);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(100);
    }
    const keys = TOTS_LAYOUT.map((c) => `${c.x},${c.y}`);
    expect(new Set(keys).size).toBe(TOTS_LAYOUT.length);
  });

  it("draws the attacking midfielder ahead of the central midfielder", () => {
    // The midfield trio reads as holding / central / advanced, which is what
    // makes it recognisable as a 4-3-3 rather than a flat three.
    const am = TOTS_LAYOUT[TOTS_SLOTS.indexOf("AM")];
    const cm = TOTS_LAYOUT[TOTS_SLOTS.indexOf("CM")];
    const dm = TOTS_LAYOUT[TOTS_SLOTS.indexOf("DM")];
    expect(am.x).toBeGreaterThan(cm.x);
    expect(cm.x).toBeGreaterThan(dm.x);
  });
});
