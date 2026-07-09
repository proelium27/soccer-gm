import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generatePlayer } from "../../src/core/players/generate.js";
import { selectXI } from "../../src/core/lineup/selectXI.js";
import { FORMATIONS } from "../../src/core/lineup/formations.js";
import { rollupComposites } from "../../src/core/composites.js";
import { ROSTER_COMPOSITION } from "../../src/core/constants.js";
import { POSITIONS } from "../../src/core/players/types.js";
import type { Player } from "../../src/core/players/types.js";

function xiFor(seed: number, base: number): Player[] {
  const rng = mulberry32(seed);
  const players: Player[] = [];
  let pid = 0;
  for (const pos of POSITIONS)
    for (let i = 0; i < ROSTER_COMPOSITION[pos]; i++)
      players.push(generatePlayer(rng, pos, base, pid++, -10));
  return selectXI(players, FORMATIONS["4-3-3"]);
}

describe("rollupComposites", () => {
  it("returns a named Composites with all five raw values > 0", () => {
    const c = rollupComposites(xiFor(1, 52), "Test FC");
    expect(c.name).toBe("Test FC");
    for (const k of ["attack", "finishing", "defense", "keeping", "control"] as const)
      expect(c[k]).toBeGreaterThan(0);
  });
  it("a higher-base XI rolls up stronger raw composites than a lower-base XI", () => {
    const strong = rollupComposites(xiFor(1, 66), "Strong");
    const weak = rollupComposites(xiFor(1, 40), "Weak");
    expect(strong.attack).toBeGreaterThan(weak.attack);
    expect(strong.defense).toBeGreaterThan(weak.defense);
    expect(strong.keeping).toBeGreaterThan(weak.keeping);
  });
});
