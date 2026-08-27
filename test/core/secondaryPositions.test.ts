import { describe, it, expect } from "vitest";
import { makeLeague } from "../helpers/league.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { generatePlayer } from "../../src/core/players/generate.js";
import {
  deriveSecondaries,
  positionRatings,
  positionLabel,
  secondaryPositions,
  ovrAtSlot,
  slotValue,
} from "../../src/core/players/positions.js";
import { ADJACENCY, COVERABLE, familiarityPenalty, fitTier } from "../../src/engine/positionFit.js";
import { selectXI } from "../../src/core/lineup/selectXI.js";
import { POSITIONS, type Player, type Position } from "../../src/core/players/types.js";
import {
  MAX_SECONDARY_POSITIONS,
  SECONDARY_POSITION_CUTOFF,
} from "../../src/core/constants.js";
import {
  POSITION_ADJACENT_PENALTY,
  POSITION_KEEPER_PENALTY,
} from "../../src/engine/constants.js";

describe("COVERABLE", () => {
  // The direction is genuinely easy to get backwards, and getting it backwards
  // is silent: the table is symmetric for most pairs, so a reversed lookup
  // still looks right until you hit one of the few that aren't.
  it("is exactly the reverse of ADJACENCY", () => {
    for (const pos of POSITIONS) {
      for (const slot of POSITIONS) {
        expect(COVERABLE[pos].includes(slot)).toBe(ADJACENCY[slot].includes(pos));
      }
    }
  });

  it("differs from ADJACENCY where the table is asymmetric", () => {
    // A defensive mid can cover at full-back; a full-back cannot cover in
    // defensive midfield. If this ever passes trivially the reverse map has
    // stopped being load-bearing and the test above is all that's left.
    expect(COVERABLE.DM).toContain("FB");
    expect(COVERABLE.FB).not.toContain("DM");
    expect(COVERABLE.ST).not.toContain("AM");
  });

  it("leaves keepers isolated in both directions", () => {
    expect(COVERABLE.GK).toEqual([]);
    for (const pos of POSITIONS) expect(COVERABLE[pos]).not.toContain("GK");
  });
});

describe("deriveSecondaries", () => {
  const rng = mulberry32(7);
  let pid = 1;
  const players: Player[] = Array.from({ length: 400 }, () =>
    generatePlayer(rng, POSITIONS[Math.floor(rng() * POSITIONS.length)], 55, pid++, 25, 1),
  );

  it("only ever returns positions the player could cover", () => {
    for (const p of players) {
      for (const s of secondaryPositions(p)) expect(COVERABLE[p.pos]).toContain(s);
    }
  });

  it("never exceeds the cap and never repeats", () => {
    for (const p of players) {
      const sec = secondaryPositions(p);
      expect(sec.length).toBeLessThanOrEqual(MAX_SECONDARY_POSITIONS);
      expect(new Set(sec).size).toBe(sec.length);
      expect(sec).not.toContain(p.pos);
    }
  });

  it("never makes anyone a keeper, and never makes a keeper anything else", () => {
    for (const p of players) {
      expect(secondaryPositions(p)).not.toContain("GK");
      if (p.pos === "GK") expect(secondaryPositions(p)).toEqual([]);
    }
  });

  it("is a pure function of the player — same input, same answer", () => {
    for (const p of players.slice(0, 50)) {
      expect(deriveSecondaries(p)).toEqual(deriveSecondaries(p));
    }
  });

  it("has a cutoff entry for every coverable pair, and none for any other", () => {
    for (const pos of POSITIONS) {
      expect(Object.keys(SECONDARY_POSITION_CUTOFF[pos]).sort()).toEqual(
        [...COVERABLE[pos]].sort(),
      );
    }
  });
});

describe("secondary positions and the familiarity penalty", () => {
  it("waives the penalty for a position he genuinely plays", () => {
    // A centre-back who also plays full-back pays nothing at full-back, where
    // one who doesn't pays the adjacent penalty.
    expect(familiarityPenalty("FB", "CB", ["FB"])).toBe(0);
    expect(familiarityPenalty("FB", "CB", [])).toBe(POSITION_ADJACENT_PENALTY);
    expect(fitTier("FB", "CB", ["FB"])).toBe(0);
  });

  it("does not waive the keeper penalty even if handed GK as a secondary", () => {
    // Unreachable through the derivation (keepers have no COVERABLE entry), so
    // this pins the defence-in-depth ordering inside familiarityPenalty rather
    // than a reachable case: a bad table must never open the goal.
    expect(familiarityPenalty("GK", "CB", ["GK"])).toBe(POSITION_KEEPER_PENALTY);
    expect(familiarityPenalty("ST", "GK", ["ST"])).toBe(POSITION_KEEPER_PENALTY);
  });

  it("leaves a foreign position foreign", () => {
    // A secondary can only ever waive a slot he can cover. Nothing in the
    // derivation can hand out a free run at an unrelated position.
    expect(fitTier("ST", "CB", [])).toBe(2);
    expect(COVERABLE.CB).not.toContain("ST");
  });
});

