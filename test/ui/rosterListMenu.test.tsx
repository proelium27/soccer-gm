import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import { transferWindowState } from "../../src/core/transfers/window.js";

/**
 * Render harness for the Roster page's List menu (same pattern as
 * transfersRender: mock useLeague, render to static markup, a throw is a
 * failure). Transfer and loan listings share one dropdown, so what's pinned
 * here is that both actions are reachable from every squad row, that an
 * existing listing reads back, and that a blocked loan states its reason as
 * the item label — the things a wiring slip would silently break.
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

describe("Roster List menu", () => {
  it("offers both listings from one control on every squad row", () => {
    expect(transferWindowState(base).open).toBe(true);
    const html = render(base);
    // One menu per squad player: the XI table, the bench table and each pitch
    // chip's popover all render the same control.
    const menus = (html.match(/>List<\/button>/g) ?? []).length;
    expect(menus).toBeGreaterThanOrEqual(base.teams[0].roster.length);
    expect(html).toContain("List for transfer");
    expect(html).toContain("List for loan (1 season)");
  });

  it("reads an existing loan listing back from the same state the Loans page uses", () => {
    const pid = base.teams[0].roster[base.teams[0].roster.length - 1];
    const html = render({ ...base, loanListings: [{ pid, seasons: 1 }] });
    expect(html).toContain("Remove loan listing");
    expect(html).toContain("Listed for a 1 season loan.");
  });

  it("reads an existing transfer listing back", () => {
    const team = base.teams[0];
    const pid = team.roster[0];
    const html = render({
      ...base,
      teams: base.teams.map((t) => (t.tid === team.tid ? { ...t, transferListed: [pid] } : t)),
    });
    expect(html).toContain("Remove transfer listing");
  });

  it("says why the loan is unavailable when the transfer window is shut", () => {
    // Autumn, after the summer window shuts and before winter opens: the next
    // unplayed matchday is what decides it, so drop the early ones.
    const closed: LeagueStore = {
      ...base,
      phase: "regular",
      schedule: base.schedule.filter((g) => g.matchday >= 10),
    };
    expect(transferWindowState(closed).open).toBe(false);
    const html = render(closed);
    expect(html).toContain("Loans need an open window");
    expect(html).not.toContain("List for loan (1 season)");
    // Selling isn't window-gated in the UI, so that half stays available.
    expect(html).toContain("List for transfer");
  });
});
