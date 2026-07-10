import { describe, it, expect } from "vitest";
import { transferWindowState, nextMatchday } from "../../../src/core/transfers/window.js";
import { createLeagueState, type LeagueStore } from "../../../src/core/leagueState.js";
import { mulberry32 } from "../../../src/engine/rng.js";
import {
  SUMMER_WINDOW_CLOSE_MATCHDAY, TRANSFER_DEADLINE_MATCHDAY, WINTER_WINDOW_OPEN_MATCHDAY,
} from "../../../src/core/calendar.js";

/** A league whose next unplayed matchday is `md` (games before it removed). */
function leagueAtMatchday(md: number): LeagueStore {
  const league = createLeagueState(0, mulberry32(1));
  return {
    ...league,
    schedule: league.schedule.filter((g) => g.matchday >= md),
  };
}

describe("transferWindowState", () => {
  it("opens the summer window for the whole offseason phase", () => {
    const league = { ...createLeagueState(0, mulberry32(2)), phase: "offseason" as const };
    const ws = transferWindowState(league);
    expect(ws).toMatchObject({ open: true, window: "summer" });
  });

  it("keeps the summer window open through August and closes it after", () => {
    for (let md = 1; md <= SUMMER_WINDOW_CLOSE_MATCHDAY; md++) {
      expect(transferWindowState(leagueAtMatchday(md))).toMatchObject({
        open: true,
        window: "summer",
        closesAfterMatchday: SUMMER_WINDOW_CLOSE_MATCHDAY,
      });
    }
    expect(transferWindowState(leagueAtMatchday(SUMMER_WINDOW_CLOSE_MATCHDAY + 1)).open).toBe(false);
  });

  it("opens the winter window from mid-December through deadline day only", () => {
    expect(transferWindowState(leagueAtMatchday(WINTER_WINDOW_OPEN_MATCHDAY - 1)).open).toBe(false);
    for (let md = WINTER_WINDOW_OPEN_MATCHDAY; md <= TRANSFER_DEADLINE_MATCHDAY; md++) {
      expect(transferWindowState(leagueAtMatchday(md))).toMatchObject({
        open: true,
        window: "winter",
        closesAfterMatchday: TRANSFER_DEADLINE_MATCHDAY,
      });
    }
    expect(transferWindowState(leagueAtMatchday(TRANSFER_DEADLINE_MATCHDAY + 1)).open).toBe(false);
  });

  it("is closed mid-autumn and in the spring run-in", () => {
    for (const md of [5, 10, 17, 23, 30, 38]) {
      expect(transferWindowState(leagueAtMatchday(md)).open).toBe(false);
    }
  });
});

describe("nextMatchday", () => {
  it("returns the lowest unplayed matchday", () => {
    expect(nextMatchday(leagueAtMatchday(7))).toBe(7);
  });

  it("returns null once the schedule is empty", () => {
    expect(nextMatchday({ schedule: [] })).toBeNull();
  });
});
