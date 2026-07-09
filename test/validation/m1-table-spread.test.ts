import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { simSeason as coreSimSeason } from "../../src/core/season.js";

function simSeason(seed: number) {
  const rng = mulberry32(seed);
  return coreSimSeason(rng).table;
}

describe("M1 gate (b) — season table spread", () => {
  it("champion 78-94 pts and bottom 15-32 pts (averaged over 5 seeded seasons)", () => {
    let champSum = 0;
    let bottomSum = 0;
    const SEASONS = 5;
    for (let s = 0; s < SEASONS; s++) {
      const table = simSeason(1000 + s);
      champSum += table[0].points;
      bottomSum += table[table.length - 1].points;
    }
    const champ = champSum / SEASONS;
    const bottom = bottomSum / SEASONS;
    expect(champ).toBeGreaterThanOrEqual(78);
    expect(champ).toBeLessThanOrEqual(94);
    expect(bottom).toBeGreaterThanOrEqual(15);
    expect(bottom).toBeLessThanOrEqual(32);
  });
});
