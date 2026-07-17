import { describe, it, expect } from "vitest";
import {
  computeLoanFee, executeLoan, processLoanReturns, listPlayerForLoan,
  unlistPlayerForLoan, loanOfferCandidates, acceptLoanOffer, rejectLoanOffer,
  runAILoanMarket,
} from "../../src/core/loans.js";
import { createLeagueState, type LeagueStore } from "../../src/core/leagueState.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { trueTransferValue } from "../../src/core/finance/valuation.js";
import { LOAN_FEE_RATE, LOAN_DURATION_MULTIPLIER, ROSTER_CAP } from "../../src/core/constants.js";

function windowLeague(seed = 1): LeagueStore {
  const league = createLeagueState(0, mulberry32(seed));
  // Summer window is open right after generation (matchdays 1-4).
  return league;
}

describe("computeLoanFee", () => {
  it("scales with the diminishing duration multiplier, below the permanent transfer value", () => {
    const league = windowLeague();
    const player = league.players.find((p) => league.teams[0].roster.includes(p.pid))!;
    const market = trueTransferValue(player, league.season);
    const one = computeLoanFee(player, league.season, 1);
    const two = computeLoanFee(player, league.season, 2);
    const three = computeLoanFee(player, league.season, 3);

    expect(one).toBe(Math.round(market * LOAN_FEE_RATE * LOAN_DURATION_MULTIPLIER[1]));
    expect(two).toBeGreaterThan(one);
    expect(three).toBeGreaterThan(two);
    // A loan is always far cheaper than buying the player outright.
    expect(three).toBeLessThan(market);
  });
});

describe("executeLoan", () => {
  it("moves the player to the loanee roster, charges the fee, and records an active loan", () => {
    const league = windowLeague();
    const parentTid = 0;
    const loaneeTid = league.teams.find((t) => t.tid !== parentTid)!.tid;
    const pid = league.teams.find((t) => t.tid === parentTid)!.roster[0];
    const player = league.players.find((p) => p.pid === pid)!;
    const fee = computeLoanFee(player, league.season, 1);

    const updated = executeLoan(league, pid, parentTid, loaneeTid, 1, fee, league.season, "summer");

    const parent = updated.teams.find((t) => t.tid === parentTid)!;
    const loanee = updated.teams.find((t) => t.tid === loaneeTid)!;
    expect(parent.roster).not.toContain(pid);
    expect(loanee.roster).toContain(pid);
    expect(parent.budget).toBeGreaterThan(league.teams.find((t) => t.tid === parentTid)!.budget);

    const loan = updated.activeLoans.find((l) => l.pid === pid);
    expect(loan).toBeDefined();
    expect(loan!.parentTid).toBe(parentTid);
    expect(loan!.loaneeTid).toBe(loaneeTid);
    expect(loan!.returnSeason).toBe(league.season + 1);

    const logged = updated.transfers.at(-1)!;
    expect(logged.loanSeasons).toBe(1);
    expect(logged.fromTid).toBe(parentTid);
    expect(logged.toTid).toBe(loaneeTid);
  });
});

describe("processLoanReturns", () => {
  it("returns a player whose loan is due, and leaves a not-yet-due loan alone", () => {
    const league = windowLeague();
    const teams = league.teams;
    const duePid = teams[0].roster[0];
    const notDuePid = teams[0].roster[1];

    const activeLoans = [
      { pid: duePid, parentTid: teams[0].tid, loaneeTid: teams[1].tid, startSeason: league.season, seasons: 1, returnSeason: league.season + 1, fee: 100 },
      { pid: notDuePid, parentTid: teams[0].tid, loaneeTid: teams[1].tid, startSeason: league.season, seasons: 2, returnSeason: league.season + 2, fee: 100 },
    ];
    // Move both pids onto the loanee's roster, as executeLoan would have.
    const loanedTeams = teams.map((t) => {
      if (t.tid === teams[0].tid) return { ...t, roster: t.roster.filter((p) => p !== duePid && p !== notDuePid) };
      if (t.tid === teams[1].tid) return { ...t, roster: [...t.roster, duePid, notDuePid] };
      return t;
    });

    const result = processLoanReturns(loanedTeams, activeLoans, [], league.season + 1);

    const parent = result.teams.find((t) => t.tid === teams[0].tid)!;
    const loanee = result.teams.find((t) => t.tid === teams[1].tid)!;
    expect(parent.roster).toContain(duePid);
    expect(loanee.roster).not.toContain(duePid);
    expect(loanee.roster).toContain(notDuePid);
    expect(result.activeLoans.some((l) => l.pid === duePid)).toBe(false);
    expect(result.activeLoans.some((l) => l.pid === notDuePid)).toBe(true);
    expect(result.transfers.some((t) => t.pid === duePid && t.loanReturn)).toBe(true);
  });

  it("is a no-op when nothing is due", () => {
    const league = windowLeague();
    const result = processLoanReturns(league.teams, [], [], league.season + 1);
    expect(result.teams).toBe(league.teams);
    expect(result.activeLoans).toEqual([]);
  });
});

