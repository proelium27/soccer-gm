import { describe, expect, it, vi } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import type { ArchivedPlayer } from "../../src/core/players/archive.js";
import { emptyTotals, emptyBestSeasons, ALL_TIME_STAT_KEYS } from "../../src/core/frivolities/stats.js";
import { ALL_TIME_OVERVIEW_LIMIT } from "../../src/core/frivolities/leaders.js";
import { INTL_ALL_TIME_KEYS, INTL_OVERVIEW_LIMIT } from "../../src/core/frivolities/international.js";
import { STAT_LABELS } from "../../src/ui/statLabels.js";

/**
 * Render harness for Frivolities' two summary grids, All-Time Leaders and
 * International.
 *
 * The rankings themselves are covered by `test/core/frivolities.test.ts`; what
 * this pins is the summary view — every stat gets a card, and no card runs past
 * the overview limit. That limit is the whole point of the grids: a single
 * uncapped board is what they replaced.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({ league: leagueRef.current, simming: false }),
}));

const { LeadersTab, InternationalTab } = await import("../../src/ui/pages/Frivolities.js");

function render(league: LeagueStore, Tab: ComponentType): string {
  leagueRef.current = league;
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(Tab)),
  );
}

/**
 * A retiree with a career total in every ranked stat and an international
 * record, so no board on either grid comes back empty.
 */
function archived(pid: number, name: string, goals: number): ArchivedPlayer {
  const totals = emptyTotals();
  for (const k of ALL_TIME_STAT_KEYS) totals[k] = goals;
  totals.appearances = 400;
  totals.avgRating = 7.2;
  return {
    pid, name, nationality: "esp", pos: "ST", born: 1994, heightCm: 183,
    retiredSeason: 2031, retiredAge: 37, firstSeason: 2016, seasonsPlayed: 15,
    peakOvr: 88, peakSeason: 2024, finalOvr: 70, clubs: [1],
    seasons: [{ season: 2028, tid: 1, ovr: 88, apps: 38 }],
    totals,
    best: emptyBestSeasons(),
    caps: goals, intlGoals: goals, intlTitles: 1,
  } as ArchivedPlayer;
}

describe("All-Time Leaders grid", () => {
  it("gives every ranked stat a card that opens its full board", () => {
    const league = makeLeague(0, 1);
    league.retiredPlayers = [archived(999001, "Old Hand", 250)];

    const html = render(league, LeadersTab);
    for (const k of ALL_TIME_STAT_KEYS) {
      expect(html).toContain(STAT_LABELS[k]);
    }
    // One "Full list" affordance per stat, and nothing else on the tab uses it.
    expect(html.split("Full list").length - 1).toBe(ALL_TIME_STAT_KEYS.length);
    expect(html).toContain("Old Hand");
  });

  it("shows no more than the overview limit of rows on any card", () => {
    const league = makeLeague(0, 1);
    // Twice the overview limit of ranked careers, all with a goals total, so a
    // card that failed to slice would visibly run past ten.
    league.retiredPlayers = Array.from(
      { length: ALL_TIME_OVERVIEW_LIMIT * 2 },
      (_, i) => archived(999001 + i, `Retiree ${i}`, 300 - i),
    );

    const html = render(league, LeadersTab);
    expect(html).toContain("Retiree 0");
    // Ranked 11th on goals and so past the cut on every board.
    expect(html).not.toContain(`Retiree ${ALL_TIME_OVERVIEW_LIMIT}<`);
    expect(html).not.toContain(`Retiree ${ALL_TIME_OVERVIEW_LIMIT + 1}<`);
  });
});

describe("International grid", () => {
  it("gives every counter a card that opens its full board", () => {
    const league = makeLeague(0, 1);
    league.retiredPlayers = [archived(999001, "Old Hand", 250)];

    const html = render(league, InternationalTab);
    expect(html).toContain("Goals");
    expect(html).toContain("Caps");
    expect(html).toContain("World Cups");
    expect(html.split("Full list").length - 1).toBe(INTL_ALL_TIME_KEYS.length);
    // The board this grid exists for: a nation's record holder is usually
    // retired, so a retiree has to reach the cards.
    expect(html).toContain("Old Hand");
  });

  it("shows no more than the overview limit of rows on any card", () => {
    const league = makeLeague(0, 1);
    league.retiredPlayers = Array.from(
      { length: INTL_OVERVIEW_LIMIT * 2 },
      (_, i) => archived(999001 + i, `Retiree ${i}`, 300 - i),
    );

    const html = render(league, InternationalTab);
    expect(html).toContain("Retiree 0");
    expect(html).not.toContain(`Retiree ${INTL_OVERVIEW_LIMIT}<`);
  });
});
