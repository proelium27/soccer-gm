import { describe, expect, it } from "vitest";
import { capSeason } from "../../src/ui/pages/NewsFeed.js";
import type { FeedItem } from "../../src/ui/newsFeedTimeline.js";
import { NEWS_FEED_SEASON_LIMIT } from "../../src/core/constants.js";

/**
 * Guards the News Feed row cap.
 *
 * The feed inherited the uncapped-list problem that froze /transfers, and it is
 * the worse of the two because `newsEvents` is append-only and persisted, so a
 * season's feed never shrinks. Measured on a real 3-season save before the cap:
 * 956 rows, 15,903 DOM elements, 1,932 flag images and a 34,345px page — already
 * past the 10,684 elements that froze /transfers, three seasons in.
 *
 * Two properties have to hold, and neither is obvious from reading the caller:
 * the user's own club's news is never what gets dropped, and the rows that
 * survive stay in the timeline's order rather than being re-ranked into
 * "yours first".
 */

// The cap only ever asks `involvesUser`, so the items only need to be
// distinguishable. A transfer item is the cheapest real shape to build.
function item(pid: number, mine: boolean): FeedItem {
  return {
    kind: "transfer",
    // Only `pid` is read back by these tests; the rest satisfies the type.
    data: {
      pid,
      season: 1,
      window: "summer",
      fromTid: mine ? 0 : 5,
      toTid: mine ? 0 : 6,
      fee: 0,
    },
  } as unknown as FeedItem;
}

const involvesUser = (i: FeedItem) => (i.data as { fromTid: number }).fromTid === 0;
const pidsOf = (items: FeedItem[]) => items.map((i) => (i.data as { pid: number }).pid);

describe("News Feed season cap", () => {
  it("leaves a season under the limit completely alone", () => {
    const items = Array.from({ length: 10 }, (_, i) => item(i, false));
    const { rows, hidden } = capSeason(items, involvesUser);
    expect(hidden).toBe(0);
    expect(rows).toEqual(items);
  });

  it("caps a season over the limit and reports what it hid", () => {
    const n = NEWS_FEED_SEASON_LIMIT + 40;
    const items = Array.from({ length: n }, (_, i) => item(i, false));
    const { rows, hidden } = capSeason(items, involvesUser);
    expect(rows).toHaveLength(NEWS_FEED_SEASON_LIMIT);
    expect(hidden).toBe(40);
  });

  it("never drops the user's own news, however late in the season it falls", () => {
    // The user's items sit at the very end, so a naive "take the first N" cap
    // would discard every one of them.
    const others = Array.from({ length: NEWS_FEED_SEASON_LIMIT + 50 }, (_, i) => item(i, false));
    const mine = [item(9001, true), item(9002, true), item(9003, true)];
    const { rows } = capSeason([...others, ...mine], involvesUser);
    expect(pidsOf(rows.filter(involvesUser))).toEqual([9001, 9002, 9003]);
  });

  it("keeps the surviving rows in timeline order rather than the user's first", () => {
    const items = [item(1, false), item(2, true), item(3, false), item(4, true)];
    // Force the cap on with a tiny season by padding past the limit.
    const padded = [
      ...items,
      ...Array.from({ length: NEWS_FEED_SEASON_LIMIT, }, (_, i) => item(100 + i, false)),
    ];
    const { rows } = capSeason(padded, involvesUser);
    const pids = pidsOf(rows);
    // 2 and 4 are the user's and are kept; 1 and 3 are not the user's but are
    // early enough to survive. Order must be as authored, not regrouped.
    expect(pids.slice(0, 4)).toEqual([1, 2, 3, 4]);
    expect([...pids].sort((a, b) => a - b)).toEqual(pids);
  });

  it("shows only the user's news when a season is all theirs and over the limit", () => {
    // The budget goes negative here. slice(0, <=0) must take none of the rest
    // rather than throwing or taking everything.
    const n = NEWS_FEED_SEASON_LIMIT + 20;
    const mine = Array.from({ length: n }, (_, i) => item(i, true));
    const { rows, hidden } = capSeason([...mine, item(9999, false)], involvesUser);
    expect(rows).toHaveLength(n);
    expect(rows.every(involvesUser)).toBe(true);
    expect(hidden).toBe(1);
  });
});
