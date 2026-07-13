import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../../src/engine/rng.js";
import { createLeagueState } from "../../../src/core/leagueState.js";
import type { Player, Position } from "../../../src/core/players/types.js";
import { POSITIONS } from "../../../src/core/players/types.js";
import type { ClubContext, StrategicDirection } from "../../../src/core/ai/clubContext.js";
import {
  evaluatePlayerForClub, valueToClub, scoutNoiseFraction, perceivedValueToClub,
} from "../../../src/core/ai/evaluate.js";
import {
  ROSTER_COMPOSITION, AI_NEED_MIN, AI_NEED_MAX,
  AI_SCOUT_NOISE_MIN, AI_SCOUT_NOISE_MAX,
} from "../../../src/core/constants.js";

const SEASON = 10;

/** A real generated player we can override fields on (so every field is valid). */
function samplePlayer(overrides: Partial<Player> = {}): Player {
  const league = createLeagueState(0, mulberry32(1));
  const base = league.players[0];
  return {
    ...base,
    pos: "ST",
    born: SEASON - 26, // age 26 by default
    ovr: 70,
    potential: 70,
    contract: { salary: 5_000_000, expiresSeason: SEASON + 3 },
    ...overrides,
  };
}

function ctx(overrides: Partial<ClubContext> = {}): ClubContext {
  const posDepth = { ...ROSTER_COMPOSITION } as Record<Position, number>;
  const posBestOvr = Object.fromEntries(POSITIONS.map((p) => [p, 65])) as Record<Position, number>;
  return {
    tid: 0,
    season: SEASON,
    budget: 80_000_000,
    squadStrength: 65,
    squadAvgAge: 26,
    posDepth,
    posBestOvr,
    ambition: 0.5,
    frugality: 0.5,
    direction: "Midtable Stability" as StrategicDirection,
    ...overrides,
  };
}

describe("evaluatePlayerForClub", () => {
  it("returns a breakdown whose value is the product of base and multipliers", () => {
    const v = evaluatePlayerForClub(samplePlayer(), ctx());
    expect(v.value).toBeCloseTo(v.base * v.needMult * v.timelineMult * v.affordabilityMult, 3);
    expect(v.value).toBeGreaterThan(0);
  });

  it("keeps the need multiplier within its clamp regardless of extremes", () => {
    // An empty position, huge upgrade → clamped at the max.
    const emptyStacked = ctx({
      posDepth: { ...ROSTER_COMPOSITION, ST: 0 } as Record<Position, number>,
      posBestOvr: Object.fromEntries(POSITIONS.map((p) => [p, 0])) as Record<Position, number>,
    });
    const hi = evaluatePlayerForClub(samplePlayer({ ovr: 95 }), emptyStacked);
    expect(hi.needMult).toBeLessThanOrEqual(AI_NEED_MAX + 1e-9);
    expect(hi.needMult).toBeGreaterThanOrEqual(AI_NEED_MIN - 1e-9);

    // A hopelessly stacked position with a far superior incumbent → clamped at the min.
    const overStacked = ctx({
      posDepth: { ...ROSTER_COMPOSITION, ST: 12 } as Record<Position, number>,
      posBestOvr: Object.fromEntries(POSITIONS.map((p) => [p, 90])) as Record<Position, number>,
    });
    const lo = evaluatePlayerForClub(samplePlayer({ ovr: 55 }), overStacked);
    expect(lo.needMult).toBeGreaterThanOrEqual(AI_NEED_MIN - 1e-9);
    expect(lo.needMult).toBeLessThanOrEqual(AI_NEED_MAX + 1e-9);
  });
});

describe("positional need", () => {
  const player = samplePlayer({ pos: "GK", ovr: 72 });

  it("values a player more when the club is thin at his position", () => {
    const thin = ctx({
      posDepth: { ...ROSTER_COMPOSITION, GK: 1 } as Record<Position, number>,
      posBestOvr: { ...ctx().posBestOvr, GK: 60 },
    });
    const stacked = ctx({
      posDepth: { ...ROSTER_COMPOSITION, GK: 5 } as Record<Position, number>,
      posBestOvr: { ...ctx().posBestOvr, GK: 80 },
    });
    expect(valueToClub(player, thin)).toBeGreaterThan(valueToClub(player, stacked));
  });
});

describe("timeline fit (age × ambition)", () => {
  it("a developer club values a young prospect more than a win-now club does", () => {
    const prospect = samplePlayer({ born: SEASON - 19, ovr: 70, potential: 85 });
    const developer = ctx({ ambition: 0.1 });
    const contender = ctx({ ambition: 0.9 });
    expect(valueToClub(prospect, developer)).toBeGreaterThan(valueToClub(prospect, contender));
  });

  it("a win-now club values a prime-age player more than a developer club does", () => {
    const prime = samplePlayer({ born: SEASON - 26, ovr: 78 });
    const developer = ctx({ ambition: 0.1 });
    const contender = ctx({ ambition: 0.9 });
    expect(valueToClub(prime, contender)).toBeGreaterThan(valueToClub(prime, developer));
  });
});

describe("scoutNoiseFraction / perceivedValueToClub", () => {
  it("gives the wealthiest club (frugality 0) the minimum noise and the poorest (frugality 1) the max", () => {
    expect(scoutNoiseFraction(ctx({ frugality: 0 }))).toBeCloseTo(AI_SCOUT_NOISE_MIN, 6);
    expect(scoutNoiseFraction(ctx({ frugality: 1 }))).toBeCloseTo(AI_SCOUT_NOISE_MAX, 6);
  });

  it("stays within scoutNoiseFraction of the true valueToClub for any jitter draw", () => {
    const player = samplePlayer();
    const c = ctx({ frugality: 0.7 });
    const trueValue = valueToClub(player, c);
    const noise = scoutNoiseFraction(c);
    for (const draw of [0, 0.25, 0.5, 0.75, 1]) {
      const perceived = perceivedValueToClub(player, c, () => draw);
      expect(perceived).toBeGreaterThanOrEqual(trueValue * (1 - noise) - 1e-6);
      expect(perceived).toBeLessThanOrEqual(trueValue * (1 + noise) + 1e-6);
    }
  });

  it("a poorer (more frugal) club's perceived value swings further from true value than a wealthy club's", () => {
    const player = samplePlayer();
    const rich = ctx({ frugality: 0 });
    const poor = ctx({ frugality: 1 });
    const richSwing = Math.abs(perceivedValueToClub(player, rich, () => 1) - valueToClub(player, rich));
    const poorSwing = Math.abs(perceivedValueToClub(player, poor, () => 1) - valueToClub(player, poor));
    expect(poorSwing).toBeGreaterThan(richSwing);
  });
});

describe("affordability", () => {
  it("penalizes an expensive deal more for a poor, frugal club than a rich one", () => {
    const star = samplePlayer({ ovr: 88, potential: 88, contract: { salary: 12_000_000, expiresSeason: SEASON + 3 } });
    const rich = ctx({ budget: 400_000_000, frugality: 0 });
    const poor = ctx({ budget: 15_000_000, frugality: 1 });
    const richMult = evaluatePlayerForClub(star, rich).affordabilityMult;
    const poorMult = evaluatePlayerForClub(star, poor).affordabilityMult;
    expect(richMult).toBeGreaterThan(poorMult);
    expect(richMult).toBeLessThanOrEqual(1);
    expect(poorMult).toBeLessThan(1);
  });
});
