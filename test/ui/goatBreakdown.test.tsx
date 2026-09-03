import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { LeagueStore } from "../../src/core/leagueState.js";
import type { SeasonHistoryEntry, StandingsRow } from "../../src/core/standings.js";
import { teamGoatRanking } from "../../src/core/frivolities/goat.js";
import { GOAT_TEAM_TREBLE_WEIGHT } from "../../src/core/constants.js";

/**
 * Render harness for the club GOAT score breakdown.
 *
 * The arithmetic is covered by `test/core/frivolities.test.ts`. What this
 * catches is the seam between the two: core emits each term under a string
 * `key`, and the UI looks that key up in its own `TERM_LABELS` map. A term with
 * no entry there falls back to printing the raw key, which renders as a
 * plausible-looking label rather than an error, and a typecheck can't see it
 * because the map is a `Record<string, string>` that accepts any key.
 *
 * So the components fed in here are the real output of `teamGoatRanking`,
 * not a hand-built array: that is what makes this a test of the wiring rather
 * than of the fixture.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({ league: leagueRef.current, simming: false }),
}));

const { GoatBreakdown } = await import("../../src/ui/components/GoatBreakdown.js");

function row(tid: number, points: number): StandingsRow {
  return { tid, played: 38, won: 0, drawn: 0, lost: 0, gf: 60, ga: 30, gd: 30, points };
}

function history(season: number): SeasonHistoryEntry {
  return {
    season,
    // Finishing order, which is how the sim stores a table: club 1 on top.
    table: [row(1, 90), row(2, 70)],
    compsByTid: { 1: 0, 2: 0 },
    teamStats: [], awards: {}, championTidByCompId: {},
  } as unknown as SeasonHistoryEntry;
}

/** Club 1 wins its league, the Continental Cup and its domestic cup in 2029. */
function trebleLeague(): LeagueStore {
  return {
    season: 2030,
    competitions: [{ id: 0, country: "eng", tier: 1, name: "England D1" }],
    teams: [
      { tid: 1, name: "Treble Winners", roster: [], academyRoster: [], compId: 0 },
      { tid: 2, name: "Runners Up", roster: [], academyRoster: [], compId: 0 },
    ],
    players: [], retiredPlayers: [], seasonHistory: [history(2029)], transfers: [],
    cupHistory: [{ season: 2029, championTid: 1 }],
    domesticCupHistory: [{ season: 2029, championTid: 1 }],
  } as unknown as LeagueStore;
}

function render(league: LeagueStore): string {
  leagueRef.current = league;
  const club = teamGoatRanking(league).find((r) => r.tid === 1)!;
  expect(club.trebles).toBe(1);
  return renderToStaticMarkup(
    createElement(MemoryRouter, null,
      createElement(GoatBreakdown, { components: club.components, score: club.score })),
  );
}

describe("club GOAT score breakdown", () => {
  it("labels the treble line instead of falling back to its raw key", () => {
    const html = render(trebleLeague());
    expect(html).toContain("treble (league, Continental Cup and domestic cup in one season)");
    // The fallback would print the bare key followed by the same colon.
    expect(html).not.toContain("trebles: 1 x");
  });

  it("shows the treble's arithmetic, at the weight the constant sets", () => {
    const html = render(trebleLeague());
    expect(html).toContain(`1 x ${GOAT_TEAM_TREBLE_WEIGHT}`);
  });

  it("drops the treble line for a club that never won one", () => {
    // Same three trophies, spread across two seasons instead of one. A zero
    // term must not render as "0 x 150", which reads as a bug rather than a
    // club that simply hasn't done it.
    const league = trebleLeague();
    league.cupHistory = [{ season: 2028, championTid: 1 }] as LeagueStore["cupHistory"];
    leagueRef.current = league;
    const club = teamGoatRanking(league).find((r) => r.tid === 1)!;
    expect(club.trebles).toBe(0);

    const html = renderToStaticMarkup(
      createElement(MemoryRouter, null,
        createElement(GoatBreakdown, { components: club.components, score: club.score })),
    );
    expect(html).not.toContain("treble (league");
    // Not a substring check on the weight: the Continental Cup is also worth
    // 150, so "x 150" matches its line too. The component total is the
    // unambiguous statement that no bonus was added: 100 + 150 + 40.
    const trophies = club.components.find((c) => c.key === "trophies")!;
    expect(trophies.points).toBe(290);
  });
});
