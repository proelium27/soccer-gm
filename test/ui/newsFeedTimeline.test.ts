import { describe, it, expect } from "vitest";
import { buildSeasonTimeline } from "../../src/ui/newsFeedTimeline.js";
import type { CompletedTransfer } from "../../src/core/transfers/negotiation.js";
import { FREE_AGENT_TID } from "../../src/core/transfers/negotiation.js";
import type { NewsEvent } from "../../src/core/newsEvents.js";

const USER_TID = 0;

describe("buildSeasonTimeline", () => {
  it("orders summer transfers before in-season accomplishments before winter transfers", () => {
    const transfers: CompletedTransfer[] = [
      { pid: 1, fromTid: 0, toTid: 1, fee: 1000, season: 2026, window: "winter" },
      { pid: 2, fromTid: 1, toTid: 0, fee: 2000, season: 2026, window: "summer" },
    ];
    const newsEvents: NewsEvent[] = [
      { type: "hattrick", pid: 3, tid: 0, season: 2026, matchday: 10, detail: 3 },
    ];

    const timeline = buildSeasonTimeline(transfers, newsEvents, USER_TID);

    expect(timeline.map((item) => item.kind)).toEqual(["transfer", "news", "transfer"]);
    expect(timeline[0].kind === "transfer" && timeline[0].data.window).toBe("summer");
    expect(timeline[2].kind === "transfer" && timeline[2].data.window).toBe("winter");
  });

  it("orders multiple accomplishments by matchday", () => {
    const newsEvents: NewsEvent[] = [
      { type: "hattrick", pid: 1, tid: 0, season: 2026, matchday: 20, detail: 3 },
      { type: "standoutRating", pid: 2, tid: 1, season: 2026, matchday: 5, detail: 91 },
    ];

    const timeline = buildSeasonTimeline([], newsEvents, USER_TID);

    expect(timeline.map((item) => item.kind === "news" && item.data.matchday)).toEqual([5, 20]);
  });

  it("returns an empty array for a season with no transfers or events", () => {
    expect(buildSeasonTimeline([], [], USER_TID)).toEqual([]);
  });

  it("hides other clubs' free signings but keeps the user's own and all paid deals", () => {
    const transfers: CompletedTransfer[] = [
      // Routine AI free signing (another club) — should be hidden.
      { pid: 1, fromTid: FREE_AGENT_TID, toTid: 5, fee: 0, season: 2026, window: "summer" },
      // The user signs a free agent — should stay.
      { pid: 2, fromTid: FREE_AGENT_TID, toTid: USER_TID, fee: 0, season: 2026, window: "summer" },
      // A paid deal between two AI clubs — should stay.
      { pid: 3, fromTid: 5, toTid: 6, fee: 1000, season: 2026, window: "summer" },
    ];

    const timeline = buildSeasonTimeline(transfers, [], USER_TID);
    const pids = timeline
      .filter((item) => item.kind === "transfer")
      .map((item) => (item.kind === "transfer" ? item.data.pid : -1));
    expect(pids.sort()).toEqual([2, 3]);
  });
});
