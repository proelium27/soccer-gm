import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { simSeason } from "../../src/core/season.js";
import { NUM_TEAMS } from "../../src/core/constants.js";

describe("simSeason", () => {
  it("produces a full table: every team plays 38 and points equal 3W+D", () => {
    const { table, matches } = simSeason(mulberry32(1));
    expect(table).toHaveLength(NUM_TEAMS);
    expect(matches).toHaveLength(NUM_TEAMS * (NUM_TEAMS - 1));
    for (const row of table) {
      expect(row.played).toBe(38);
      expect(row.won + row.drawn + row.lost).toBe(38);
      expect(row.points).toBe(row.won * 3 + row.drawn);
    }
  });
  it("is deterministic for a given seed", () => {
    const a = simSeason(mulberry32(7)).table.map((r) => [r.tid, r.points]);
    const b = simSeason(mulberry32(7)).table.map((r) => [r.tid, r.points]);
    expect(a).toEqual(b);
  });
  it("total goals for equals total goals against across the league", () => {
    const { table } = simSeason(mulberry32(3));
    const gf = table.reduce((s, r) => s + r.gf, 0);
    const ga = table.reduce((s, r) => s + r.ga, 0);
    expect(gf).toBe(ga);
  });
});
