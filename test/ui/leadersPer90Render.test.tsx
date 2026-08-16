import { describe, expect, it, vi } from "vitest";
import { makeLeague } from "../helpers/league.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { type LeagueStore } from "../../src/core/leagueState.js";
import { emptySeasonStats } from "../../src/core/players/types.js";

/**
 * Renders the Stat Leaders page far enough to prove the Totals / Per 90 control
 * is wired in and the board still draws around it.
 *
 * The mode is component state and there's no DOM test env here, so this can
 * only see the default (Totals) render — the ranking and both qualifiers are
 * covered directly in leadersBoard.test.ts. What this catches is the thing
 * those can't: the page throwing, or the toggle silently not being rendered.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({ league: leagueRef.current, simming: false }),
}));

const { Leaders } = await import("../../src/ui/pages/Leaders.js");

function render(league: LeagueStore): string {
  leagueRef.current = league;
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(Leaders)),
  );
}

/** A league with one season of recorded stats, so the board has rows to draw. */
function leagueWithStats(): LeagueStore {
  const league = makeLeague(0, 7);
  const comp = league.competitions[0];
  const tids = league.teams.filter((t) => t.compId === comp.id).map((t) => t.tid);
  league.players.slice(0, 40).forEach((p, i) => {
    p.stats = [
      {
        ...emptySeasonStats(league.season, tids[i % tids.length]),
        appearances: 20 + (i % 10),
        goals: 1 + (i % 15),
        assists: i % 7,
        minutesPlayed: 400 + i * 60,
        avgRating: 6.5 + (i % 10) / 10,
        ratingSum: 0,
      },
    ];
  });
  return league;
}

describe("Stat Leaders per-90 control", () => {
  it("renders both modes of the toggle", () => {
    const html = render(leagueWithStats());
    expect(html).toContain("Per 90");
    expect(html).toContain("Totals");
  });

  it("defaults to totals, so no column is labelled as a rate", () => {
    const html = render(leagueWithStats());
    expect(html).not.toContain("/90<");
  });

  it("still draws the leaders table", () => {
    const html = render(leagueWithStats());
    expect(html).toContain("Stat Leaders");
    expect(html).toContain("<tbody>");
  });
});
