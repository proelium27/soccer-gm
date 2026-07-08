import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generatePlayer } from "../../src/core/players/generate.js";
import { selectXI } from "../../src/core/lineup/selectXI.js";
import { FORMATIONS } from "../../src/core/lineup/formations.js";
import { ROSTER_COMPOSITION } from "../../src/core/constants.js";
import { POSITIONS } from "../../src/core/players/types.js";
import type { Player } from "../../src/core/players/types.js";

function roster(seed: number): Player[] {
  const rng = mulberry32(seed);
  const players: Player[] = [];
  let pid = 0;
  for (const pos of POSITIONS)
    for (let i = 0; i < ROSTER_COMPOSITION[pos]; i++)
      players.push(generatePlayer(rng, pos, 52, pid++));
  return players;
}

describe("selectXI", () => {
  it("returns 11 distinct players for a 4-3-3", () => {
    const xi = selectXI(roster(1), FORMATIONS["4-3-3"]);
    expect(xi).toHaveLength(11);
    expect(new Set(xi.map((p) => p.pid)).size).toBe(11);
  });
  it("puts a natural GK in the GK slot", () => {
    const xi = selectXI(roster(2), FORMATIONS["4-3-3"]);
    expect(xi[0].pos).toBe("GK");
  });
  it("fills every slot even when a natural position is missing (adjacency fallback)", () => {
    const noFb = roster(3).filter((p) => p.pos !== "FB");
    const xi = selectXI(noFb, FORMATIONS["4-3-3"]);
    expect(xi).toHaveLength(11);
    expect(new Set(xi.map((p) => p.pid)).size).toBe(11);
  });
});
