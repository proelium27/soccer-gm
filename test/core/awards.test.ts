import { describe, it, expect } from "vitest";
import {
  computeSeasonAwards, positionGroup, potyScore, TOTS_SLOTS,
} from "../../src/core/awards.js";
import { emptySeasonStats, type Player, type Position } from "../../src/core/players/types.js";

const SEASON = 5;

interface PlayerSpec {
  pid: number;
  pos: Position;
  ovr?: number;
  goals?: number;
  assists?: number;
  avgRating?: number;
}

function player(spec: PlayerSpec): Player {
  const ovr = spec.ovr ?? 75;
  const appearances = 30;
  const stats = {
    ...emptySeasonStats(SEASON, 1),
    appearances,
    goals: spec.goals ?? 0,
    assists: spec.assists ?? 0,
    avgRating: spec.avgRating ?? 6.5,
    minutesPlayed: appearances * 90,
  };
  return {
    pid: spec.pid,
    name: `Player ${spec.pid}`,
    nationality: "England",
    born: SEASON - 26,
    pos: spec.pos,
    ovr,
    stats: [stats],
    // ovrDuringSeason reads the hist entry tagged `season - 1`.
    hist: [{ season: SEASON - 1, ovr, potential: ovr, academy: false, ratings: {} }],
  } as unknown as Player;
}

describe("award position groups", () => {
  it("scores an attacking midfielder as a forward, not a midfielder", () => {
    expect(positionGroup("AM")).toBe("FWD");
    expect(positionGroup("W")).toBe("FWD");
    expect(positionGroup("ST")).toBe("FWD");
  });

  it("still scores central and defensive midfielders as midfielders", () => {
    expect(positionGroup("CM")).toBe("MID");
    expect(positionGroup("DM")).toBe("MID");
  });

  it("gives an AM and a W with the same season the same end-product credit", () => {
    const am = player({ pid: 1, pos: "AM", goals: 12, assists: 10 });
    const w = player({ pid: 2, pos: "W", goals: 12, assists: 10 });
    expect(potyScore(am, am.stats[0], SEASON)).toBeCloseTo(potyScore(w, w.stats[0], SEASON), 10);
  });

  it("lets a winger with more goals beat an otherwise identical AM", () => {
    // Grouped as a midfielder the AM was paid 0.10/goal and 0.07/assist against
    // the winger's 0.08/0.05 — a 25%/40% premium for the same job — so he took
    // Player of the Season here (8.70 to 8.34) despite scoring one goal fewer.
    const am = player({ pid: 1, pos: "AM", goals: 12, assists: 10, avgRating: 6.8 });
    const winger = player({ pid: 2, pos: "W", goals: 13, assists: 10, avgRating: 6.8 });

    expect(computeSeasonAwards([am, winger], SEASON).playerOfSeasonPid).toBe(2);
  });

  it("keeps a defender's goals worth more than an attacker's", () => {
    // The groups exist to price end product by how hard it is to come by;
    // moving AM must not flatten that.
    const cb = player({ pid: 1, pos: "CB", goals: 10 });
    const st = player({ pid: 2, pos: "ST", goals: 10 });
    expect(potyScore(cb, cb.stats[0], SEASON)).toBeGreaterThan(potyScore(st, st.stats[0], SEASON));
  });
});

describe("Team of the Season slots", () => {
  it("gives the attacking midfielder a slot", () => {
    // Without one an AM is structurally ineligible: he can win Player of the
    // Season and never appear in the XI. Measured before this slot existed,
    // every AM who won it missed out — 14 of 14 over 6 seasons x 2 seeds.
    expect(TOTS_SLOTS).toContain("AM");
  });

  it("is eleven slots in a 4-3-3 shape", () => {
    // Still a real formation, so it reads correctly on the pitch view: one
    // keeper, a back four, a midfield three, a front three.
    expect(TOTS_SLOTS).toHaveLength(11);
    const count = (...of: Position[]) => TOTS_SLOTS.filter((p) => of.includes(p)).length;
    expect(count("GK")).toBe(1);
    expect(count("CB", "FB")).toBe(4);
    expect(count("DM", "CM", "AM")).toBe(3);
    expect(count("W", "ST")).toBe(3);
  });

  it("actually picks an attacking midfielder into the XI", () => {
    const am = player({ pid: 1, pos: "AM", goals: 15, assists: 12 });
    expect(computeSeasonAwards([am], SEASON).teamOfSeason).toContain(1);
  });
});
