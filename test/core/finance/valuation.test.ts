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

  it("applies a steep elite premium above the threshold, capped at the value ceiling", () => {
    // At/below the elite threshold (VALUATION_ELITE_THRESHOLD, currently 76) the
    // premium is zero; above it, value climbs far faster than the base curve.
    // But it no longer runs off to infinity — the final value is clamped at
    // MAX_TRANSFER_VALUE so quoted fees stay believable. "You can't buy the
    // very best" is enforced by the not-for-sale gate (protectedStars.ts), not
    // by an unpayable price (see VALUATION_ELITE_* / MAX_TRANSFER_VALUE).
    const prime = { born: 2026 - 26, contract: { salary: 1000, expiresSeason: 2027 } };
    const at76 = trueTransferValue(makePlayer({ ovr: 76, potential: 76, ...prime }), 2026);
    const at78 = trueTransferValue(makePlayer({ ovr: 78, potential: 78, ...prime }), 2026);
    const at80 = trueTransferValue(makePlayer({ ovr: 80, potential: 80, ...prime }), 2026);
    const at82 = trueTransferValue(makePlayer({ ovr: 82, potential: 82, ...prime }), 2026);
    // Just above the threshold the premium already bites hard.
    expect(at78).toBeGreaterThan(at76 * 1.5); // a 2-point step above the knee lifts value sharply
    // By ovr 80 the premium has driven value up to the ceiling and it stays
    // there — no player's value ever exceeds MAX_TRANSFER_VALUE.
    expect(at78).toBeLessThanOrEqual(MAX_TRANSFER_VALUE);
    expect(at80).toBe(MAX_TRANSFER_VALUE);
    expect(at82).toBe(MAX_TRANSFER_VALUE);
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
