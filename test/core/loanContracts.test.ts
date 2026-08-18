import { describe, it, expect } from "vitest";
import { makeLeague } from "../helpers/league.js";
import {
  listPlayerForLoan, maxLoanSeasons, loanOutlivesContract,
} from "../../src/core/loans.js";
import { runAIContractRenewals } from "../../src/core/ai/renewals.js";
import { releaseExpiredContracts, freeAgentPids } from "../../src/core/freeAgency.js";
import { transferWindowState } from "../../src/core/transfers/window.js";
import { createLeagueState, type LeagueStore } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { tierOf } from "../../src/core/competitions.js";
import { mulberry32 } from "../../src/engine/rng.js";

/**
 * A loan deliberately leaves the contract alone — it travels with the player
 * and comes home with him (see `executeLoan`). That let contract expiry and
 * loans collide, and they did: `releaseExpiredContracts` ran *before*
 * `processLoanReturns`, so a player whose deal died while he was away was
 * dropped off the *loanee's* roster (leaving him on no roster at all, while
 * `freeAgentPids` still counted him as rostered because he was on loan) and
 * then handed back to his parent still carrying the dead contract. Measured
 * across six real player saves: 71-281 stale contracts each, 100% of them loan
 * returns — see docs/player-save-findings.md #2.
 */
describe("a contract that expires while the player is out on loan", () => {
  it("keeps him on the loanee's roster rather than stranding him on none", () => {
    const league = makeLeague(0, 1);
    const parent = league.teams.find((t) => t.tid !== league.meta.userTid)!;
    const loanee = league.teams.find(
      (t) => t.tid !== league.meta.userTid && t.tid !== parent.tid,
    )!;
    const pid = parent.roster[0];
    const players = league.players.map((p) =>
      p.pid === pid ? { ...p, contract: { ...p.contract, expiresSeason: league.season } } : p,
    );
    const teams = league.teams.map((t) => {
      if (t.tid === parent.tid) return { ...t, roster: t.roster.filter((r) => r !== pid) };
      if (t.tid === loanee.tid) return { ...t, roster: [...t.roster, pid] };
      return t;
    });

    // The loan still has a season to run, so expiry must not touch him.
    const after = releaseExpiredContracts(teams, players, league.season, new Set([pid]));
    expect(after.find((t) => t.tid === loanee.tid)!.roster).toContain(pid);

    // Without the loan set he is exactly the bug: off the loanee, on nobody.
    const stranded = releaseExpiredContracts(teams, players, league.season);
    expect(stranded.some((t) => t.roster.includes(pid))).toBe(false);
  });

  it("comes home and has his contract settled in the same rollover", () => {
    // The reported case: a player loaned out on a deal that dies while he's
    // away. He must never sit on a roster carrying a dead contract, and never
    // land in limbo either — on no roster and not signable.
    const rng = mulberry32(7);
    const base = createLeagueState(0, rng);
    const userTid = base.meta.userTid;
    const user = base.teams.find((t) => t.tid === userTid)!;
    // The parent is the user's club, which AI renewals never touch, so nothing
    // can quietly rescue the contract and hide the bug.
    const loanee = base.teams.find(
      (t) => t.tid !== userTid && tierOf(base.competitions, t.compId) === 1,
    )!;
    const pid = user.roster[user.roster.length - 1];
    const players = base.players.map((p) =>
      p.pid === pid
        ? { ...p, born: base.season - 22, contract: { ...p.contract, expiresSeason: base.season } }
        : p,
    );
    const teams = base.teams.map((t) => {
      if (t.tid === userTid) return { ...t, roster: t.roster.filter((r) => r !== pid) };
      if (t.tid === loanee.tid) return { ...t, roster: [...t.roster, pid] };
      return t;
    });
    let league: LeagueStore = {
      ...base,
      players,
      teams,
      activeLoans: [{
        pid, parentTid: userTid, loaneeTid: loanee.tid,
        startSeason: base.season, seasons: 2, returnSeason: base.season + 2, fee: 0,
      }],
    };

    for (let s = 0; s < 2; s++) {
      league = simThrough(league, "season", rng);
      league = simOffseason(league, rng);

      // Nobody anywhere is rostered on a contract that has already expired —
      // the exact ERROR scripts/playerSaveAudit.ts reports.
      const byPid = new Map(league.players.map((p) => [p.pid, p]));
      for (const t of league.teams) {
        for (const r of t.roster) {
          const p = byPid.get(r);
          if (!p) continue;
          expect(
            p.contract.expiresSeason,
            `pid ${r} rostered at tid ${t.tid} on a contract that expired in ${p.contract.expiresSeason}`,
          ).toBeGreaterThanOrEqual(league.season);
        }
      }

      const rosteredAt = league.teams.filter((t) => t.roster.includes(pid));
      expect(rosteredAt.length).toBeLessThanOrEqual(1);
      if (league.activeLoans.some((l) => l.pid === pid)) {
        // Mid-loan: still playing for the club that borrowed him, not nowhere.
        expect(rosteredAt.map((t) => t.tid)).toEqual([loanee.tid]);
      } else if (rosteredAt.length === 0) {
        // Released — then he's a real free agent anyone can sign, not invisible.
        expect(freeAgentPids(league.teams, league.players, league.activeLoans).has(pid)).toBe(true);
      }
    }
    // Either way the loan is over by now.
    expect(league.activeLoans.some((l) => l.pid === pid)).toBe(false);
  });
});

