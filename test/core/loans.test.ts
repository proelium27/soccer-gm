import { describe, it, expect } from "vitest";
import {
  computeLoanFee, executeLoan, processLoanReturns, listPlayerForLoan,
  unlistPlayerForLoan, loanOfferCandidates, acceptLoanOffer, rejectLoanOffer,
  runAILoanMarket,
} from "../../src/core/loans.js";
import { createLeagueState, type LeagueStore } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { trueTransferValue } from "../../src/core/finance/valuation.js";
import { tierOf } from "../../src/core/competitions.js";
import { resolveXI } from "../../src/core/lineup/resolveXI.js";
import { FORMATIONS } from "../../src/core/lineup/formations.js";
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

describe("no phantom players (loan + market/sweep interaction)", () => {
  it("never leaves a pid on more than one roster when a loaned player is a market/sweep target", () => {
    // Regression: a loaned player sits on the loanee's roster but is owned by
    // his parent. If the AI market or the Division-2 ceiling sweep could sell
    // him, processLoanReturns would later return a *copy* to the parent — the
    // same pid on two rosters. Set up the deterministic trigger: a strong
    // (>= threshold) AI-owned player loaned to a Division 2 club, whom the
    // ceiling sweep would otherwise move to Division 1 every offseason.
    const rng = mulberry32(1);
    const base = createLeagueState(0, rng);
    const b = base.teams.find((t) => tierOf(base.competitions, t.compId) === 2 && t.tid !== 0)!; // loanee (D2)
    const a = base.teams.find((t) => t.tid !== 0 && t.tid !== b.tid)!; // parent
    const pid = a.roster[0];

    // Force his underlying *ratings* elite, not just ovr — simOffseason's
    // progression recomputes ovr from ratings before the sweep runs, so a
    // forced ovr alone would be wiped at the first offseason (documented
    // pitfall, see worldIntegration.test.ts) and the player could then even
    // hit a retirement roll at his reverted rating. All-90 ratings keep him
    // a genuine sweep/market target for the whole test.
    const players = base.players.map((p) =>
      p.pid === pid
        ? {
            ...p,
            ratings: Object.fromEntries(Object.keys(p.ratings).map((k) => [k, 90])) as typeof p.ratings,
            ovr: 90,
            potential: 90,
            born: base.season - 24,
          }
        : p,
    );
    const teams = base.teams.map((t) => {
      if (t.tid === a.tid) return { ...t, roster: t.roster.filter((r) => r !== pid) };
      if (t.tid === b.tid) return { ...t, roster: [...t.roster, pid] };
      return t;
    });
    let league: LeagueStore = {
      ...base,
      players,
      teams,
      activeLoans: [{
        pid, parentTid: a.tid, loaneeTid: b.tid,
        startSeason: base.season, seasons: 2, returnSeason: base.season + 2, fee: 0,
      }],
    };

    // Sim across the loan's return (returnSeason = season + 2).
    for (let s = 0; s < 2; s++) {
      league = simThrough(league, "season", rng);
      league = simOffseason(league, rng);
      const count = new Map<number, number>();
      for (const t of league.teams) for (const r of t.roster) count.set(r, (count.get(r) ?? 0) + 1);
      const dup = [...count.entries()].find(([, n]) => n > 1);
      expect(dup, dup ? `pid ${dup[0]} on ${dup[1]} rosters after season ${s + 1}` : undefined).toBeUndefined();
    }
    // And the loaned player came home to exactly one club (his parent).
    const homes = league.teams.filter((t) => t.roster.includes(pid));
    expect(homes.length).toBe(1);
  });
});

describe("runAILoanMarket", () => {
  it("never loans out a player from his club's starting XI", () => {
    // Loans exist to get minutes for young players who aren't getting them
    // at home — a starter already is, so he's never a loan candidate no
    // matter how the valuations shake out.
    const league = windowLeague();
    const userTid = league.meta.userTid;
    const playerMap = new Map(league.players.map((p) => [p.pid, p]));
    const xiByTid = new Map(
      league.teams.map((t) => {
        const roster = t.roster.map((pid) => playerMap.get(pid)!).filter(Boolean);
        return [t.tid, new Set(resolveXI(roster, FORMATIONS["4-3-3"], t.starters).map((p) => p.pid))];
      }),
    );

    const result = runAILoanMarket(
      league.teams, league.players, [], [], league.season, league.played,
      "summer", userTid, 42, league.competitions,
    );
    // The market actually moves players in this scenario (guard is exercised,
    // not vacuously true).
    expect(result.activeLoans.length).toBeGreaterThan(0);
    for (const loan of result.activeLoans) {
      expect(xiByTid.get(loan.parentTid)!.has(loan.pid)).toBe(false);
    }
  });

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
