import { describe, expect, it, vi } from "vitest";
import { playSeason } from "../helpers/offseasonLeague.js";
import { makeLeague } from "../helpers/league.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createLeagueState, type LeagueStore } from "../../src/core/leagueState.js";
import { simOffseason } from "../../src/core/offseason.js";
import { mulberry32 } from "../../src/engine/rng.js";
import { transferWindowState } from "../../src/core/transfers/window.js";
import { FREE_AGENT_TID } from "../../src/core/transfers/negotiation.js";

/**
 * Render harness for the Transfers page: covers the render paths pure-function
 * tests can't reach (NegotiationControls in each status, the orphaned-talks
 * table, the completed-this-window list including the free-agent sentinel).
 *
 * A throw here surfaces as a test failure. Note server rendering does NOT run
 * error boundaries — React re-throws to the caller — so this sees raw throws
 * regardless of the boundaries App/Layout now install around the router.
 *
 * The simmed league is built ONCE and cloned per case: each season costs ~20s of
 * real sim, and simming per case put this file at ~7 minutes on its own.
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

/**
 * A simmed league, built at most once for the whole file and cloned per case.
 *
 * Two things about the cost are worth knowing before changing this. It is built
 * **lazily**, not at module scope: a module-scope sim is billed to vitest's
 * *collect* phase, so it runs even for the cases below that only want a fresh
 * `makeLeague` world, and it is invisible in the reported per-test timings (this
 * file read as 2.8s of tests behind 132s of "collection"). And the cost is
 * entirely the sim, not the renders — every render here is single-digit
 * milliseconds, so the only lever on this file's runtime is how many seasons
 * get simmed.
 *
 * Two seasons, therefore, rather than the three this used to chain. The three
 * cases asserted the identical two things about leagues differing only in age,
 * so the question is purely how old a league has to be to exercise the render
 * paths an aged one reaches. Measured on this seed, the answer is two: the
 * free-agent sentinel rows this file exists to check (`fromTid` of -1, which
 * must read "Free agent" and never "Team -1") number 1 after one season and
 * 1355 after two, and transfer rows whose pid has since retired — the ones that
 * render by bare pid — go 1 to 41. A third season only adds more of the same,
 * so it buys nothing this file asserts. Drop to one season and the sentinel
 * path is effectively only covered by the row the case pushes by hand.
 */
const SIMMED_SEASONS = 2;
let simmedCache: LeagueStore | null = null;

function simmedSnapshot(): LeagueStore {
  if (simmedCache) return simmedCache;
  const rng = mulberry32(4242);
  let league = createLeagueState(0, rng);
  for (let i = 0; i < SIMMED_SEASONS; i++) {
    league = playSeason(league, rng);
    league = simOffseason(league, rng);
  }
  simmedCache = { ...league, phase: "offseason" };
  return simmedCache;
}

/** A fresh world plus `SIMMED_SEASONS` fully simmed seasons, left in the offseason. */
function simmedLeague(): LeagueStore {
  return structuredClone(simmedSnapshot());
}

describe("Transfers page render", () => {
  it("renders a fresh league with the summer window open", () => {
    const league = makeLeague(0, 12345);
    league.phase = "offseason";
    expect(render(league)).toContain("Recommended Transfers");
  });

  it("renders with the window closed", () => {
    const league = makeLeague(0, 12345);
    league.phase = "regular";
    // A fresh league sits at matchday 0, where the summer window is still open
    // through matchday 4. Drop the early fixtures so the next unplayed matchday
    // lands between the two windows (summer shuts after 4, winter opens at 18).
    league.schedule = league.schedule.filter((g) => g.matchday >= 8);
    expect(render(league)).toContain("Transfer window closed");
  });

  it(`renders after ${SIMMED_SEASONS} simmed season(s) with live negotiations`, () => {
    const league = simmedLeague();
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
});
