import { describe, it, expect } from "vitest";
import { normalizeLeague } from "../../src/core/league/normalize.js";
import type { Composites } from "../../src/engine/composites.js";

function raw(name: string, a: number): Composites {
  return { name, attack: a, finishing: a, defense: a, keeping: a, control: a };
}

describe("normalizeLeague", () => {
  it("maps the average team to ~0.5 on every composite", () => {
    const inputs = [raw("A", 0.4), raw("B", 0.5), raw("C", 0.6)];
    const out = normalizeLeague(inputs);
    const mid = out.find((c) => c.name === "B")!;
    for (const k of ["attack", "finishing", "defense", "keeping", "control"] as const)
      expect(mid[k]).toBeCloseTo(0.5, 5);
  });
  it("clamps to [0.05, 0.95] and preserves ordering", () => {
    const inputs = Array.from({ length: 5 }, (_, i) => raw(`T${i}`, 0.3 + i * 0.1));
    const out = normalizeLeague(inputs);
    for (const c of out)
      for (const k of ["attack", "finishing", "defense", "keeping", "control"] as const) {
        expect(c[k]).toBeGreaterThanOrEqual(0.05);
        expect(c[k]).toBeLessThanOrEqual(0.95);
      }
    expect(out[4].attack).toBeGreaterThan(out[0].attack);
  });
  it("is invariant to league-wide inflation (scaling all inputs keeps 0.5 center)", () => {
    const base = [raw("A", 0.4), raw("B", 0.5), raw("C", 0.6)];
    const inflated = [raw("A", 0.8), raw("B", 1.0), raw("C", 1.2)];
    const o1 = normalizeLeague(base);
    const o2 = normalizeLeague(inflated);
    expect(o2.find((c) => c.name === "B")!.attack).toBeCloseTo(
      o1.find((c) => c.name === "B")!.attack, 5,
    );
  });
  it("handles zero variance by returning 0.5", () => {
    const out = normalizeLeague([raw("A", 0.5), raw("B", 0.5)]);
    expect(out[0].attack).toBe(0.5);
  });
});
