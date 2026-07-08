import { describe, it, expect } from "vitest";
import { doubleRoundRobin } from "../../src/core/schedule.js";

describe("doubleRoundRobin", () => {
  it("for 20 teams yields 380 fixtures, 38 per team", () => {
    const fixtures = doubleRoundRobin(Array.from({ length: 20 }, (_, i) => i));
    expect(fixtures).toHaveLength(380);
    for (let t = 0; t < 20; t++) {
      const played = fixtures.filter((f) => f.home === t || f.away === t);
      expect(played).toHaveLength(38);
    }
  });
  it("every ordered pair appears exactly once (home and away)", () => {
    const fixtures = doubleRoundRobin([0, 1, 2]);
    const keys = fixtures.map((f) => `${f.home}-${f.away}`).sort();
    expect(keys).toEqual(["0-1", "0-2", "1-0", "1-2", "2-0", "2-1"]);
  });
});
