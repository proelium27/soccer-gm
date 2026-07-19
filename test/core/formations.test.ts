import { describe, it, expect } from "vitest";
import {
  FORMATIONS,
  FORMATION_IDS,
  teamFormation,
  teamSlots,
  chooseBestFormation,
} from "../../src/core/lineup/formations.js";
import { selectXI } from "../../src/core/lineup/selectXI.js";
import type { Player, Position } from "../../src/core/players/types.js";

let pidSeq = 0;
const mk = (pos: Position, ovr: number): Player =>
  ({ pid: pidSeq++, pos, ovr } as unknown as Player);

describe("formations", () => {
  it("defines every shape with 11 slots and exactly one GK, and no duplicate ids", () => {
    expect(FORMATION_IDS).toEqual([
      "4-3-3", "4-4-2", "3-5-2", "5-3-2",
      "4-2-3-1", "4-5-1", "3-4-3", "5-4-1", "4-3-1-2",
    ]);
    expect(new Set(FORMATION_IDS).size).toBe(FORMATION_IDS.length);
    for (const id of FORMATION_IDS) {
      const slots = FORMATIONS[id];
      expect(slots).toHaveLength(11);
      expect(slots.filter((p) => p === "GK")).toHaveLength(1);
    }
  });

  it("teamFormation defaults to 4-3-3 and teamSlots returns its slot array", () => {
    expect(teamFormation({})).toBe("4-3-3");
    expect(teamFormation({ formation: null })).toBe("4-3-3");
    expect(teamFormation({ formation: "4-4-2" })).toBe("4-4-2");
    expect(teamSlots({ formation: "3-5-2" })).toEqual(FORMATIONS["3-5-2"]);
  });

  it("actually changes who is fielded: 4-4-2 starts two strikers where 4-3-3 starts one", () => {
    // A roster deep enough at every position that fit is never forced.
    let pid = 0;
    const make = (pos: Position, ovr: number): Player =>
      ({ pid: pid++, pos, ovr } as unknown as Player);
    const roster: Player[] = [
      make("GK", 70),
      ...Array.from({ length: 4 }, () => make("CB", 68)),
      ...Array.from({ length: 4 }, () => make("FB", 66)),
      ...Array.from({ length: 4 }, () => make("CM", 67)),
      ...Array.from({ length: 4 }, () => make("W", 69)),
      ...Array.from({ length: 4 }, () => make("ST", 71)),
    ];

    const countST = (slots: Position[]) =>
      selectXI(roster, slots).filter((p) => p.pos === "ST").length;

    expect(countST(FORMATIONS["4-3-3"])).toBe(1);
    expect(countST(FORMATIONS["4-4-2"])).toBe(2);
  });

  describe("chooseBestFormation", () => {
    it("picks a shape that fields the roster's surplus strength — extra elite strikers get started", () => {
      // Strong strikers beyond what a one-forward shape can use, thin wings.
      const roster: Player[] = [
        mk("GK", 65),
        ...Array.from({ length: 4 }, () => mk("CB", 62)),
        ...Array.from({ length: 4 }, () => mk("FB", 60)),
        ...Array.from({ length: 4 }, () => mk("CM", 61)),
        mk("W", 55),
        ...Array.from({ length: 4 }, () => mk("ST", 88)), // four excellent strikers
      ];
      const best = chooseBestFormation(roster);
      // The winning shape must actually start more than one striker to use them.
      const startedST = selectXI(roster, FORMATIONS[best]).filter((p) => p.pos === "ST").length;
      expect(startedST).toBeGreaterThanOrEqual(2);
    });

    it("returns a valid formation id and is deterministic", () => {
      const roster: Player[] = [
        mk("GK", 60),
        ...Array.from({ length: 8 }, () => mk("CM", 60)),
        ...Array.from({ length: 8 }, () => mk("ST", 60)),
      ];
      const a = chooseBestFormation(roster);
      const b = chooseBestFormation(roster);
      expect(FORMATION_IDS).toContain(a);
      expect(a).toBe(b);
    });

    it("ties to 4-3-3 when the roster is exactly eleven (every shape fields the same set)", () => {
      const roster: Player[] = [
        mk("GK", 60), mk("CB", 60), mk("CB", 60), mk("FB", 60), mk("FB", 60),
        mk("CM", 60), mk("CM", 60), mk("CM", 60), mk("W", 60), mk("W", 60), mk("ST", 60),
      ];
      expect(chooseBestFormation(roster)).toBe("4-3-3");
    });
  });
});