describe("listPlayerForLoan / unlistPlayerForLoan", () => {
  it("adds a listing for a player who keeps the depth floor", () => {
    const league = windowLeague();
    const pid = league.teams[0].roster.find((p) => {
      const player = league.players.find((pl) => pl.pid === p);
      return player != null;
    })!;
    const updated = listPlayerForLoan(league, pid, 2);
    expect(updated.loanListings).toEqual([{ pid, seasons: 2 }]);
  });

  it("refuses to list a player already on an active loan", () => {
    const league = windowLeague();
    const pid = league.teams[0].roster[0];
    const withLoan: LeagueStore = {
      ...league,
      activeLoans: [{ pid, parentTid: 0, loaneeTid: 1, startSeason: league.season, seasons: 1, returnSeason: league.season + 1, fee: 0 }],
    };
    const updated = listPlayerForLoan(withLoan, pid, 1);
    expect(updated).toBe(withLoan);
  });

  it("unlisting removes the entry", () => {
    const league = windowLeague();
    const pid = league.teams[0].roster[0];
    const listed = listPlayerForLoan(league, pid, 1);
    const unlisted = unlistPlayerForLoan(listed, pid);
    expect(unlisted.loanListings).toEqual([]);
  });
});

describe("loanOfferCandidates / acceptLoanOffer / rejectLoanOffer", () => {
  it("only offers on listed players still on the user's roster, never the user's own club as buyer", () => {
    const league = windowLeague();
    const pid = league.teams[0].roster[0];
    const listed = listPlayerForLoan(league, pid, 1);
    const candidates = loanOfferCandidates(listed);
    for (const c of candidates) {
      expect(c.player.pid).toBe(pid);
      expect(c.buyerTid).not.toBe(league.meta.userTid);
      expect(c.seasons).toBe(1);
      expect(c.fee).toBeGreaterThan(0);
    }
  });

  it("accepting a candidate offer executes the loan and clears the listing", () => {
    const league = windowLeague();
    const pid = league.teams[0].roster[0];
    let state = listPlayerForLoan(league, pid, 1);
    const candidates = loanOfferCandidates(state);
    if (candidates.length === 0) return; // no willing buyer for this seed/player — nothing to assert
    state = acceptLoanOffer(state, pid);
    expect(state.loanListings.some((l) => l.pid === pid)).toBe(false);
    expect(state.activeLoans.some((l) => l.pid === pid)).toBe(true);
    expect(state.teams.find((t) => t.tid === league.meta.userTid)!.roster).not.toContain(pid);
  });

  it("rejecting keeps the listing but excludes that buyer this window", () => {
    const league = windowLeague();
    const pid = league.teams[0].roster[0];
    let state = listPlayerForLoan(league, pid, 1);
    const candidates = loanOfferCandidates(state);
    if (candidates.length === 0) return;
    const rejectedBuyer = candidates[0].buyerTid;
    state = rejectLoanOffer(state, pid);
    expect(state.loanListings.some((l) => l.pid === pid)).toBe(true);
    const after = loanOfferCandidates(state);
    expect(after.some((c) => c.player.pid === pid && c.buyerTid === rejectedBuyer)).toBe(false);
  });
});

describe("runAILoanMarket", () => {
  it("never moves the user's players or exceeds ROSTER_CAP", () => {
    const league = windowLeague();
    const userTid = league.meta.userTid;
    const result = runAILoanMarket(
      league.teams, league.players, [], [], league.season, league.played,
      "summer", userTid, 42, league.competitions,
    );
    const userTeam = result.teams.find((t) => t.tid === userTid)!;
    expect(userTeam.roster).toEqual(league.teams.find((t) => t.tid === userTid)!.roster);
    for (const t of result.teams) {
      expect(t.roster.length).toBeLessThanOrEqual(ROSTER_CAP);
    }
    for (const loan of result.activeLoans) {
      expect(loan.parentTid).not.toBe(userTid);
      expect(loan.loaneeTid).not.toBe(userTid);
    }
  });
});
