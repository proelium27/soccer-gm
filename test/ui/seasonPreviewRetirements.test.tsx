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

/**
 * Base for the ghost pids below. These stand for players the save has *deleted*,
 * so they must not collide with anyone `makeLeague` actually generated — the
 * "he has no page" case asserts that nothing renders a link, and a pid that
 * resolves to a live player renders one.
 *
 * It is deliberately far above any world the game could ship rather than "a bit
 * above the current player count": the original 9001-9004 were safely past the
 * 8,000-player eight-country world and then silently collided when the
 * Netherlands and Scotland took it to 10,000, turning a real assertion green-to-
 * red for a reason that had nothing to do with the code under test.
 */
const GHOST_PID = 900_000;

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
      retiree({ pid: GHOST_PID + 1, name: "Old Hand", tid: club.tid, ovr: 81, age: 36 }),
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
      total: 300, rostered: 0, notable: [retiree({ pid: GHOST_PID + 2, tid: null })],
    }));
    expect(html).toContain("Free agent");
  });

  it("doesn't link a retiree the archive didn't keep — he has no page", () => {
    const html = render(leagueWithRetirements({
      total: 5, rostered: 5, notable: [retiree({ pid: GHOST_PID + 3, name: "Gone Forever" })],
    }));
    expect(html).toContain("Gone Forever");
    expect(html).not.toContain(`href="/player/${GHOST_PID + 3}"`);
  });

  it("links one the archive did keep, since his career page exists", () => {
    const league = leagueWithRetirements({
      total: 5, rostered: 5, notable: [retiree({ pid: GHOST_PID + 4, name: "Kept Forever" })],
    });
    league.retiredPlayers = [{ pid: GHOST_PID + 4, name: "Kept Forever" } as never];
    expect(render(league)).toContain(`href="/player/${GHOST_PID + 4}"`);
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
