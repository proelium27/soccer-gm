import { describe, it, expect } from "vitest";
import { computeAcademyFormModifiers } from "../../src/core/players/academyForm.js";
import type { StandingsRow, SeasonHistoryEntry } from "../../src/core/standings.js";
import { ACADEMY_FORM_SEASONS, ACADEMY_FORM_SWING } from "../../src/core/constants.js";

function row(tid: number, points: number): StandingsRow {
  return { tid, played: 38, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points };
}

/** A sorted 4-team table: tids in finishing order, descending points. */
function table(tids: number[]): StandingsRow[] {
  return tids.map((tid, i) => row(tid, 100 - i));
}

function historyEntry(
  season: number,
  tables: Array<{ compId: number; tids: number[] }>,
): SeasonHistoryEntry {
  const compsByTid: Record<number, number> = {};
  for (const t of tables) for (const tid of t.tids) compsByTid[tid] = t.compId;
  return {
    season,
    table: tables.flatMap((t) => table(t.tids)),
    teamStats: [],
    awards: {},
    compsByTid,
    championTidByCompId: {},
  };
}

describe("computeAcademyFormModifiers", () => {
  it("gives the champion +SWING, bottom club -SWING, mid-table ~0, with no history", () => {
    const mods = computeAcademyFormModifiers([table([1, 2, 3, 4])], []);
    expect(mods.get(1)).toBeCloseTo(ACADEMY_FORM_SWING);
    expect(mods.get(4)).toBeCloseTo(-ACADEMY_FORM_SWING);
    // 4-team table: ranks 2 and 3 sit at ±1/3 of the swing.
    expect(mods.get(2)!).toBeCloseTo(ACADEMY_FORM_SWING / 3);
    expect(mods.get(3)!).toBeCloseTo(-ACADEMY_FORM_SWING / 3);
  });

  it("is zero-sum within a division each season", () => {
    const mods = computeAcademyFormModifiers(
      [table([1, 2, 3, 4]), table([5, 6, 7, 8])],
      [historyEntry(1, [
        { compId: 0, tids: [4, 3, 2, 1] },
        { compId: 1, tids: [8, 7, 6, 5] },
      ])],
    );
    let total = 0;
    for (const m of mods.values()) total += m;
    expect(total).toBeCloseTo(0);
  });

  it("averages across the window: consistent champion beats a one-season champion", () => {
    const history = [
      historyEntry(1, [{ compId: 0, tids: [1, 2, 3, 4] }]),
      historyEntry(2, [{ compId: 0, tids: [1, 2, 3, 4] }]),
    ];
    // Team 1 won all three seasons; team 2 finished 2nd, 2nd, then won.
    const sustained = computeAcademyFormModifiers([table([1, 2, 3, 4])], history);
    const oneOff = computeAcademyFormModifiers([table([2, 1, 3, 4])], history);
    expect(sustained.get(1)).toBeCloseTo(ACADEMY_FORM_SWING);
    expect(oneOff.get(2)!).toBeLessThan(ACADEMY_FORM_SWING);
    expect(oneOff.get(2)!).toBeGreaterThan(0);
  });

  it("only uses the most recent ACADEMY_FORM_SEASONS seasons", () => {
    // Ancient dominance beyond the window shouldn't count: team 1 won long
    // ago but finished bottom in every season inside the window.
    const ancient = Array.from({ length: 5 }, (_, i) =>
      historyEntry(i + 1, [{ compId: 0, tids: [1, 2, 3, 4] }]));
    const recent = Array.from({ length: ACADEMY_FORM_SEASONS - 1 }, (_, i) =>
      historyEntry(i + 6, [{ compId: 0, tids: [2, 3, 4, 1] }]));
    const mods = computeAcademyFormModifiers(
      [table([2, 3, 4, 1])],
      [...ancient, ...recent],
    );
    expect(mods.get(1)).toBeCloseTo(-ACADEMY_FORM_SWING);
  });

  it("scores a promoted club by its rank in the division it actually played in", () => {
    // Team 5 won Division 2 last season (history) and is mid-table D1 now.
    const mods = computeAcademyFormModifiers(
      [table([1, 5, 3, 4])],
      [historyEntry(1, [
        { compId: 0, tids: [1, 2, 3, 4] },
        { compId: 1, tids: [5, 6, 7, 8] },
      ])],
    );
    // Current: rank 2 of 4 (+1/3), history: D2 champion (+1) → mean × swing.
    expect(mods.get(5)!).toBeCloseTo(((1 / 3 + 1) / 2) * ACADEMY_FORM_SWING);
  });

  it("ignores single-team tables and unknown tids gracefully", () => {
    const mods = computeAcademyFormModifiers([table([1, 2]), [row(9, 50)]], []);
    expect(mods.get(9)).toBeUndefined();
    expect(mods.get(1)).toBeCloseTo(ACADEMY_FORM_SWING);
  });
});
