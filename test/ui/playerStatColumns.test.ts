import { describe, expect, it } from "vitest";
import {
  cupStatColumns, leagueStatColumns, statCellText, statColumnScope, statHeader, sumStatRows,
  type StatColumn, type StatRow,
} from "../../src/ui/playerStatColumns.js";

/**
 * The column definitions behind the Player Profile's season-stats tables.
 *
 * Worth unit-testing rather than leaving to the render tests because the whole
 * point of the shared definition is that a season row and the career row under
 * it are computed the same way — and the ways that can go wrong (a ratio
 * averaged instead of re-derived, an absent cup field summing to a confident
 * zero) are silent in markup and look perfectly plausible on screen.
 */

function row(over: Partial<StatRow> = {}): StatRow {
  return {
    appearances: 0, minutesPlayed: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0,
    saves: 0, goalsAgainst: 0, tackles: 0, interceptions: 0, ratingSum: 0, ...over,
  };
}

const outfield = leagueStatColumns({ keeper: false, attack: true });
const keeper = leagueStatColumns({ keeper: true, attack: false });
const col = (cols: StatColumn[], key: string): StatColumn => {
  const found = cols.find((c) => c.key === key);
  if (!found) throw new Error(`no column ${key}`);
  return found;
};

describe("player stat columns", () => {
  it("weights a career rating by appearances rather than averaging the seasons", () => {
    // 7.00 over 10 games and 6.00 over 30 is a 6.25 career, not a 6.50 one.
    const seasons = [
      row({ appearances: 10, ratingSum: 70 }),
      row({ appearances: 30, ratingSum: 180 }),
    ];
    expect(statCellText(col(outfield, "rtg"), sumStatRows(seasons), false)).toBe("6.25");
  });

  it("re-derives a career ratio from the summed components", () => {
    // 50% of 20 passes then 90% of 100 is 83% of 120 — not the 70% an average
    // of the two percentages would give.
    const seasons = [
      row({ passes: 20, passesCompleted: 10 }),
      row({ passes: 100, passesCompleted: 90 }),
    ];
    expect(statCellText(col(outfield, "passpct"), sumStatRows(seasons), false)).toBe("83%");
  });

  it("converts counting stats per 90 but leaves ratios and ratings alone", () => {
    const s = row({
      appearances: 10, minutesPlayed: 900, goals: 5, shots: 20, shotsOnTarget: 10, ratingSum: 70,
    });
    expect(statCellText(col(outfield, "g"), s, false)).toBe("5");
    expect(statCellText(col(outfield, "g"), s, true)).toBe("0.50");
    // A share of shots and an average rating are already rates; dividing either
    // by matches played would be meaningless.
    expect(statCellText(col(outfield, "shpct"), s, true)).toBe("50%");
    expect(statCellText(col(outfield, "rtg"), s, true)).toBe("7.00");
    expect(statHeader(col(outfield, "g"), true)).toBe("G/90");
    expect(statHeader(col(outfield, "shpct"), true)).toBe("Sh%");
  });

  it("signs the difference columns in both directions", () => {
    const over = row({ appearances: 1, goals: 12, xg: 8.5 });
    const under = row({ appearances: 1, goals: 4, xg: 7.25 });
    expect(statCellText(col(outfield, "xgdiff"), over, false)).toBe("+3.50");
    expect(statCellText(col(outfield, "xgdiff"), under, false)).toBe("-3.25");
    // Goals prevented runs the other way round: conceding fewer than expected
    // is the positive outcome.
    const gk = row({ appearances: 1, goalsAgainst: 30, xga: 34.5 });
    expect(statCellText(col(keeper, "gprev"), gk, false)).toBe("+4.50");
  });

  it("prints an em dash for an unmeasurable ratio, not a zero", () => {
    // No shots taken is not 0% accuracy; there is nothing to take a share of.
    expect(statCellText(col(outfield, "shpct"), row({ appearances: 3 }), false)).toBe("—");
  });

  it("blanks a zero card count but prints a real one", () => {
    expect(statCellText(col(outfield, "yc"), row({ yellowCards: 0 }), false)).toBe("");
    expect(statCellText(col(outfield, "yc"), row({ yellowCards: 4 }), false)).toBe("4");
  });

  it("keeps a stat the competition never recorded absent through the career sum", () => {
    // Cup lines carry no passing or xG at all (an archived cup discarded the
    // box scores those came from). Summing them to 0 would claim he attempted
    // zero passes in the cup, which is a different — and false — statement.
    const cupSeasons = [row({ appearances: 6, goals: 2 }), row({ appearances: 4, goals: 1 })];
    const total = sumStatRows(cupSeasons);
    expect(total.passes).toBeUndefined();
    expect(total.xg).toBeUndefined();
    expect(statCellText(col(outfield, "pass"), total, false)).toBe("—");
    expect(statCellText(col(outfield, "xg"), total, false)).toBe("—");
    // A league season that genuinely recorded none still reads as zero.
    expect(statCellText(col(outfield, "pass"), sumStatRows([row({ passes: 0 })]), false)).toBe("0");
  });

  it("omits from the cup table the stats a cup line does not store", () => {
    const cup = cupStatColumns({ keeper: true, attack: true });
    const keys = cup.map((c) => c.key);
    expect(keys).not.toContain("xg");
    expect(keys).not.toContain("pass");
    expect(keys).not.toContain("yc");
    // What it does store, it shows — the average cup rating was recorded all
    // along and simply never had a column.
    expect(keys).toContain("rtg");
  });

  it("divides a cup rating by rated appearances, not every appearance", () => {
    // An unused substitute is an appearance with no rating; counting him in the
    // denominator would drag the average toward zero.
    const s = row({ appearances: 5, ratedAppearances: 4, ratingSum: 28 });
    expect(statCellText(col(outfield, "rtg"), s, false)).toBe("7.00");
  });

  it("shows keeper columns to a converted keeper and hides them from everyone else", () => {
    expect(statColumnScope("GK", [row()]).keeper).toBe(true);
    expect(statColumnScope("ST", [row({ goals: 20 })]).keeper).toBe(false);
    // Position is the player's *current* one, so an outfielder with saves on
    // record used to keep goal; his save columns must not vanish.
    expect(statColumnScope("CB", [row({ saves: 40, goalsAgainst: 30 })]).keeper).toBe(true);
    // ...and the reverse: a keeper who has never taken a shot gets no shooting
    // columns, but one who has scored keeps them.
    expect(statColumnScope("GK", [row()]).attack).toBe(false);
    expect(statColumnScope("GK", [row({ goals: 1 })]).attack).toBe(true);
  });
});
