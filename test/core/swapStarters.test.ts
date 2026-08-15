import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generatePlayer } from "../../src/core/players/generate.js";
import { selectXI } from "../../src/core/lineup/selectXI.js";
import { isValidStarters } from "../../src/core/lineup/resolveXI.js";
import { swapStarters } from "../../src/core/lineup/swapStarters.js";
import { FORMATIONS } from "../../src/core/lineup/formations.js";
import { ROSTER_COMPOSITION } from "../../src/core/constants.js";
import { POSITIONS } from "../../src/core/players/types.js";
import type { Player } from "../../src/core/players/types.js";

const SLOTS = FORMATIONS["4-3-3"];

function roster(seed: number): Player[] {
  const rng = mulberry32(seed);
  const players: Player[] = [];
  let pid = 0;
  for (const pos of POSITIONS)
    for (let i = 0; i < ROSTER_COMPOSITION[pos]; i++)
      players.push(generatePlayer(rng, pos, 52, pid++, 20, 1));
  return players;
}

/** Squad, its auto-picked XI as pids, and the pids left on the bench. */
function setup(seed: number) {
  const squad = roster(seed);
  const starters = selectXI(squad, SLOTS).map((p) => p.pid);
  const bench = squad.filter((p) => !starters.includes(p.pid));
  return { squad, starters, bench };
}

/** Index of the first outfield slot (4-3-3 puts the keeper at 0). */
const OUTFIELD_A = 1;
const OUTFIELD_B = SLOTS.length - 1;

describe("swapStarters", () => {
  it("trades two starters' slots", () => {
    const { squad, starters } = setup(1);
    const a = starters[OUTFIELD_A];
    const b = starters[OUTFIELD_B];

    const next = swapStarters(squad, SLOTS, starters, a, b);

    expect(next).not.toBeNull();
    expect(next![OUTFIELD_A]).toBe(b);
    expect(next![OUTFIELD_B]).toBe(a);
    // Same eleven, only the order changed.
    expect(new Set(next!)).toEqual(new Set(starters));
  });

  it("leaves the rest of the XI untouched when two starters trade", () => {
    const { squad, starters } = setup(6);
    const next = swapStarters(
      squad, SLOTS, starters, starters[OUTFIELD_A], starters[OUTFIELD_B],
    )!;
    for (let i = 0; i < SLOTS.length; i++) {
      if (i === OUTFIELD_A || i === OUTFIELD_B) continue;
      expect(next[i]).toBe(starters[i]);
    }
  });

  it("still swaps a bench player into a starter's slot", () => {
    const { squad, starters, bench } = setup(2);
    const sub = bench.find((p) => p.pos !== "GK")!;
    const out = starters[OUTFIELD_B];

    const next = swapStarters(squad, SLOTS, starters, sub.pid, out)!;

    expect(next[OUTFIELD_B]).toBe(sub.pid);
    expect(next).not.toContain(out);
  });

  it("swaps a starter out when dragged onto a bench player", () => {
    const { squad, starters, bench } = setup(3);
    const sub = bench.find((p) => p.pos !== "GK")!;
    const out = starters[OUTFIELD_A];

    const next = swapStarters(squad, SLOTS, starters, out, sub.pid)!;

    expect(next[OUTFIELD_A]).toBe(sub.pid);
    expect(next).not.toContain(out);
  });

  it("rejects moving the keeper into an outfield slot", () => {
    const { squad, starters } = setup(4);
    expect(swapStarters(squad, SLOTS, starters, starters[0], starters[OUTFIELD_B])).toBeNull();
  });

  it("rejects moving an outfielder into the keeper's slot", () => {
    const { squad, starters } = setup(4);
    expect(swapStarters(squad, SLOTS, starters, starters[OUTFIELD_B], starters[0])).toBeNull();
  });

  it("rejects a backup keeper dropped into an outfield slot", () => {
    const { squad, starters, bench } = setup(5);
    const backupGk = bench.find((p) => p.pos === "GK")!;
    expect(swapStarters(squad, SLOTS, starters, backupGk.pid, starters[OUTFIELD_B])).toBeNull();
  });

  it("accepts a backup keeper dropped onto the keeper's slot", () => {
    const { squad, starters, bench } = setup(5);
    const backupGk = bench.find((p) => p.pos === "GK")!;
    const next = swapStarters(squad, SLOTS, starters, backupGk.pid, starters[0])!;
    expect(next[0]).toBe(backupGk.pid);
  });

  it("is a no-op for two bench players", () => {
    const { squad, starters, bench } = setup(1);
    expect(swapStarters(squad, SLOTS, starters, bench[0].pid, bench[1].pid)).toBeNull();
  });

  it("is a no-op when a player is dropped on himself", () => {
    const { squad, starters } = setup(1);
    expect(swapStarters(squad, SLOTS, starters, starters[3], starters[3])).toBeNull();
  });

  it("only ever returns an XI resolveXI will honour", () => {
    const { squad, starters, bench } = setup(7);
    const candidates = [...starters, ...bench.map((p) => p.pid)];
    for (const a of candidates) {
      for (const b of candidates) {
        const next = swapStarters(squad, SLOTS, starters, a, b);
        if (next === null) continue;
        expect(isValidStarters(squad, SLOTS, next)).toBe(true);
      }
    }
  });
});
