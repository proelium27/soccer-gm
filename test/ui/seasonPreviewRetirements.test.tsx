import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import type { SeasonHistoryEntry } from "../../src/core/standings.js";
import type { RetiredPlayer, RetirementSummary } from "../../src/core/players/retirements.js";

/**
 * The Season Preview's farewell list, rendered from the persisted snapshot.
 *
 * The players it names are deleted from the save by the time this runs, which is
 * the whole reason the snapshot exists — so the interesting cases are the
 * absent-record one (old saves) and the fact that nothing here may try to look a
 * retiree up in `league.players`.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({ league: leagueRef.current, simming: false }),
}));

const { SeasonPreview } = await import("../../src/ui/pages/SeasonPreview.js");

function retiree(over: Partial<RetiredPlayer> & { pid: number }): RetiredPlayer {
  return {
    name: `Retiree ${over.pid}`, nationality: "eng", pos: "ST", age: 35, ovr: 70,
    tid: null, seasonsPlayed: 12, appearances: 300, goals: 90, assists: 40, caps: 0,
    ...over,
  };
}

/** A league in season 2 whose season-1 history entry carries `retirements`. */
function leagueWithRetirements(retirements: RetirementSummary | undefined): LeagueStore {
  const league = makeLeague(0, 99);
  league.season = 2;
  league.seasonHistory = [{
    season: 1,
    table: [],
    teamStats: [],
    awards: {},
    world: { ballonDOr: [], worldTeamOfYear: [] },
    compsByTid: {},
    championTidByCompId: {},
    ...(retirements ? { retirements } : {}),
  } as unknown as SeasonHistoryEntry];
  return league;
}

function render(league: LeagueStore): string {
  leagueRef.current = league;
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(SeasonPreview)),
  );
}

describe("Season Preview retirements", () => {
  it("names each retiree with the club he last played for", () => {
    const league = leagueWithRetirements({ total: 812, rostered: 46, notable: [] });
    const club = league.teams[0];
    league.seasonHistory[0].retirements!.notable = [
      retiree({ pid: 9001, name: "Old Hand", tid: club.tid, ovr: 81, age: 36 }),
    ];
    const html = render(league);

    expect(html).toContain("Old Hand");
    expect(html).toContain(club.name);
    // The headline count is the true total, not the length of the shown list.
    expect(html).toContain("812 players retired");
    expect(html).toContain("46 of");
  });

  it("marks an unsigned retiree as a free agent instead of blanking the club", () => {
    const html = render(leagueWithRetirements({
      total: 300, rostered: 0, notable: [retiree({ pid: 9002, tid: null })],
    }));
    expect(html).toContain("Free agent");
  });

  it("never tries to link a retiree's profile — he no longer exists", () => {
    const html = render(leagueWithRetirements({
      total: 5, rostered: 5, notable: [retiree({ pid: 9003, name: "Gone Forever" })],
    }));
    expect(html).toContain("Gone Forever");
    expect(html).not.toContain('href="/player/9003"');
  });

  it("says so plainly when the save has no record for that offseason", () => {
    const html = render(leagueWithRetirements(undefined));
    expect(html).toContain("No retirement record");
  });

  it("handles an offseason where nobody retired", () => {
    const html = render(leagueWithRetirements({ total: 0, rostered: 0, notable: [] }));
    expect(html).toContain("Nobody hung up their boots");
  });
});
