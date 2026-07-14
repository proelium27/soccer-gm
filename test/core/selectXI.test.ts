import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generatePlayer } from "../../src/core/players/generate.js";
import { selectXI, bestFit } from "../../src/core/lineup/selectXI.js";
import { FORMATIONS } from "../../src/core/lineup/formations.js";
import { ROSTER_COMPOSITION } from "../../src/core/constants.js";
import { POSITIONS, SKILL_KEYS } from "../../src/core/players/types.js";
import type { Player } from "../../src/core/players/types.js";

function roster(seed: number): Player[] {
  const rng = mulberry32(seed);
  const players: Player[] = [];
  let pid = 0;
  for (const pos of POSITIONS)
    for (let i = 0; i < ROSTER_COMPOSITION[pos]; i++)
      players.push(generatePlayer(rng, pos, 52, pid++, 20, 1));
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

function mkPlayer(pid: number, pos: Player["pos"], ovr: number): Player {
  return {
    pid,
    name: `Player ${pid}`,
    nationality: "ENG",
    born: 2000,
    pos,
    heightCm: 180,
    ratings: Object.fromEntries(SKILL_KEYS.map((k) => [k, 50])) as Player["ratings"],
    ovr,
    potential: ovr,
    contract: { salary: 10000, expiresSeason: 5 },
    injury: null,
    stats: [],
    hist: [],
  };
}

describe("bestFit", () => {
  it("prefers an exact position match over a higher-ovr adjacent one", () => {
    const cb = mkPlayer(1, "CB", 60);
    const dm = mkPlayer(2, "DM", 90); // DM is adjacent-fit for CB slot, but not exact
    expect(bestFit("CB", [dm, cb])).toBe(cb);
  });

  it("picks the higher-ovr candidate among equally-good fits", () => {
    const cbLow = mkPlayer(1, "CB", 55);
    const cbHigh = mkPlayer(2, "CB", 70);
    expect(bestFit("CB", [cbLow, cbHigh])).toBe(cbHigh);
  });

  it("falls back to an adjacent position when no exact fit exists", () => {
    const dm = mkPlayer(1, "DM", 65);
    const st = mkPlayer(2, "ST", 80); // not adjacent to CB at all
    expect(bestFit("CB", [dm, st])).toBe(dm);
  });

  it("breaks exact ties by lower pid, deterministically", () => {
    const a = mkPlayer(5, "CB", 70);
    const b = mkPlayer(2, "CB", 70);
    expect(bestFit("CB", [a, b])).toBe(b);
  });

  it("returns null for an empty candidate pool", () => {
    expect(bestFit("CB", [])).toBeNull();
  });
});
