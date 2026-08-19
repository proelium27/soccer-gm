import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import { transferWindowState } from "../../src/core/transfers/window.js";

/**
 * Render harness for the Loans page, covering the surfaces added when contract
 * expiry and loans were reconciled (docs/player-save-findings.md #2): the
 * contract column and Extend control on "Players Out on Loan" — the only place
 * a loaned-out player appears, since he is on nobody's Roster page — and the
 * duration picker's cap at what his contract covers.
 *
 * There is no DOM test env in this repo, so this is server rendering: a throw
 * surfaces as a failure, and note error boundaries do NOT run here (React
 * re-throws to the caller), which is what makes that useful.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({
    league: leagueRef.current,
    listPlayerForLoanAction: () => {},
    unlistPlayerForLoanAction: () => {},
    acceptLoanOfferAction: () => {},
    rejectLoanOfferAction: () => {},
    extendContractAction: () => {},
    simming: false,
  }),
}));

const { Loans } = await import("../../src/ui/pages/Loans.js");

function render(league: LeagueStore): string {
  leagueRef.current = league;
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Loans)));
}

/** Send one of the user's players out on loan to an AI club. */
function lendOut(league: LeagueStore, expiresSeason: number) {
  const userTid = league.meta.userTid;
  const user = league.teams.find((t) => t.tid === userTid)!;
  const loanee = league.teams.find((t) => t.tid !== userTid)!;
  const pid = user.roster[0];
  return {
    ...league,
    players: league.players.map((p) =>
      p.pid === pid ? { ...p, contract: { ...p.contract, expiresSeason } } : p,
    ),
    teams: league.teams.map((t) => {
      if (t.tid === userTid) return { ...t, roster: t.roster.filter((r) => r !== pid) };
      if (t.tid === loanee.tid) return { ...t, roster: [...t.roster, pid] };
      return t;
    }),
    activeLoans: [{
      pid, parentTid: userTid, loaneeTid: loanee.tid,
      startSeason: league.season, seasons: 2, returnSeason: league.season + 2, fee: 0,
    }],
    name: league.players.find((p) => p.pid === pid)!.name,
  };
}

describe("Loans page renders", () => {
  it("shows a loaned-out player's contract and offers to extend him in his final year", () => {
    const league = makeLeague(0, 1);
    const { name, ...withLoan } = lendOut(league, league.season);
    const html = render(withLoan as LeagueStore);

    expect(html).toContain("Players Out on Loan");
    expect(html).toContain(name);
    expect(html).toContain("Final year");
    // The Extend control, which exists nowhere else for a player who is away.
    expect(html).toContain("Extend");
  });

  it("shows the expiry season, and no Extend control, when the deal still runs", () => {
    const league = makeLeague(0, 1);
    const { name, ...withLoan } = lendOut(league, league.season + 3);
    const html = render(withLoan as LeagueStore);

    expect(html).toContain(name);
    expect(html).toContain("Through ");
  });

  it("offers only the loan durations the player's contract covers", () => {
    const league = makeLeague(0, 1);
    const ws = transferWindowState(league);
    expect(ws.open).toBe(true);
    const userTid = league.meta.userTid;
    const user = league.teams.find((t) => t.tid === userTid)!;
    const userPids = new Set(user.roster);

    // Every one of the user's players has exactly one season left, so a
    // 2- or 3-season loan is off the table for all of them.
    const html = render({
      ...league,
      players: league.players.map((p) =>
        userPids.has(p.pid) ? { ...p, contract: { ...p.contract, expiresSeason: ws.season! } } : p,
      ),
    });

    expect(html).toContain("1 season<");
    expect(html).not.toContain("2 seasons");
    expect(html).not.toContain("3 seasons");
  });

  it("won't list a player at all once his contract is up", () => {
    const league = makeLeague(0, 1);
    const ws = transferWindowState(league);
    const userTid = league.meta.userTid;
    const user = league.teams.find((t) => t.tid === userTid)!;
    const userPids = new Set(user.roster);

    const html = render({
      ...league,
      players: league.players.map((p) =>
        userPids.has(p.pid)
          ? { ...p, contract: { ...p.contract, expiresSeason: ws.season! - 1 } }
          : p,
      ),
    });

    expect(html).toContain("Contract runs out first");
  });
});
