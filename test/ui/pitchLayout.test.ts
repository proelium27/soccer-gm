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
