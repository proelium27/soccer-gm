import { describe, it, expect } from "vitest";
import { makeLeague } from "../../helpers/league.js";
import {
  searchWorldPlayers,
  PLAYER_SEARCH_LIMIT,
} from "../../../src/core/transfers/recommendations.js";
import { type LeagueStore } from "../../../src/core/leagueState.js";
import type { ActiveLoan } from "../../../src/core/loans.js";
import { weeklyWage } from "../../../src/core/contracts.js";

/** A league sitting inside the winter window (offers require an open window). */
function windowLeague(seed: number): LeagueStore {
  const league = makeLeague(0, seed);
  return { ...league, schedule: league.schedule.filter((g) => g.matchday >= 20) };
}

describe("searchWorldPlayers", () => {
  it("returns nothing when no window is open", () => {
    const league = makeLeague(0, 1);
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

  it("treats nationality as a search on its own and matches it exactly", () => {
    const league = windowLeague(6);
    // Pick a nationality that actually exists in this world.
    const nationality = league.players[0].nationality;
    const results = searchWorldPlayers(league, { nationality });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(r.player.nationality).toBe(nationality);
  });

  it("restricts to one competition when a league filter is set", () => {
    const league = windowLeague(6);
    const compId = league.teams.find((t) => t.tid !== 0)!.compId;
    const tidsInComp = new Set(
      league.teams.filter((t) => t.compId === compId).map((t) => t.tid),
    );
    const results = searchWorldPlayers(league, { compId, minOvr: 1 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(tidsInComp.has(r.sellerTid)).toBe(true);
  });

  it("applies the upper half of every range filter", () => {
    const league = windowLeague(7);
    const results = searchWorldPlayers(league, {
      maxOvr: 60, maxPot: 70, minAge: 24, maxAge: 30,
    });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.player.ovr).toBeLessThanOrEqual(60);
      expect(r.player.potential).toBeLessThanOrEqual(70);
      const age = league.season - r.player.born;
      expect(age).toBeGreaterThanOrEqual(24);
      expect(age).toBeLessThanOrEqual(30);
    }
  });

  it("filters on weekly wage, in the units the wage column shows", () => {
    const league = windowLeague(7);
    const cap = 40_000;
    const results = searchWorldPlayers(league, { maxWeeklyWage: cap, minOvr: 1 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(weeklyWage(r.player.contract.salary)).toBeLessThanOrEqual(cap);
    }
    // And it genuinely excludes people: the world's best earners are gone.
    const shownPids = new Set(results.map((r) => r.player.pid));
    const bigEarner = league.players.find(
      (pl) => weeklyWage(pl.contract.salary) > cap && !league.teams[0].roster.includes(pl.pid),
    );
    expect(bigEarner).toBeDefined();
    expect(shownPids.has(bigEarner!.pid)).toBe(false);
  });

  it("filters on contract length remaining", () => {
    const league = windowLeague(8);
    const results = searchWorldPlayers(league, { maxContractYears: 1, minOvr: 1 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.player.contract.expiresSeason - league.season).toBeLessThanOrEqual(1);
    }
  });

  it("applies a minimum value as well as a maximum", () => {
    const league = windowLeague(8);
    const floor = 20_000_000;
    const results = searchWorldPlayers(league, { minValue: floor, maxOvr: 99 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(r.scoutedValue).toBeGreaterThanOrEqual(floor);
  });

  it("drops unbuyable players when asked for for-sale only", () => {
    // A loan is the cheapest way to make one specific player unbuyable, so the
    // test doesn't depend on which of a generated world's stars happen to be
    // protected (on a fresh league, none of them are yet).
    const base = windowLeague(9);
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
    const name = league.players.find((p) => p.pid === pid)!.name;

    const all = searchWorldPlayers(league, { name });
    expect(all.some((r) => r.player.pid === pid && !r.forSale)).toBe(true);

    const forSale = searchWorldPlayers(league, { name, forSaleOnly: true });
    expect(forSale.some((r) => r.player.pid === pid)).toBe(false);
    for (const r of forSale) {
      expect(r.forSale).toBe(true);
      expect(r.notForSaleReason).toBeNull();
    }
  });

  it("does not treat for-sale-only as a constraint on its own", () => {
    expect(searchWorldPlayers(windowLeague(9), { forSaleOnly: true })).toEqual([]);
  });
});
