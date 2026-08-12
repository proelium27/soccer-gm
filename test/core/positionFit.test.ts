import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { generatePlayer } from "../../src/core/players/generate.js";
import { rollupComposites, withSlots } from "../../src/core/composites.js";
import { familiarityPenalty, fitTier } from "../../src/engine/positionFit.js";
import { FORMATIONS } from "../../src/core/lineup/formations.js";
import { POSITIONS, type Position, type Player } from "../../src/core/players/types.js";
import {
  POSITION_ADJACENT_PENALTY,
  POSITION_FOREIGN_PENALTY,
  POSITION_KEEPER_PENALTY,
} from "../../src/engine/constants.js";

describe("familiarityPenalty", () => {
  it("costs nothing to play your own position", () => {
    for (const pos of POSITIONS) expect(familiarityPenalty(pos, pos)).toBe(0);
  });

  it("costs less to cover an adjacent position than a foreign one", () => {
    expect(familiarityPenalty("CB", "DM")).toBe(POSITION_ADJACENT_PENALTY);
    expect(familiarityPenalty("CB", "ST")).toBe(POSITION_FOREIGN_PENALTY);
    expect(POSITION_ADJACENT_PENALTY).toBeLessThan(POSITION_FOREIGN_PENALTY);
  });

  it("treats the keeper boundary as its own, larger problem in both directions", () => {
    expect(familiarityPenalty("GK", "ST")).toBe(POSITION_KEEPER_PENALTY);
    expect(familiarityPenalty("ST", "GK")).toBe(POSITION_KEEPER_PENALTY);
    expect(POSITION_KEEPER_PENALTY).toBeGreaterThan(POSITION_FOREIGN_PENALTY);
  });

  it("agrees with fitTier's three tiers", () => {
    expect(fitTier("CB", "CB")).toBe(0);
    expect(fitTier("CB", "DM")).toBe(1);
    expect(fitTier("CB", "ST")).toBe(2);
  });
});

/** A full squad with `count` players at every position, all from one seed. */
function squad(seed: number, base = 60): Map<Position, Player[]> {
  const rng = mulberry32(seed);
  const byPos = new Map<Position, Player[]>();
  let pid = 0;
  for (const pos of POSITIONS) {
    byPos.set(pos, Array.from({ length: 4 }, () => generatePlayer(rng, pos, base, pid++, 25, 1)));
  }
  return byPos;
}

/** An XI in 4-3-3 order, optionally swapping one slot's occupant for another player. */
function xi433(byPos: Map<Position, Player[]>, swapSlotIndex?: number, replacement?: Player): Player[] {
  const slots = FORMATIONS["4-3-3"];
  const taken = new Map<Position, number>();
  const players = slots.map((slot) => {
    const i = taken.get(slot) ?? 0;
    taken.set(slot, i + 1);
    return byPos.get(slot)![i];
  });
  if (swapSlotIndex !== undefined && replacement) players[swapSlotIndex] = replacement;
  return players;
}

describe("slot-aware composite rollup", () => {
  const slots = FORMATIONS["4-3-3"];
  const stIndex = slots.indexOf("ST");
  const cbIndex = slots.indexOf("CB");

  it("a centre-back played at striker weakens attack AND no longer strengthens defense", () => {
    const byPos = squad(7);
    const baseline = rollupComposites(withSlots(xi433(byPos), slots), "Baseline");

    // Swap the striker out for a spare centre-back, who now occupies the ST slot.
    const spareCb = byPos.get("CB")![3];
    const shifted = rollupComposites(withSlots(xi433(byPos, stIndex, spareCb), slots), "Shifted");

    expect(shifted.attack).toBeLessThan(baseline.attack);
    // The regression this feature exists to kill: before slot-awareness, moving a
    // defender up the pitch *raised* the defense composite, because the rollup
    // bucketed him by what he is rather than where he stands.
    expect(shifted.defense).toBeLessThanOrEqual(baseline.defense);
  });

  it("a striker played at centre-back weakens defense", () => {
    const byPos = squad(11);
    const baseline = rollupComposites(withSlots(xi433(byPos), slots), "Baseline");
    const spareSt = byPos.get("ST")![3];
    const shifted = rollupComposites(withSlots(xi433(byPos, cbIndex, spareSt), slots), "Shifted");

    expect(shifted.defense).toBeLessThan(baseline.defense);
  });

  it("an adjacent cover player costs less than a foreign one in the same slot", () => {
    const byPos = squad(3);
    const baseline = rollupComposites(withSlots(xi433(byPos), slots), "Baseline");
    // DM is adjacent to CB; ST is foreign to it. Both replace the same starter.
    const adjacent = rollupComposites(
      withSlots(xi433(byPos, cbIndex, byPos.get("DM")![3]), slots),
      "Adjacent",
    );
    const foreign = rollupComposites(
      withSlots(xi433(byPos, cbIndex, byPos.get("ST")![3]), slots),
      "Foreign",
    );

    expect(adjacent.defense).toBeLessThan(baseline.defense);
    expect(foreign.defense).toBeLessThan(adjacent.defense);
  });

  it("an outfielder pressed into goal craters the keeping composite", () => {
    const byPos = squad(5);
    const gkIndex = slots.indexOf("GK");
    const baseline = rollupComposites(withSlots(xi433(byPos), slots), "Baseline");
    const emergency = rollupComposites(
      withSlots(xi433(byPos, gkIndex, byPos.get("CB")![3]), slots),
      "Emergency",
    );

    expect(emergency.keeping).toBeLessThan(baseline.keeping);
    // Previously this case left `keeping` at its neutral default while the
    // outfielder still counted as a defender — a silent, free non-keeper.
    expect(emergency.keeping).toBeLessThan(0.5);
  });

  it("is unchanged when everyone plays his own position", () => {
    const byPos = squad(9);
    const a = rollupComposites(withSlots(xi433(byPos), slots), "T");
    const b = rollupComposites(withSlots(xi433(byPos), slots), "T");
    expect(a).toEqual(b);
    // No player is out of position, so no penalty is in play at all.
    for (const [i, p] of xi433(byPos).entries()) {
      expect(familiarityPenalty(slots[i], p.pos)).toBe(0);
    }
  });
});
