import { describe, it, expect } from "vitest";
import {
  rankLeaders,
  leaderValue,
  supportsPer90,
  type LeaderMode,
} from "../../src/ui/leadersBoard.js";
import { emptySeasonStats, type SeasonStats } from "../../src/core/players/types.js";
import { per90QualifyingMinutes } from "../../src/core/stats/per90.js";

interface Row {
  player: { pid: number };
  stats: SeasonStats;
}

function row(pid: number, fields: Partial<SeasonStats>): Row {
  return { player: { pid }, stats: { ...emptySeasonStats(2026), ...fields } };
}

/** A full 38-match season's worth of matches played. */
const FULL = 38;

describe("supportsPer90", () => {
  it("is false for stats that are already a rate or the denominator", () => {
    expect(supportsPer90("avgRating")).toBe(false);
    expect(supportsPer90("minutesPlayed")).toBe(false);
  });

  it("is true for counting stats", () => {
    expect(supportsPer90("goals")).toBe(true);
    expect(supportsPer90("saves")).toBe(true);
  });
});

describe("leaderValue", () => {
  it("returns the raw total in totals mode", () => {
    const stats = row(1, { goals: 14, minutesPlayed: 3400 }).stats;
    expect(leaderValue(stats, "goals", "totals")).toBe(14);
  });

  it("returns the rate in per-90 mode", () => {
    const stats = row(1, { goals: 10, minutesPlayed: 900 }).stats;
    expect(leaderValue(stats, "goals", "per90")).toBe(1);
  });

  it("leaves an average alone even in per-90 mode", () => {
    // Asking for "match rating per 90" is meaningless; the board keeps showing
    // the average rather than dividing it by anything.
    const stats = row(1, { avgRating: 7.4, minutesPlayed: 900 }).stats;
    expect(leaderValue(stats, "avgRating", "per90")).toBe(7.4);
  });

  it("is null in per-90 mode with no minutes recorded", () => {
    const stats = row(1, { goals: 2, minutesPlayed: 0 }).stats;
    expect(leaderValue(stats, "goals", "per90")).toBeNull();
  });
});

describe("rankLeaders in totals mode", () => {
  const rows = [
    row(1, { goals: 9, minutesPlayed: 800 }),
    row(2, { goals: 14, minutesPlayed: 3400 }),
    row(3, { goals: 11, minutesPlayed: 3000 }),
  ];

  it("ranks by the raw total", () => {
    const top = rankLeaders(rows, { stat: "goals", mode: "totals", matchesPlayed: FULL });
    expect(top.map((r) => r.player.pid)).toEqual([2, 3, 1]);
  });

  it("applies no minutes gate — a total is a total", () => {
    const cameo = row(4, { goals: 1, minutesPlayed: 12 });
    const top = rankLeaders([...rows, cameo], {
      stat: "goals", mode: "totals", matchesPlayed: FULL,
    });
    expect(top.map((r) => r.player.pid)).toContain(4);
  });
});

describe("rankLeaders in per-90 mode", () => {
  it("ranks by rate, so a squad player can outrank an ever-present", () => {
    const rows = [
      // 0.90 per 90 in about 12 full matches — clears the gate.
      row(1, { goals: 11, minutesPlayed: 1100 }),
      // 0.37 per 90 across a full season.
      row(2, { goals: 14, minutesPlayed: 3400 }),
    ];
    const top = rankLeaders(rows, { stat: "goals", mode: "per90", matchesPlayed: FULL });
    expect(top.map((r) => r.player.pid)).toEqual([1, 2]);
  });

  it("drops a player below the qualifying minutes floor", () => {
    const threshold = per90QualifyingMinutes(FULL);
    const cameo = row(1, { goals: 1, minutesPlayed: 12 });
    const regular = row(2, { goals: 14, minutesPlayed: 3400 });
    expect(cameo.stats.minutesPlayed).toBeLessThan(threshold);

    const top = rankLeaders([cameo, regular], {
      stat: "goals", mode: "per90", matchesPlayed: FULL,
    });
    expect(top.map((r) => r.player.pid)).toEqual([2]);
  });

  it("admits a player exactly on the floor", () => {
    const threshold = per90QualifyingMinutes(FULL);
    const onTheLine = row(1, { goals: 5, minutesPlayed: threshold });
    const top = rankLeaders([onTheLine], {
      stat: "goals", mode: "per90", matchesPlayed: FULL,
    });
    expect(top.map((r) => r.player.pid)).toEqual([1]);
  });

  it("gates on minutes, not appearances — twenty cameos still do not qualify", () => {
    // The distinction the minutes floor exists for: an appearance-based gate
    // would wave this player through on 20 games of garbage time.
    const superSub = row(1, { appearances: 20, goals: 4, minutesPlayed: 200 });
    const top = rankLeaders([superSub], {
      stat: "goals", mode: "per90", matchesPlayed: FULL,
    });
    expect(top).toEqual([]);
  });

  it("keeps the Match Rating appearance gate when that stat is selected", () => {
    // avgRating has its own, stricter qualifier and no per-90 meaning; per-90
    // mode must not quietly replace it with the looser minutes floor.
    const oneHotGame = row(1, { appearances: 1, avgRating: 9.5, minutesPlayed: 90 });
    const regular = row(2, { appearances: 30, avgRating: 7.1, minutesPlayed: 2700 });
    for (const mode of ["totals", "per90"] as LeaderMode[]) {
      const top = rankLeaders([oneHotGame, regular], {
        stat: "avgRating", mode, matchesPlayed: FULL,
      });
      expect(top.map((r) => r.player.pid)).toEqual([2]);
    }
  });

  it("scales the floor to the season's progress", () => {
    // Ten matches in, 300 minutes is a regular starter and must qualify, even
    // though it would fall far short of the full-season floor.
    const starter = row(1, { goals: 4, minutesPlayed: 300 });
    expect(starter.stats.minutesPlayed).toBeLessThan(per90QualifyingMinutes(FULL));

    const early = rankLeaders([starter], { stat: "goals", mode: "per90", matchesPlayed: 10 });
    expect(early.map((r) => r.player.pid)).toEqual([1]);

    const late = rankLeaders([starter], { stat: "goals", mode: "per90", matchesPlayed: FULL });
    expect(late).toEqual([]);
  });

  it("breaks ties by pid so the order is stable", () => {
    // Same rate (1.00 per 90), both clear of the floor.
    const rows = [
      row(7, { goals: 20, minutesPlayed: 1800 }),
      row(3, { goals: 40, minutesPlayed: 3600 }),
    ];
    const top = rankLeaders(rows, { stat: "goals", mode: "per90", matchesPlayed: FULL });
    expect(top.map((r) => r.player.pid)).toEqual([3, 7]);
  });

  it("honours the row limit", () => {
    const rows = Array.from({ length: 50 }, (_, i) =>
      row(i, { goals: i, minutesPlayed: 3400 }),
    );
    expect(rankLeaders(rows, {
      stat: "goals", mode: "per90", matchesPlayed: FULL, limit: 30,
    })).toHaveLength(30);
  });

  it("does not mutate the rows it is given", () => {
    const rows = [
      row(1, { goals: 5, minutesPlayed: 3400 }),
      row(2, { goals: 9, minutesPlayed: 3400 }),
    ];
    const before = rows.map((r) => r.player.pid);
    rankLeaders(rows, { stat: "goals", mode: "per90", matchesPlayed: FULL });
    expect(rows.map((r) => r.player.pid)).toEqual(before);
  });
});
