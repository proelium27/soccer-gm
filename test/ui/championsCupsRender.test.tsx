import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import type { SuperCupTie } from "../../src/core/superCup/types.js";
import { playSuperCups } from "../../src/core/superCup/superCup.js";

/**
 * Render harness for the Champions Cups page.
 *
 * This repo has no DOM test environment, so a throw in a page is invisible to
 * every other kind of test here — typecheck included. Server rendering also does
 * **not** run error boundaries (React re-throws to the caller), so a throw
 * surfaces as a plain test failure regardless of the boundaries App and Layout
 * install around the router.
 *
 * Deliberately cheap: no season is simmed. The page reads super cups, clubs and
 * season history, all of which can be handed to it directly, so the three states
 * that matter — nothing on file, a tie still pending, a tie played — are reached
 * without paying for a sim.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({
    league: leagueRef.current,
    playSuperCupsAction: () => {},
  }),
}));

const { ChampionsCups } = await import("../../src/ui/pages/ChampionsCups.js");

function render(league: LeagueStore): string {
  leagueRef.current = league;
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(ChampionsCups)),
  );
}

const base = makeLeague(0, 1);

function pendingTie(league: LeagueStore, teams: [number, number]): SuperCupTie {
  return {
    competition: "domestic",
    season: league.season,
    country: league.competitions[0].country,
    compId: league.competitions[0].id,
    name: "Test Champions Cup",
    teams,
    routes: ["league-champions", "cup-winners"],
    tie: null,
  };
}

describe("Champions Cups page render", () => {
  it("says so when the save has none yet", () => {
    const html = render({ ...base, superCups: [] });
    expect(html).toContain("Champions Cups");
    expect(html).toContain("Nothing on file yet");
  });

  it("renders a pending tie with both clubs and how each got there", () => {
    const [a, b] = base.teams.map((t) => t.tid);
    const html = render({ ...base, superCups: [pendingTie(base, [a, b])] });
    expect(html).toContain("Test Champions Cup");
    expect(html).toContain("Still to be played");
    // The routes are what tell the reader why these two clubs are here, which
    // is the whole story of the competition.
    expect(html).toContain("League champions");
    expect(html).toContain("Cup winners");
    expect(html).toContain("Play the champions cups");
  });

  it("renders a played tie, and drops the play button once it is", () => {
    const [a, b] = base.teams.map((t) => t.tid);
    const superCups = playSuperCups(
      [pendingTie(base, [a, b])], base.competitions, base.teams, base.players, base.lid,
    );
    const html = render({ ...base, superCups });
    expect(html).not.toContain("Still to be played");
    expect(html).not.toContain("Play the champions cups");
  });

  it("renders an archived tie off the season history with no live one", () => {
    const [a, b] = base.teams.map((t) => t.tid);
    const played = playSuperCups(
      [{ ...pendingTie(base, [a, b]), season: base.season - 1 }],
      base.competitions, base.teams, base.players, base.lid,
    );
    const html = render({
      ...base,
      superCups: [],
      seasonHistory: [
        // Only the fields this page reads; the entry's other members are
        // irrelevant to it and building a real one would mean simming a season.
        { season: base.season - 1, superCups: played } as LeagueStore["seasonHistory"][number],
      ],
    });
    expect(html).toContain("Test Champions Cup");
    expect(html).not.toContain("Nothing on file yet");
  });
});
