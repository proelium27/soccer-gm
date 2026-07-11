import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generatePlayer } from "../../src/core/players/generate.js";
import { selectXI } from "../../src/core/lineup/selectXI.js";
import { resolveXI, isValidStarters } from "../../src/core/lineup/resolveXI.js";
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

describe("resolveXI manual starters", () => {
  it("honors a valid manual XI in slot order", () => {
    const squad = roster(1);
    const auto = selectXI(squad, SLOTS);
    const starters = auto.map((p) => p.pid);
    // Swap a legitimate bench outfielder into the ST slot (last 4-3-3 slot).
    const benchPids = new Set(squad.map((p) => p.pid));
    for (const p of auto) benchPids.delete(p.pid);
    const benchOutfielder = squad.find((p) => benchPids.has(p.pid) && p.pos !== "GK")!;
    starters[SLOTS.length - 1] = benchOutfielder.pid;

    expect(isValidStarters(squad, SLOTS, starters)).toBe(true);
    const xi = resolveXI(squad, SLOTS, starters);
    expect(xi.map((p) => p.pid)).toEqual(starters);
  });

  it("falls back to auto-selection when an outfielder sits in the GK slot", () => {
    const squad = roster(2);
    const starters = selectXI(squad, SLOTS).map((p) => p.pid);
    const striker = squad.find((p) => p.pos === "ST" && !starters.includes(p.pid))!;
    starters[0] = striker.pid; // GK slot

    expect(isValidStarters(squad, SLOTS, starters)).toBe(false);
    const xi = resolveXI(squad, SLOTS, starters);
    expect(xi[0].pos).toBe("GK");
  });

  it("falls back to auto-selection when a GK sits in an outfield slot", () => {
    const squad = roster(3);
    const starters = selectXI(squad, SLOTS).map((p) => p.pid);
    const backupGk = squad.find((p) => p.pos === "GK" && !starters.includes(p.pid))!;
    starters[SLOTS.length - 1] = backupGk.pid; // ST slot

    expect(isValidStarters(squad, SLOTS, starters)).toBe(false);
    const xi = resolveXI(squad, SLOTS, starters);
    expect(xi.filter((p) => p.pos === "GK")).toHaveLength(1);
    expect(xi[SLOTS.length - 1].pos).not.toBe("GK");
  });

  it("falls back to auto-selection on duplicate pids", () => {
    const squad = roster(4);
    const starters = selectXI(squad, SLOTS).map((p) => p.pid);
    starters[SLOTS.length - 1] = starters[SLOTS.length - 2];

    expect(isValidStarters(squad, SLOTS, starters)).toBe(false);
    const xi = resolveXI(squad, SLOTS, starters);
    expect(new Set(xi.map((p) => p.pid)).size).toBe(SLOTS.length);
  });

  it("falls back to auto-selection when a starter is no longer on the roster", () => {
    const squad = roster(5);
    const starters = selectXI(squad, SLOTS).map((p) => p.pid);
    const withoutStarter = squad.filter((p) => p.pid !== starters[5]);

    expect(isValidStarters(withoutStarter, SLOTS, starters)).toBe(false);
    const xi = resolveXI(withoutStarter, SLOTS, starters);
    expect(xi).toHaveLength(SLOTS.length);
    expect(xi.some((p) => p.pid === starters[5])).toBe(false);
  });
});
