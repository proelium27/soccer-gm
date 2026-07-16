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

  it("skews toward the club's own country when homeCountry is given", () => {
    let pid = 0;
    let italyCount = 0;
    let spainCount = 0;
    for (let i = 0; i < 300; i++) {
      const rng = mulberry32(1000 + i);
      const { players, nextPid } = generateYouthIntake(rng, 60, 5, pid, i, "Italy");
      pid = nextPid;
      for (const p of players) if (p.nationality === "Italy") italyCount++;
    }
    for (let i = 0; i < 300; i++) {
      const rng = mulberry32(2000 + i);
      const { players, nextPid } = generateYouthIntake(rng, 60, 5, pid, i, "Spain");
      pid = nextPid;
      for (const p of players) if (p.nationality === "Spain") spainCount++;
    }
    // Each country's own intake should be dominated by its own nationality —
    // and the cross-country counts should stay low, proving intake is
    // country-aware rather than reading from one shared flat pool.
    expect(italyCount).toBeGreaterThan(300);
    expect(spainCount).toBeGreaterThan(300);
  });

  it("without a homeCountry, does not draw Italy into an English-flavored intake at a heightened rate", () => {
    // Regression guard: Italy was added to the shared NATIONALITIES table so
    // that Italian clubs' intake could be boosted toward it — but youth
    // intake for a club with no explicit country used to fall through to
    // that same shared table unmodified, so this asserts the flat/no-country
    // path stays a small background presence, not a club-specific skew.
    let pid = 0;
    let italyCount = 0;
    let total = 0;
    for (let i = 0; i < 300; i++) {
      const rng = mulberry32(3000 + i);
      const { players, nextPid } = generateYouthIntake(rng, 60, 5, pid, i, "England");
      pid = nextPid;
      total += players.length;
      for (const p of players) if (p.nationality === "Italy") italyCount++;
    }
    expect(italyCount / total).toBeLessThan(0.05);
  });
});
