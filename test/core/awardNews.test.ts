import { describe, it, expect } from "vitest";
import { seasonAwardNews, awardNewsScope, type AwardNews } from "../../src/core/awardNews.js";
import type { SeasonHistoryEntry } from "../../src/core/standings.js";
import { NEWS_BALLON_DOR_PLACINGS } from "../../src/core/constants.js";

const USER_COMP = 1;

function worldEntry(pid: number, tid: number) {
  return { pid, tid, score: 10, league: 8, cup: 1, intl: 1, title: 0 };
}

/** A season entry carrying only the awards a test cares about. */
function entry(over: Partial<SeasonHistoryEntry> = {}): SeasonHistoryEntry {
  return {
    season: 3,
    table: [],
    teamStats: [],
    awards: {},
    world: { ballonDOr: [], worldTeamOfYear: [] },
    compsByTid: {},
    championTidByCompId: {},
    ...over,
  } as SeasonHistoryEntry;
}

const kinds = (items: AwardNews[]) => items.map((a) => a.kind).sort();

describe("seasonAwardNews", () => {
  it("returns nothing for a season with no entry yet", () => {
    expect(seasonAwardNews(undefined)).toEqual([]);
    expect(seasonAwardNews(null)).toEqual([]);
  });

  it("returns nothing for an entry whose awards are all empty", () => {
    expect(seasonAwardNews(entry())).toEqual([]);
  });

  it("reports a competition's Player of the Season, Golden Boot and XI", () => {
    const items = seasonAwardNews(entry({
      awards: {
        [USER_COMP]: {
          playerOfSeasonPid: 1,
          goldenBootPid: 2,
          teamOfSeason: [3, null, 4],
        },
      } as SeasonHistoryEntry["awards"],
    }));

    expect(kinds(items)).toEqual(["goldenBoot", "playerOfSeason", "teamOfSeason", "teamOfSeason"]);
    // The null slot is skipped, and the surviving ones keep the slot they were
    // picked in — the slot is what the award says about the player.
    const xi = items.filter((a) => a.kind === "teamOfSeason");
    expect(xi.map((a) => [a.pid, a.slot])).toEqual([[3, 0], [4, 2]]);
    expect(items.every((a) => a.compId === USER_COMP)).toBe(true);
  });

  it("takes a club from the awardWinners snapshot, and the Ballon d'Or's own entry", () => {
    const items = seasonAwardNews(entry({
      awards: {
        [USER_COMP]: { playerOfSeasonPid: 1, goldenBootPid: null, teamOfSeason: [] },
      } as SeasonHistoryEntry["awards"],
      world: { ballonDOr: [worldEntry(9, 77)], worldTeamOfYear: [] },
      awardWinners: [
        { pid: 1, name: "A", nationality: "England", pos: "ST", ovr: 80, tid: 5, born: 2000 },
      ],
    }));

    expect(items.find((a) => a.pid === 1)?.tid).toBe(5);
    expect(items.find((a) => a.pid === 9)?.tid).toBe(77);
  });

  it("leaves the club undefined when the save can no longer name it", () => {
    // An old save's backfill only reached as far as the pool and the archive
    // still did, so some winners have no snapshot at all.
    const items = seasonAwardNews(entry({
      awards: {
        [USER_COMP]: { playerOfSeasonPid: 1, goldenBootPid: null, teamOfSeason: [] },
      } as SeasonHistoryEntry["awards"],
    }));
    expect(items[0].tid).toBeUndefined();
    expect(items[0].compId).toBe(USER_COMP);
  });

  it("reports the Ballon d'Or podium and no further down the shortlist", () => {
    const items = seasonAwardNews(entry({
      world: {
        ballonDOr: [1, 2, 3, 4, 5, 6].map((pid) => worldEntry(pid, 10)),
        worldTeamOfYear: [],
      },
    }));

    const bd = items.filter((a) => a.kind === "ballonDOr");
    expect(bd).toHaveLength(NEWS_BALLON_DOR_PLACINGS);
    expect(bd.map((a) => a.placing)).toEqual([1, 2, 3]);
  });

  it("reports only the winner of each position award, not the shortlist", () => {
    const items = seasonAwardNews(entry({
      world: {
        ballonDOr: [],
        worldTeamOfYear: [],
        goalkeeperOfYear: [worldEntry(1, 10), worldEntry(2, 11)],
        defenderOfYear: [worldEntry(3, 12), worldEntry(4, 13)],
      },
    }));

    expect(items.map((a) => [a.kind, a.pid])).toEqual([
      ["goalkeeperOfYear", 1],
      ["defenderOfYear", 3],
    ]);
  });

  it("tolerates a save from before the position awards existed", () => {
    // Both fields are optional on WorldAwards for exactly this reason.
    const items = seasonAwardNews(entry({
      world: { ballonDOr: [worldEntry(1, 10)], worldTeamOfYear: [null] },
    }));
    expect(kinds(items)).toEqual(["ballonDOr"]);
  });
});

describe("awardNewsScope", () => {
  const of = (over: Partial<AwardNews>): AwardNews => ({ kind: "playerOfSeason", pid: 1, ...over });

  it("treats the worldwide honours as world news", () => {
    expect(awardNewsScope(of({ kind: "ballonDOr", placing: 1 }))).toBe("world");
    expect(awardNewsScope(of({ kind: "worldTeamOfYear", slot: 0 }))).toBe("world");
    expect(awardNewsScope(of({ kind: "goalkeeperOfYear" }))).toBe("world");
    expect(awardNewsScope(of({ kind: "defenderOfYear" }))).toBe("world");
  });

  it("keeps a competition's own honours inside it", () => {
    expect(awardNewsScope(of({ kind: "playerOfSeason" }))).toBe("league");
    expect(awardNewsScope(of({ kind: "goldenBoot" }))).toBe("league");
    expect(awardNewsScope(of({ kind: "teamOfSeason", slot: 3 }))).toBe("league");
  });

  it("treats a Ballon d'Or placing behind the winner as league news", () => {
    // Sixteen leagues' runners-up would otherwise all reach every reader.
    expect(awardNewsScope(of({ kind: "ballonDOr", placing: 2 }))).toBe("league");
    expect(awardNewsScope(of({ kind: "ballonDOr", placing: 3 }))).toBe("league");
  });
});
