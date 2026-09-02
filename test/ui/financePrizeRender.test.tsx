import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import { advanceDomesticCup, pendingRound } from "../../src/core/domesticCup/cup.js";
import type { CupTie } from "../../src/core/cup/types.js";

/**
 * Render harness for the Finance page's Cup Prize Money card. No DOM test env
 * here, so server rendering is the cheapest thing that catches a page-level
 * throw — and it does NOT run error boundaries, so a crash fails the test
 * rather than quietly rendering a fallback.
 *
 * The two states worth pinning are the empty one (a fresh save has played no
 * ties, and the card must say so rather than render an empty table) and the
 * populated one.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({
    league: leagueRef.current,
    setScoutingSpendAction: async () => {},
    simming: false,
  }),
}));

const { Finance } = await import("../../src/ui/pages/Finance.js");

function render(league: LeagueStore): string {
  leagueRef.current = league;
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(Finance)),
  );
}

/** Let the home side through every round, so the user's club banks real money. */
function playUserCupRounds(league: LeagueStore, rounds: number): LeagueStore {
  const userTeam = league.teams.find((t) => t.tid === league.meta.userTid)!;
  const country = league.competitions.find((c) => c.id === userTeam.compId)!.country;
  const cups = league.domesticCups.map((cup) => {
    if (cup.country !== country) return cup;
    let c = cup;
    for (let i = 0; i < rounds; i++) {
      const round = pendingRound(c);
      if (!round) break;
      const ties: CupTie[] = round.pairings.map((p) => ({
        round: round.round, matchday: round.matchday, home: p.home, away: p.away,
        homeGoals: 1, awayGoals: 0, wentToExtraTime: false, wentToPens: false,
        homePens: 0, awayPens: 0,
        // Send the user through wherever they appear, so the card has content.
        winner: p.away === league.meta.userTid ? p.away : p.home,
        boxScore: null,
      }));
      c = advanceDomesticCup(c, league.competitions, ties);
    }
    return c;
  });
  return { ...league, domesticCups: cups };
}

describe("Finance cup prize money card", () => {
  it("says nothing has been earned before a tie is played", () => {
    const html = render(makeLeague(0, 1));
    expect(html).toContain("Cup Prize Money");
    expect(html).toContain("Nothing yet this season");
  });

  it("lists what the club banked once its cup ties are played", () => {
    const league = playUserCupRounds(makeLeague(0, 1), 3);
    const html = render(league);
    expect(html).toContain("Cup Prize Money");
    expect(html).not.toContain("Nothing yet this season");
    expect(html).toContain("Total banked this season");
    // The league-prize projection is a separate card and must survive.
    expect(html).toContain("Prize money (");
  });
});
