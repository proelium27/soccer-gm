import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../../src/engine/rng.js";
import { trueTransferValue, perceivedTransferValue } from "../../../src/core/finance/valuation.js";
import type { Player, PlayerRatings } from "../../../src/core/players/types.js";
import { SCOUTING_SPEND_MAX, MAX_TRANSFER_VALUE } from "../../../src/core/constants.js";

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

  it("applies an elite premium above the threshold that stays below the ceiling", () => {
    // At/below the elite threshold (VALUATION_ELITE_THRESHOLD, currently 76)
    // the premium is zero; above it, value climbs faster than the base curve.
    //
    // Crucially the premium is a RAMP, not a wall. It used to saturate
    // MAX_TRANSFER_VALUE outright at ovr 80 (11M x 4^2.5 = 352M from the
    // premium alone), which made every player 80+ cost exactly the ceiling and
    // turned the all-time-record fee into the routine price of a good player.
    // Each elite step must now remain strictly distinguishable from the last,
    // and an ordinary elite (80-85) must stay clear of the ceiling — see the
    // VALUATION_ELITE_* note in constants.ts.
    const prime = { born: 2026 - 26, contract: { salary: 1000, expiresSeason: 2027 } };
    const val = (ovr: number) =>
      trueTransferValue(makePlayer({ ovr, potential: ovr, ...prime }), 2026);
    const [at76, at78, at80, at82, at85, at90] = [76, 78, 80, 82, 85, 90].map(val);

    // The premium bites above the knee: an elite player outruns the base curve.
    expect(at80).toBeGreaterThan(at76 * 1.3);
    // Strictly increasing all the way up — no flat-topped saturation band.
    expect(at78).toBeGreaterThan(at76);
    expect(at80).toBeGreaterThan(at78);
    expect(at82).toBeGreaterThan(at80);
    expect(at85).toBeGreaterThan(at82);
    expect(at90).toBeGreaterThan(at85);
    // A garden-variety elite is expensive but nowhere near the record ceiling.
    expect(at85).toBeLessThan(MAX_TRANSFER_VALUE * 0.75);
    // Nothing ever exceeds it.
    expect(at90).toBeLessThanOrEqual(MAX_TRANSFER_VALUE);
  });

  it("never exceeds the value ceiling, even for an extreme player", () => {
    const monster = makePlayer({
      ovr: 99, potential: 99, born: 2026 - 19,
      contract: { salary: 1000, expiresSeason: 2046 },
    });
    expect(trueTransferValue(monster, 2026)).toBe(MAX_TRANSFER_VALUE);
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
