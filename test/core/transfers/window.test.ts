import { describe, it, expect } from "vitest";
import {
  transferWindowState, nextMatchday, freeAgentSigningWindow,
} from "../../../src/core/transfers/window.js";
import { type LeagueStore } from "../../../src/core/leagueState.js";
import {
  SUMMER_WINDOW_CLOSE_MATCHDAY, TRANSFER_DEADLINE_MATCHDAY, WINTER_WINDOW_OPEN_MATCHDAY,
} from "../../../src/core/calendar.js";

/**
 * All three functions under test are typed
 * `Pick<LeagueStore, "phase" | "schedule" | "season">` and read nothing beyond
 * `schedule[].matchday`, so a synthetic three-field league is the whole fixture
 * they need.
 *
 * This file used to build its leagues with `makeLeague`, which loads the cached
 * 626-club / 15,650-player world and then discards everything except the
 * fixture list — about thirty times over, counting the loops below. Nothing was
 * gained by it: a calendar function cannot see a player.
 */
type CalendarLeague = Pick<LeagueStore, "phase" | "schedule" | "season">;

const SEASON = 1;

/** A league in regular play whose next unplayed matchday is `md`. */
function at(md: number): CalendarLeague {
  return { phase: "regular", season: SEASON, schedule: [{ matchday: md, home: 0, away: 1 }] };
}

/** A full fixture list, matchday 1 to 38 — the shape a fresh season starts in. */
function fullSeason(): CalendarLeague {
  return {
    phase: "regular",
    season: SEASON,
    schedule: Array.from({ length: 38 }, (_, i) => ({ matchday: i + 1, home: 0, away: 1 })),
  };
}

describe("transferWindowState", () => {
  it("opens the summer window for the whole offseason phase", () => {
    const ws = transferWindowState({ ...fullSeason(), phase: "offseason" });
    expect(ws).toMatchObject({ open: true, window: "summer" });
  });

  it("keeps the summer window open through August and closes it after", () => {
    for (let md = 1; md <= SUMMER_WINDOW_CLOSE_MATCHDAY; md++) {
      expect(transferWindowState(at(md))).toMatchObject({
        open: true,
        window: "summer",
        closesAfterMatchday: SUMMER_WINDOW_CLOSE_MATCHDAY,
      });
    }
    expect(transferWindowState(at(SUMMER_WINDOW_CLOSE_MATCHDAY + 1)).open).toBe(false);
  });

  it("opens the winter window from mid-December through deadline day only", () => {
    expect(transferWindowState(at(WINTER_WINDOW_OPEN_MATCHDAY - 1)).open).toBe(false);
    for (let md = WINTER_WINDOW_OPEN_MATCHDAY; md <= TRANSFER_DEADLINE_MATCHDAY; md++) {
      expect(transferWindowState(at(md))).toMatchObject({
        open: true,
        window: "winter",
        closesAfterMatchday: TRANSFER_DEADLINE_MATCHDAY,
      });
    }
    expect(transferWindowState(at(TRANSFER_DEADLINE_MATCHDAY + 1)).open).toBe(false);
  });

  it("is closed mid-autumn and in the spring run-in", () => {
    for (const md of [5, 10, 17, 23, 30, 38]) {
      expect(transferWindowState(at(md)).open).toBe(false);
    }
  });

  it("gives the summer window one identity across the season rollover", () => {
    const league = fullSeason();
    const offseason: CalendarLeague = { ...league, phase: "offseason" };
    // What Advance does to the calendar: bump the season, back to regular
    // play with matchday 1 up next — still the same summer window.
    const advanced: CalendarLeague = { ...league, season: league.season + 1 };

    expect(transferWindowState(offseason)).toMatchObject({
      open: true, window: "summer", season: league.season + 1,
    });
    expect(transferWindowState(advanced)).toMatchObject({
      open: true, window: "summer", season: league.season + 1,
    });
    // The winter window simply belongs to the season in progress.
    const winter: CalendarLeague = {
      ...league,
      schedule: league.schedule.filter((g) => g.matchday >= 20),
    };
    expect(transferWindowState(winter)).toMatchObject({
      open: true, window: "winter", season: league.season,
    });
  });
});

describe("freeAgentSigningWindow", () => {
  it("follows the open window when there is one", () => {
    expect(freeAgentSigningWindow({ ...fullSeason(), phase: "offseason" })).toEqual({
      season: SEASON + 1, window: "summer",
    });
    expect(freeAgentSigningWindow(at(WINTER_WINDOW_OPEN_MATCHDAY))).toEqual({
      season: SEASON, window: "winter",
    });
  });

  it("files a between-windows signing under the window just closed, not the one ahead", () => {
    // Signing a free agent isn't window-gated, so this has to name a window
    // regardless. The record's window is what places it on the news-feed
    // timeline and in the "this window" lists, so an autumn deal filed as
    // winter would surface as January business weeks after it happened.
    for (const md of [SUMMER_WINDOW_CLOSE_MATCHDAY + 1, 10, WINTER_WINDOW_OPEN_MATCHDAY - 1]) {
      expect(freeAgentSigningWindow(at(md))).toEqual({ season: SEASON, window: "summer" });
    }
    for (const md of [TRANSFER_DEADLINE_MATCHDAY + 1, 30, 38]) {
      expect(freeAgentSigningWindow(at(md))).toEqual({ season: SEASON, window: "winter" });
    }
  });

  it("treats a fully simmed season as after the winter window", () => {
    expect(freeAgentSigningWindow({ ...fullSeason(), schedule: [] })).toEqual({
      season: SEASON, window: "winter",
    });
  });
});

describe("nextMatchday", () => {
  it("returns the lowest unplayed matchday", () => {
    expect(nextMatchday(at(7))).toBe(7);
    // A real schedule carries every remaining matchday, not just the next one.
    expect(nextMatchday(fullSeason())).toBe(1);
  });

  it("returns null once the schedule is empty", () => {
    expect(nextMatchday({ schedule: [] })).toBeNull();
  });
});
