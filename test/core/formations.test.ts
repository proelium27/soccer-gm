import { describe, it, expect } from "vitest";
import { FORMATIONS, FORMATION_IDS } from "../../src/core/lineup/formations.js";

describe("formations", () => {
  it("defines the four shapes, each with 11 slots and exactly one GK", () => {
    expect(FORMATION_IDS).toEqual(["4-3-3", "4-4-2", "3-5-2", "5-3-2"]);
    for (const id of FORMATION_IDS) {
      const slots = FORMATIONS[id];
      expect(slots).toHaveLength(11);
      expect(slots.filter((p) => p === "GK")).toHaveLength(1);
    }
  });
});
