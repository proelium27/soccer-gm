import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import { transferWindowState } from "../../src/core/transfers/window.js";

/**
 * Render harness for the Roster page's List for Loan control (same pattern as
 * transfersRender: mock useLeague, render to static markup, a throw is a
 * failure). The button is a shortcut for the Loans page action, so what's
 * pinned here is that both roster surfaces offer it, that it reflects an
 * existing listing, and that it's disabled when the window is shut — the three
 * things a wiring slip would silently break.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({
    league: leagueRef.current,
    releasePlayerAction: () => {},
    extendContractAction: () => {},
    setTransferListedAction: () => {},
    setMoreMinutesAction: () => {},
    setLineupAction: () => {},
    setFormationAction: () => {},
    autoPickBestXIAction: () => {},
    listPlayerForLoanAction: () => {},
    unlistPlayerForLoanAction: () => {},
    simming: false,
  }),
}));

const { Roster } = await import("../../src/ui/pages/Roster.js");

function render(league: LeagueStore): string {
  leagueRef.current = league;
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Roster)));
}

const base = makeLeague(0, 1);

describe("Roster List for Loan", () => {
  it("offers the button on every squad row while the window is open", () => {
    expect(transferWindowState(base).open).toBe(true);
    const html = render(base);
    // One per squad player: the XI table, the bench table and each pitch chip's
    // popover all render the same control.
    const count = (html.match(/List for Loan/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(base.teams[0].roster.length);
    expect(html).toContain("Lists him for a 1 season loan");
    expect(html).not.toContain("Loans can only be listed while a transfer window is open.");
  });

  it("shows an existing listing as listed, from the same league state the Loans page reads", () => {
    const pid = base.teams[0].roster[base.teams[0].roster.length - 1];
    const html = render({ ...base, loanListings: [{ pid, seasons: 1 }] });
    expect(html).toContain("Listed for Loan");
  });

  it("disables the button when the transfer window is shut", () => {
    // Autumn, after the summer window shuts and before winter opens: the next
    // unplayed matchday is what decides it, so drop the early ones.
    const closed: LeagueStore = {
      ...base,
      phase: "regular",
      schedule: base.schedule.filter((g) => g.matchday >= 10),
    };
    expect(transferWindowState(closed).open).toBe(false);
    const html = render(closed);
    expect(html).toContain("List for Loan");
    expect(html).toContain("Loans can only be listed while a transfer window is open.");
  });
});
