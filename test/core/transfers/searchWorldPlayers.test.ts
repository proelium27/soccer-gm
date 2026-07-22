import { describe, it, expect } from "vitest";
import {
  searchWorldPlayers,
  PLAYER_SEARCH_LIMIT,
} from "../../../src/core/transfers/recommendations.js";
import { createLeagueState, type LeagueStore } from "../../../src/core/leagueState.js";
import type { ActiveLoan } from "../../../src/core/loans.js";
import { mulberry32 } from "../../../src/engine/rng.js";

/** A league sitting inside the winter window (offers require an open window). */
function windowLeague(seed: number): LeagueStore {
  const league = createLeagueState(0, mulberry32(seed));
  return { ...league, schedule: league.schedule.filter((g) => g.matchday >= 20) };
}

describe("searchWorldPlayers", () => {
  it("returns nothing when no window is open", () => {
    const league = createLeagueState(0, mulberry32(1));
    const midAutumn = { ...league, schedule: league.schedule.filter((g) => g.matchday >= 10) };
    expect(searchWorldPlayers(midAutumn, { minOvr: 60 })).toEqual([]);
  });

  it("returns nothing without at least one constraint", () => {
    expect(searchWorldPlayers(windowLeague(2), {})).toEqual([]);
    expect(searchWorldPlayers(windowLeague(2), { name: "  " })).toEqual([]);
  });

  it("never lists the user's own players and applies numeric filters hard", () => {
    const league = windowLeague(2);
    const userRoster = new Set(league.teams[0].roster);
    const results = searchWorldPlayers(league, { minOvr: 68, maxAge: 26 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.sellerTid).not.toBe(0);
      expect(userRoster.has(r.player.pid)).toBe(false);
      expect(r.player.ovr).toBeGreaterThanOrEqual(68);
      expect(league.season - r.player.born).toBeLessThanOrEqual(26);
    }
  });

  it("matches names case-insensitively as a substring", () => {
    const league = windowLeague(3);
    // Pick a real player on another club and search a slice of his name.
    const target = league.players.find(
      (p) => !league.teams[0].roster.includes(p.pid),
    )!;
    const fragment = target.name.slice(0, 4).toUpperCase();
    const results = searchWorldPlayers(league, { name: fragment });
    expect(results.some((r) => r.player.pid === target.pid)).toBe(true);
    for (const r of results) {
      expect(r.player.name.toLowerCase()).toContain(fragment.toLowerCase());
    }
  });

  it("ranks by overall descending and caps at the limit", () => {
    const league = windowLeague(4);
    // A very loose constraint pulls in far more than the cap.
    const results = searchWorldPlayers(league, { minOvr: 1 });
    expect(results.length).toBe(PLAYER_SEARCH_LIMIT);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].player.ovr).toBeGreaterThanOrEqual(results[i].player.ovr);
    }
  });

  it("flags a loaned player as not for sale", () => {
    const base = windowLeague(5);
    const seller = base.teams.find((t) => t.tid !== 0 && t.roster.length > 0)!;
    const pid = seller.roster[0];
    const loan: ActiveLoan = {
      pid,
      parentTid: seller.tid,
      loaneeTid: 0,
      startSeason: base.season,
      seasons: 1,
      returnSeason: base.season + 1,
      fee: 0,
    };
    const league: LeagueStore = { ...base, activeLoans: [...base.activeLoans, loan] };
    const player = league.players.find((p) => p.pid === pid)!;
    const results = searchWorldPlayers(league, { name: player.name });
    const row = results.find((r) => r.player.pid === pid)!;
    expect(row.forSale).toBe(false);
    expect(row.notForSaleReason).toBe("Out on loan");
  });
});
