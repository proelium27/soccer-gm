import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { makeLeague } from "../helpers/league.js";
import { setWatched } from "../../src/core/watchlist.js";
import type { LeagueStore } from "../../src/core/leagueState.js";

/**
 * Render harness for the Watchlist page and its star button.
 *
 * There is no DOM test env in this repo, so this reaches what a pure test of
 * `watchlistEntries` can't: that the page renders at all in each of its states,
 * and that the columns which have to ask the world about a player (his club's
 * competition, this season's line, the status cell) don't throw on the cases
 * where the answer is absent. `competitionOf` in particular *throws* on an
 * unknown compId rather than returning undefined, so a free agent going through
 * the club column is a real crash, not a blank cell.
 *
 * Server rendering does not run error boundaries — React re-throws to the
 * caller — so a throw here is a test failure rather than a fallback render.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({
    league: leagueRef.current,
    toggleWatchedAction: () => {},
    simming: false,
  }),
}));

const { Watchlist } = await import("../../src/ui/pages/Watchlist.js");
const { WatchToggle } = await import("../../src/ui/components/WatchToggle.js");

function render(league: LeagueStore): string {
  leagueRef.current = league;
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(Watchlist)),
  );
}

describe("Watchlist page", () => {
  it("says how to start one when nothing is starred", () => {
    const html = render(makeLeague(0, 5));
    expect(html).toContain("Nobody on your watchlist yet");
    expect(html).not.toContain("<table");
  });

  it("renders a rival's player, one of your own, and a free agent together", () => {
    const league = makeLeague(0, 5);
    const rival = league.teams.find((t) => t.tid !== league.meta.userTid)!;
    const mine = league.teams.find((t) => t.tid === league.meta.userTid)!;
    const rostered = new Set(league.teams.flatMap((t) => [...t.roster, ...t.academyRoster]));
    const freeAgent = league.players.find((p) => !rostered.has(p.pid));

    let l = setWatched(league, rival.roster[0], true);
    l = setWatched(l, mine.roster[0], true);
    if (freeAgent) l = setWatched(l, freeAgent.pid, true);

    const html = render(l);
    const names = l.watchlist.map(
      (pid) => l.players.find((p) => p.pid === pid)!.name,
    );
    for (const name of names) expect(html).toContain(name);
    // Your own player is labelled rather than offered for sale.
    expect(html).toContain("Yours");
    // The free-agent path is the one that would throw if the club column asked
    // competitionOf about a player with no club.
    if (freeAgent) expect(html).toContain("Free agent");
  });

  it("drops a starred pid the save no longer knows instead of rendering a blank row", () => {
    const league = makeLeague(0, 5);
    const kept = league.teams[1].roster[0];
    const html = render({ ...league, watchlist: [999999, kept] });
    expect(html).toContain(league.players.find((p) => p.pid === kept)!.name);
    expect(html).toContain("1 player.");
  });
});

describe("WatchToggle", () => {
  it("reads as pressed only when he's on the list, and says which way it goes", () => {
    const league = makeLeague(0, 5);
    const pid = league.players[0].pid;
    leagueRef.current = league;

    const off = renderToStaticMarkup(createElement(WatchToggle, { pid, name: "Someone" }));
    expect(off).toContain('aria-pressed="false"');
    expect(off).toContain("Add Someone to your watchlist");

    leagueRef.current = setWatched(league, pid, true);
    const on = renderToStaticMarkup(createElement(WatchToggle, { pid, name: "Someone" }));
    expect(on).toContain('aria-pressed="true"');
    expect(on).toContain("Remove Someone from your watchlist");
  });
});