describe("positionRatings", () => {
  const rng = mulberry32(11);
  const p = generatePlayer(rng, "CM", 55, 1, 25, 1);

  it("covers his own position plus everywhere he could cover, and nothing else", () => {
    const rows = positionRatings(p);
    expect(new Set(rows.map((r) => r.pos))).toEqual(new Set([p.pos, ...COVERABLE[p.pos]]));
  });

  it("reports his listed position at his actual ovr", () => {
    const primary = positionRatings(p).find((r) => r.primary)!;
    expect(primary.pos).toBe(p.pos);
    expect(primary.ovr).toBe(p.ovr);
  });

  it("is sorted best first", () => {
    const ovrs = positionRatings(p).map((r) => r.ovr);
    expect([...ovrs].sort((a, b) => b - a)).toEqual(ovrs);
  });

  it("marks exactly the derived secondaries, so the strip and the badge agree", () => {
    const rng2 = mulberry32(23);
    for (let i = 0; i < 100; i++) {
      const q = generatePlayer(rng2, POSITIONS[i % POSITIONS.length], 55, i + 1, 25, 1);
      const marked = positionRatings(q).filter((r) => r.secondary).map((r) => r.pos);
      expect(new Set(marked)).toEqual(new Set(secondaryPositions(q)));
      // The label is the same fact in text form.
      const label = positionLabel(q);
      expect(label.startsWith(q.pos)).toBe(true);
      for (const s of secondaryPositions(q)) expect(label).toContain(s);
    }
  });
});

describe("selection", () => {
  it("prefers a better player who genuinely plays the slot over a weaker specialist", () => {
    // The behaviour change this feature exists for: before, fit was strictly by
    // listed position, so a specialist always won his own slot no matter how
    // much better the versatile candidate was.
    const league = makeLeague(0, 1);
    // A real winger from the world who genuinely doubles at full-back, and a
    // real full-back who is clearly worse. Searched rather than constructed, so
    // the test also proves the derivation produces usable cases at all.
    const versatile = league.players.find(
      (p) => p.pos === "W" && secondaryPositions(p).includes("FB"),
    );
    expect(versatile, "no winger in the world doubles at full-back").toBeDefined();

    const specialist = league.players.find(
      (p) => p.pos === "FB" && p.ovr < versatile!.ovr - 5 && secondaryPositions(p).length === 0,
    );
    expect(specialist, "no clearly weaker specialist full-back to compare against").toBeDefined();

    const picked = selectXI([versatile!, specialist!], ["FB"])[0];
    expect(picked.pid).toBe(versatile!.pid);

    // What a secondary position is actually worth: exactly the familiarity
    // penalty, no more. The versatile winger plays full-back at his own
    // full-back rating; a winger who does not double there is docked for it.
    const rigid = league.players.find(
      (p) => p.pos === "W" && !secondaryPositions(p).includes("FB") && p.ovr > specialist!.ovr + 5,
    );
    expect(rigid).toBeDefined();
    expect(slotValue(versatile!, "FB")).toBe(ovrAtSlot(versatile!, "FB"));
    expect(slotValue(rigid!, "FB")).toBe(ovrAtSlot(rigid!, "FB") - POSITION_ADJACENT_PENALTY);

    // So the penalty decides the slot rather than the position label doing it:
    // a specialist good enough to beat the stand-in's *full-back* value keeps
    // his place, where the weaker one above does not. (Selection used to go
    // strictly by listed position, which handed the slot to any natural
    // full-back however far behind he was — that is how a first-division club
    // came to start a 39-rated full-back with a 67-rated midfielder benched.)
    const bar = slotValue(rigid!, "FB");
    const betterSpecialist = league.players.find(
      (p) => p.pos === "FB" && secondaryPositions(p).length === 0 && p.ovr > bar,
    );
    expect(betterSpecialist, "no specialist full-back rated above the stand-in").toBeDefined();
    expect(selectXI([rigid!, betterSpecialist!], ["FB"])[0].pid).toBe(betterSpecialist!.pid);
    expect(selectXI([rigid!, specialist!], ["FB"])[0].pid).toBe(rigid!.pid);
  });

  it("still fills every slot", () => {
    const rng = mulberry32(5);
    const roster = Array.from({ length: 20 }, (_, i) =>
      generatePlayer(rng, POSITIONS[i % POSITIONS.length], 55, i + 1, 25, 1),
    );
    const slots: Position[] = ["GK", "CB", "CB", "FB", "FB", "DM", "CM", "CM", "W", "W", "ST"];
    expect(selectXI(roster, slots)).toHaveLength(11);
  });
});

describe("world-wide rate", () => {
  // The calibration guard. SECONDARY_POSITION_CUTOFF is a measured table, so a
  // change to the OVR weights, the adjacency table or the cutoffs themselves
  // can silently turn every player into a utility man (or nobody into one)
  // without breaking anything else. Bands are wide enough to survive ordinary
  // drift and narrow enough to catch that.
  it("keeps versatility a minority trait across a generated world", () => {
    const league = makeLeague(0, 1);
    const players = league.players;
    const withSecondary = players.filter((p) => secondaryPositions(p).length > 0).length;
    const share = withSecondary / players.length;
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.5);

    const threePos = players.filter((p) => secondaryPositions(p).length === 2).length / players.length;
    expect(threePos).toBeLessThan(0.15);

    // No position may be wholly versatile or wholly specialist — that was the
    // failure mode of an absolute ovr gap, which made every midfielder a
    // three-position player and no striker a two-position one.
    for (const pos of POSITIONS) {
      if (pos === "GK") continue;
      const group = players.filter((p) => p.pos === pos);
      const rate = group.filter((p) => secondaryPositions(p).length > 0).length / group.length;
      expect(rate, `${pos} versatility rate`).toBeGreaterThan(0.02);
      expect(rate, `${pos} versatility rate`).toBeLessThan(0.85);
    }
  });

  it("never gives a keeper a second position anywhere in the world", () => {
    const league = makeLeague(0, 1);
    for (const p of league.players) {
      if (p.pos === "GK") expect(secondaryPositions(p)).toEqual([]);
      expect(secondaryPositions(p)).not.toContain("GK");
    }
  });
});
