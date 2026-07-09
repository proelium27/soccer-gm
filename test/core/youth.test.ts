import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generateYouthIntake } from "../../src/core/players/youth.js";
import { YOUTH_INTAKE_MIN, YOUTH_INTAKE_MAX, YOUTH_AGE } from "../../src/core/constants.js";

describe("generateYouthIntake", () => {
  it("generates between min and max players, all age 16", () => {
    const rng = mulberry32(1);
    const { players, nextPid } = generateYouthIntake(rng, 60, 5, 100);
    expect(players.length).toBeGreaterThanOrEqual(YOUTH_INTAKE_MIN);
    expect(players.length).toBeLessThanOrEqual(YOUTH_INTAKE_MAX);
    for (const p of players) {
      expect(5 - p.born).toBe(YOUTH_AGE);
      expect(p.pid).toBeGreaterThanOrEqual(100);
    }
    expect(nextPid).toBe(100 + players.length);
  });

  it("is deterministic for a given seed", () => {
    const a = generateYouthIntake(mulberry32(9), 55, 3, 0);
    const b = generateYouthIntake(mulberry32(9), 55, 3, 0);
    expect(a).toEqual(b);
  });

  it("pids are assigned sequentially with no collisions", () => {
    const { players } = generateYouthIntake(mulberry32(2), 55, 1, 50);
    const pids = players.map((p) => p.pid);
    expect(new Set(pids).size).toBe(pids.length);
  });
});
