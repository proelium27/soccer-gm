import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../../src/engine/rng.js";
import { trueTransferValue, perceivedTransferValue } from "../../../src/core/finance/valuation.js";
import type { Player, PlayerRatings } from "../../../src/core/players/types.js";
import { SCOUTING_SPEND_MAX } from "../../../src/core/constants.js";

const RATINGS: PlayerRatings = {
  speed: 50, strength: 50, stamina: 50, jumping: 50,
  shortPass: 50, longPass: 50, crosses: 50, dribbling: 50, longShot: 50, finishing: 50,
  tackling: 50, interceptions: 50, positioning: 50, goalkeeping: 50,
};

function makePlayer(overrides: Partial<Player>): Player {
  return {
    pid: 1,
    name: "Test Player",
    nationality: "TST",
    born: 2000,
    pos: "CM",
    heightCm: 180,
    ratings: RATINGS,
    ovr: 60,
    potential: 65,
    contract: { salary: 1000, expiresSeason: 2027 },
    injury: null,
    stats: [],
    hist: [],
    ...overrides,
  };
}

describe("trueTransferValue", () => {
  it("is worth ~nothing at or below the ovr floor", () => {
    const player = makePlayer({ ovr: 35 });
    expect(trueTransferValue(player, 2026)).toBe(0);
  });

  it("increases with ovr", () => {
    const low = makePlayer({ ovr: 55 });
    const high = makePlayer({ ovr: 85 });
    expect(trueTransferValue(high, 2026)).toBeGreaterThan(trueTransferValue(low, 2026));
  });

  it("values a player near their peak age higher than an aging one, at equal ovr", () => {
    const prime = makePlayer({ ovr: 75, born: 2026 - 26 });
    const aging = makePlayer({ ovr: 75, born: 2026 - 36 });
    expect(trueTransferValue(prime, 2026)).toBeGreaterThan(trueTransferValue(aging, 2026));
  });

  it("values more remaining contract length higher, at equal ovr and age", () => {
    const shortDeal = makePlayer({ ovr: 75, contract: { salary: 1000, expiresSeason: 2027 } });
    const longDeal = makePlayer({ ovr: 75, contract: { salary: 1000, expiresSeason: 2032 } });
    expect(trueTransferValue(longDeal, 2026)).toBeGreaterThan(trueTransferValue(shortDeal, 2026));
  });

  it("applies a steep 'priceless star' premium above the elite threshold", () => {
    // At/below the elite threshold the premium is zero; above it, value climbs
    // far faster than the base curve, pricing a generational talent out of any
    // club's budget (see VALUATION_ELITE_* in constants.js).
    const prime = { born: 2026 - 26, contract: { salary: 1000, expiresSeason: 2027 } };
    const at85 = trueTransferValue(makePlayer({ ovr: 85, potential: 85, ...prime }), 2026);
    const at90 = trueTransferValue(makePlayer({ ovr: 90, potential: 90, ...prime }), 2026);
    const at92 = trueTransferValue(makePlayer({ ovr: 92, potential: 92, ...prime }), 2026);
    // A 90-OVR star now clears a $400M budget cap; the 85→90 jump is far bigger
    // than the base-curve-only 85→90 step (~156M→~201M) would produce.
    expect(at90).toBeGreaterThan(400_000_000);
    expect(at90 - at85).toBeGreaterThan(200_000_000);
    // Super-linear: the 2-point 90→92 step outweighs a 1-point step lower down.
    expect(at92 - at90).toBeGreaterThan(at85 * 0.5);
    expect(at92).toBeGreaterThan(at90);
  });
});

describe("perceivedTransferValue", () => {
  it("is closer on average to true value with max scouting spend than with none", () => {
    const player = makePlayer({ ovr: 75 });
    const trueValue = trueTransferValue(player, 2026);
    const rng = mulberry32(1);

    const n = 200;
    let errNoScouting = 0;
    let errMaxScouting = 0;
    for (let i = 0; i < n; i++) {
      errNoScouting += Math.abs(perceivedTransferValue(rng, player, 2026, 0) - trueValue);
      errMaxScouting += Math.abs(perceivedTransferValue(rng, player, 2026, SCOUTING_SPEND_MAX) - trueValue);
    }
    expect(errMaxScouting / n).toBeLessThan(errNoScouting / n);
  });

  it("never goes negative", () => {
    const player = makePlayer({ ovr: 41 });
    const rng = mulberry32(2);
    for (let i = 0; i < 50; i++) {
      expect(perceivedTransferValue(rng, player, 2026, 0)).toBeGreaterThanOrEqual(0);
    }
  });
});
