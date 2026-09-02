import { describe, it, expect } from "vitest";
import { makeLeague } from "../helpers/league.js";
import {
  isWatched, setWatched, toggleWatched, watchlistEntries,
} from "../../src/core/watchlist.js";
import { searchWorldPlayers } from "../../src/core/transfers/recommendations.js";
import type { LeagueStore } from "../../src/core/leagueState.js";

/** A league sitting inside the winter window, so the sale gates have something to say. */
function windowLeague(seed: number): LeagueStore {
  const league = makeLeague(0, seed);
  return { ...league, schedule: league.schedule.filter((g) => g.matchday >= 20) };
}

describe("watchlist state", () => {
  it("starts empty and stars anyone in the world, not just your own players", () => {
    const league = makeLeague(0, 1);
    expect(league.watchlist).toEqual([]);

    // Someone else's player: the thing transferListed/moreMinutes both refuse.
    const other = league.teams.find((t) => t.tid !== league.meta.userTid)!;
    const pid = other.roster[0];

    const watched = setWatched(league, pid, true);
    expect(isWatched(watched, pid)).toBe(true);
    expect(watched.watchlist).toEqual([pid]);
    // Non-mutating.
    expect(league.watchlist).toEqual([]);
  });

  it("is a no-op when the flag already reads that way, so nothing is written", () => {
    const league = makeLeague(0, 1);
    const pid = league.players[0].pid;
    expect(setWatched(league, pid, false)).toBe(league);

    const watched = setWatched(league, pid, true);
    expect(setWatched(watched, pid, true)).toBe(watched);
  });

  it("toggles both ways and keeps the order players were starred in", () => {
    const league = makeLeague(0, 1);
    const [a, b, c] = league.players.slice(0, 3).map((p) => p.pid);

    let l = toggleWatched(league, a);
    l = toggleWatched(l, b);
    l = toggleWatched(l, c);
    expect(l.watchlist).toEqual([a, b, c]);

    l = toggleWatched(l, b);
    expect(l.watchlist).toEqual([a, c]);
    expect(isWatched(l, b)).toBe(false);
  });
});

describe("watchlistEntries", () => {
  it("resolves a rival's player to his club, his value and whether he's buyable", () => {
    const league = windowLeague(2);
    const other = league.teams.find((t) => t.tid !== league.meta.userTid)!;
    const pid = other.roster[0];

    const [entry] = watchlistEntries(setWatched(league, pid, true));
    expect(entry.player.pid).toBe(pid);
    expect(entry.tid).toBe(other.tid);
    expect(entry.academy).toBe(false);
    expect(entry.own).toBe(false);
    expect(entry.value).toBeGreaterThan(0);
    // Either answer is legitimate, but it must be one of them rather than undefined.
    expect(entry.notForSaleReason === null || typeof entry.notForSaleReason === "string").toBe(true);
  });

  it("marks your own players as yours and asks no sale question about them", () => {
    const league = windowLeague(2);
    const user = league.teams.find((t) => t.tid === league.meta.userTid)!;
    const [entry] = watchlistEntries(setWatched(league, user.roster[0], true));
    expect(entry.own).toBe(true);
    expect(entry.tid).toBe(league.meta.userTid);
    expect(entry.notForSaleReason).toBeNull();
  });

  it("reads a free agent as clubless, with no club to refuse the move", () => {
    const league = windowLeague(2);
    const rostered = new Set(league.teams.flatMap((t) => [...t.roster, ...t.academyRoster]));
    const freeAgent = league.players.find((p) => !rostered.has(p.pid));
    // A fresh world may have nobody unsigned; the case is only worth asserting
    // when it exists, and skipping beats fabricating one the generator wouldn't.
    if (!freeAgent) return;

    const [entry] = watchlistEntries(setWatched(league, freeAgent.pid, true));
    expect(entry.tid).toBeNull();
    expect(entry.own).toBe(false);
    expect(entry.notForSaleReason).toBeNull();
  });

  it("drops a pid that no longer names anyone rather than yielding a blank row", () => {
    const league = windowLeague(2);
    const kept = league.teams[1].roster[0];
    const watched = { ...setWatched(league, kept, true), watchlist: [999999, kept, 999998] };

    const entries = watchlistEntries(watched);
    expect(entries.map((e) => e.player.pid)).toEqual([kept]);
  });

  it("quotes the same value and sale verdict the transfer search does", () => {
    const league = windowLeague(3);
    // Take a player the search itself surfaced, so both sides are looking at
    // exactly the same man under exactly the same window.
    const [result] = searchWorldPlayers(league, { minOvr: 70 });
    expect(result).toBeDefined();

    const [entry] = watchlistEntries(setWatched(league, result.player.pid, true));
    expect(entry.value).toBe(result.scoutedValue);
    expect(entry.notForSaleReason).toBe(result.notForSaleReason);
  });

  it("costs nothing when nothing is starred", () => {
    expect(watchlistEntries(makeLeague(0, 1))).toEqual([]);
  });
});
