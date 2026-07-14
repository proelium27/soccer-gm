import { describe, it, expect } from "vitest";
import { buildSeasonTimeline } from "../../src/ui/newsFeedTimeline.js";
import type { CompletedTransfer } from "../../src/core/transfers/negotiation.js";
import type { NewsEvent } from "../../src/core/newsEvents.js";

describe("buildSeasonTimeline", () => {
  it("orders summer transfers before in-season accomplishments before winter transfers", () => {
    const transfers: CompletedTransfer[] = [
      { pid: 1, fromTid: 0, toTid: 1, fee: 1000, season: 2026, window: "winter" },
      { pid: 2, fromTid: 1, toTid: 0, fee: 2000, season: 2026, window: "summer" },
    ];
    const newsEvents: NewsEvent[] = [
      { type: "hattrick", pid: 3, tid: 0, season: 2026, matchday: 10, detail: 3 },
    ];

    const timeline = buildSeasonTimeline(transfers, newsEvents);

    expect(timeline.map((item) => item.kind)).toEqual(["transfer", "news", "transfer"]);
    expect(timeline[0].kind === "transfer" && timeline[0].data.window).toBe("summer");
    expect(timeline[2].kind === "transfer" && timeline[2].data.window).toBe("winter");
  });

  it("orders multiple accomplishments by matchday", () => {
    const newsEvents: NewsEvent[] = [
      { type: "hattrick", pid: 1, tid: 0, season: 2026, matchday: 20, detail: 3 },
      { type: "standoutRating", pid: 2, tid: 1, season: 2026, matchday: 5, detail: 91 },
    ];

    const timeline = buildSeasonTimeline([], newsEvents);

    expect(timeline.map((item) => item.kind === "news" && item.data.matchday)).toEqual([5, 20]);
  });

  it("returns an empty array for a season with no transfers or events", () => {
    expect(buildSeasonTimeline([], [])).toEqual([]);
  });
});
