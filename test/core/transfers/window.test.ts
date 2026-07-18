import { describe, it, expect } from "vitest";
import { makeLeague } from "../../helpers/league.js";
import { transferWindowState, nextMatchday } from "../../../src/core/transfers/window.js";
import { type LeagueStore } from "../../../src/core/leagueState.js";
import {
  SUMMER_WINDOW_CLOSE_MATCHDAY, TRANSFER_DEADLINE_MATCHDAY, WINTER_WINDOW_OPEN_MATCHDAY,
} from "../../../src/core/calendar.js";

/** A league whose next unplayed matchday is `md` (games before it removed). */
function leagueAtMatchday(md: number): LeagueStore {
  const league = makeLeague(0, 1);
  return {
    ...league,
    schedule: league.schedule.filter((g) => g.matchday >= md),
  };
}

describe("transferWindowState", () => {
  it("opens the summer window for the whole offseason phase", () => {
    const league = { ...makeLeague(0, 1), phase: "offseason" as const };
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

  it("gives the summer window one identity across the season rollover", () => {
    const league = makeLeague(0, 1);
    const offseason = { ...league, phase: "offseason" as const };
    // What Advance does to the calendar: bump the season, back to regular
    // play with matchday 1 up next — still the same summer window.
    const advanced = { ...league, season: league.season + 1 };

    expect(transferWindowState(offseason)).toMatchObject({
      open: true, window: "summer", season: league.season + 1,
    });
    expect(transferWindowState(advanced)).toMatchObject({
      open: true, window: "summer", season: league.season + 1,
    });
    // The winter window simply belongs to the season in progress.
    const winter = { ...league, schedule: league.schedule.filter((g) => g.matchday >= 20) };
    expect(transferWindowState(winter)).toMatchObject({
      open: true, window: "winter", season: league.season,
    });
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
