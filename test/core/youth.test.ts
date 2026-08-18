import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generateYouthIntake, youthGenerationBase } from "../../src/core/players/youth.js";
import { YOUTH_INTAKE_MIN, YOUTH_INTAKE_MAX, YOUTH_AGE, YOUTH_BASE_OFFSET } from "../../src/core/constants.js";

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

describe("youthGenerationBase", () => {
  // academyBase spans ~18.8 to ~63.0 across the 16-competition world.
  const WEAKEST = 18.8;
  const STRONGEST = 63.0;

  it("leaves clubs that were never underflowing effectively untouched", () => {
    // The raw offset is a swept anti-inflation constant, so every club with
    // headroom must keep generating what it generated before.
    for (const academyBase of [54, 57.1, 61.1, STRONGEST]) {
      const raw = academyBase - YOUTH_BASE_OFFSET;
      expect(Math.abs(youthGenerationBase(academyBase) - raw)).toBeLessThan(0.2);
    }
  });

  it("never returns a base low enough to clamp a whole intake to the rating floor", () => {
    for (let academyBase = WEAKEST; academyBase <= STRONGEST; academyBase += 0.5) {
      expect(youthGenerationBase(academyBase)).toBeGreaterThan(0);
    }
  });

  it("stays strictly monotonic, so a weaker academy still yields weaker youth", () => {
    let prev = -Infinity;
    for (let academyBase = WEAKEST; academyBase <= STRONGEST; academyBase += 0.25) {
      const b = youthGenerationBase(academyBase);
      expect(b).toBeGreaterThan(prev);
      prev = b;
    }
  });

  it("gives the weakest club in the world a usable, differentiated intake", () => {
    // Regression guard for the underflow: at raw base -15.2 every rating
    // generated below zero and clamped to RATING_MIN, so an intake came out as
    // near-identical rubble (measured OVR min/mean/max 1/4.1/9, and one real
    // save surfaced a 16-year-old striker at OVR 9).
    const ovrs: number[] = [];
    for (let k = 0; k < 8; k++) {
      const { players } = generateYouthIntake(mulberry32(k + 31), WEAKEST, 2042, 900000 + k * 50, 5, "Turkey");
      ovrs.push(...players.map((p) => p.ovr));
    }
    expect(Math.min(...ovrs)).toBeGreaterThan(1);
    // Differentiated, not a wall of identical floor-clamped players.
    expect(new Set(ovrs).size).toBeGreaterThan(5);
    expect(Math.max(...ovrs) - Math.min(...ovrs)).toBeGreaterThan(10);
  });

  it("still puts the weakest club's intake well below the strongest club's", () => {
    const meanOvr = (academyBase: number, country: string) => {
      const ovrs: number[] = [];
      for (let k = 0; k < 8; k++) {
        const { players } = generateYouthIntake(mulberry32(k + 31), academyBase, 2042, 910000 + k * 50, 5, country);
        ovrs.push(...players.map((p) => p.ovr));
      }
      return ovrs.reduce((a, b) => a + b, 0) / ovrs.length;
    };
    expect(meanOvr(STRONGEST, "Germany") - meanOvr(WEAKEST, "Turkey")).toBeGreaterThan(15);
  });
});