describe("renewals follow ownership, not the roster he happens to sit on", () => {
  /** Put pid on the loanee's roster on a cheap final-year deal. */
  function lend(league: LeagueStore, pid: number, parentTid: number, loaneeTid: number) {
    const players = league.players.map((p) =>
      p.pid === pid ? { ...p, contract: { salary: 1, expiresSeason: league.season + 1 } } : p,
    );
    const teams = league.teams.map((t) => {
      if (t.tid === parentTid) return { ...t, roster: t.roster.filter((r) => r !== pid) };
      if (t.tid === loaneeTid) return { ...t, roster: [...t.roster, pid] };
      return t;
    });
    const activeLoans = [{
      pid, parentTid, loaneeTid, startSeason: league.season, seasons: 1,
      returnSeason: league.season + 1, fee: 0,
    }];
    return { players, teams, activeLoans };
  }

  it("renews a player his club has sent out, though he's on no roster of its own", () => {
    const league = makeLeague(0, 3);
    const parent = league.teams.find((t) => t.tid !== league.meta.userTid)!;
    const loanee = league.teams.find(
      (t) => t.tid !== league.meta.userTid && t.tid !== parent.tid,
    )!;
    const pid = parent.roster[0];
    const { players, teams, activeLoans } = lend(league, pid, parent.tid, loanee.tid);

    const out = runAIContractRenewals(
      teams, players, league.season + 1, league.meta.userTid, league.played,
      99, league.competitions, activeLoans,
    );
    // A salary of 1 clears AI_RENEWAL_MARGIN against any valuation, so the only
    // way this contract stays put is if nobody ever considered him.
    expect(out.players.find((p) => p.pid === pid)!.contract.expiresSeason)
      .toBeGreaterThan(league.season + 1);
  });

  it("doesn't let a club renew a player it has only borrowed", () => {
    const league = makeLeague(0, 3);
    const userTid = league.meta.userTid;
    const user = league.teams.find((t) => t.tid === userTid)!;
    const loanee = league.teams.find((t) => t.tid !== userTid)!;
    const pid = user.roster[0];
    const { players, teams, activeLoans } = lend(league, pid, userTid, loanee.tid);

    const out = runAIContractRenewals(
      teams, players, league.season + 1, userTid, league.played,
      99, league.competitions, activeLoans,
    );
    // He's the user's player. The AI club borrowing him gets no say, so the
    // deal is untouched and the user extends him himself (Loans page).
    expect(out.players.find((p) => p.pid === pid)!.contract.expiresSeason)
      .toBe(league.season + 1);
  });
});

describe("maxLoanSeasons", () => {
  it("caps a loan at the seasons the player's contract actually covers", () => {
    const league = makeLeague(0, 1);
    const p = league.players.find((q) => league.teams[0].roster.includes(q.pid))!;
    const twoLeft = { ...p, contract: { ...p.contract, expiresSeason: league.season + 1 } };

    expect(maxLoanSeasons(twoLeft, league.season)).toBe(2);
    expect(loanOutlivesContract(twoLeft, league.season, 2)).toBe(false);
    expect(loanOutlivesContract(twoLeft, league.season, 3)).toBe(true);
    // Already expired: he can't be loaned at all.
    const gone = { ...p, contract: { ...p.contract, expiresSeason: league.season - 1 } };
    expect(maxLoanSeasons(gone, league.season)).toBe(0);
  });

  it("refuses to list a loan that would outlast the contract", () => {
    const league = makeLeague(0, 1);
    const userTid = league.meta.userTid;
    const user = league.teams.find((t) => t.tid === userTid)!;
    const ws = transferWindowState(league);
    expect(ws.open).toBe(true);

    // Someone the depth floor actually allows out, so the only thing under
    // test is the contract rule.
    const pid = user.roster.find((r) => listPlayerForLoan(league, r, 1).loanListings.length === 1)!;
    const withShortDeal: LeagueStore = {
      ...league,
      players: league.players.map((p) =>
        p.pid === pid ? { ...p, contract: { ...p.contract, expiresSeason: ws.season! } } : p,
      ),
    };

    // One season is exactly what his deal covers; three is not.
    expect(listPlayerForLoan(withShortDeal, pid, 3).loanListings).toEqual([]);
    expect(listPlayerForLoan(withShortDeal, pid, 1).loanListings).toEqual([{ pid, seasons: 1 }]);
  });
});
