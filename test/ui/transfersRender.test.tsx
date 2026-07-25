import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createLeagueState, type LeagueStore } from "../../src/core/leagueState.js";
import { simThrough } from "../../src/core/simThrough.js";
import { simOffseason } from "../../src/core/offseason.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { transferWindowState } from "../../src/core/transfers/window.js";
import { FREE_AGENT_TID } from "../../src/core/transfers/negotiation.js";

/**
 * Render harness for the Transfers page. The app has no error boundary above
 * the router, so any throw in this tree blanks the whole app — these cases
 * cover the render paths that pure-function tests can't reach
 * (NegotiationControls in each status, the orphaned-talks table, the
 * completed-this-window list including the free-agent sentinel).
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({
    league: leagueRef.current,
    makeOfferAction: () => {},
    acceptCounterAction: () => {},
    simming: false,
  }),
}));

const { Transfers } = await import("../../src/ui/pages/Transfers.js");

function render(league: LeagueStore): string {
  leagueRef.current = league;
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(Transfers)),
  );
}

/** A fresh world plus `seasons` fully simmed seasons, left in the offseason. */
function simmedLeague(seasons: number): LeagueStore {
  const rng = mulberry32(4242);
  let league = createLeagueState(0, rng);
  for (let i = 0; i < seasons; i++) {
    league = simThrough(league, "season", rng);
    league = simOffseason(league, rng);
  }
  league.phase = "offseason";
  return league;
}

describe("Transfers page render", () => {
  it("renders a fresh league with the summer window open", () => {
    const league = createLeagueState(0, mulberry32(12345));
    league.phase = "offseason";
    expect(render(league)).toContain("Recommended Transfers");
  });

  it("renders with the window closed", () => {
    const league = createLeagueState(0, mulberry32(12345));
    league.phase = "regular";
    // A fresh league sits at matchday 0, where the summer window is still open
    // through matchday 4. Drop the early fixtures so the next unplayed matchday
    // lands between the two windows (summer shuts after 4, winter opens at 18).
    league.schedule = league.schedule.filter((g) => g.matchday >= 8);
    expect(render(league)).toContain("Transfer window closed");
  });

  for (const seasons of [1, 2, 3]) {
    it(`renders after ${seasons} simmed season(s) with live negotiations`, () => {
      const league = simmedLeague(seasons);
      const ws = transferWindowState(league);
      // Narrows the discriminated union so season/window aren't nullable below;
      // the offseason always has the summer window open.
      if (!ws.open) throw new Error("expected the summer window to be open");

      // One negotiation in each status, on players from other clubs. Picking
      // from distinct clubs keeps them off the user's roster.
      const others = league.teams.filter((t) => t.tid !== league.meta.userTid);
      const pids = others.slice(0, 3).map((t) => t.roster[0]);
      const statuses = ["open", "accepted", "collapsed"] as const;
      league.negotiations = pids.map((pid, i) => ({
        pid,
        sellerTid: others[i].tid,
        season: ws.season,
        window: ws.window,
        offers: i === 0 ? [] : [1_000_000 * (i + 1)],
        counter: i === 2 ? null : 5_000_000,
        status: statuses[i],
      }));

      // A completed free-agent arrival: fromTid is the sentinel, which must
      // render as "Free agent" rather than "Team -1".
      league.transfers.push({
        pid: pids[0],
        fromTid: FREE_AGENT_TID,
        toTid: league.meta.userTid,
        fee: 0,
        season: ws.season,
        window: ws.window,
      });

      const html = render(league);
      expect(html).toContain("Recommended Transfers");
      expect(html).not.toContain("Team -1");
    });
  }
});
