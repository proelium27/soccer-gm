import { describe, it, expect } from "vitest";
import {
  FORMATIONS,
  FORMATION_IDS,
  teamFormation,
  teamSlots,
} from "../../src/core/lineup/formations.js";
import { selectXI } from "../../src/core/lineup/selectXI.js";
import type { Player, Position } from "../../src/core/players/types.js";

describe("formations", () => {
  it("defines the four shapes, each with 11 slots and exactly one GK", () => {
    expect(FORMATION_IDS).toEqual(["4-3-3", "4-4-2", "3-5-2", "5-3-2"]);
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
});
