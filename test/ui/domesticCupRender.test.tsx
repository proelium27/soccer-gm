import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import { advanceDomesticCup, pendingRound } from "../../src/core/domesticCup/cup.js";
import type { CupTie } from "../../src/core/cup/types.js";

/**
 * Render harness for the Domestic Cup page. There is no DOM test env in this
 * repo, so this is the cheapest thing that catches a page-level throw — and
 * server rendering does NOT run error boundaries (React re-throws to the
 * caller), so a crash surfaces here as a failure rather than as a fallback.
 *
 * Covers the three states the page has to handle: a save with no cups at all
 * (old save, pre-feature), a freshly drawn cup, and a finished one with a
 * champion and a season of history to select.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({ league: leagueRef.current, simming: false }),
}));

const { DomesticCup } = await import("../../src/ui/pages/DomesticCup.js");

function render(league: LeagueStore): string {
  leagueRef.current = league;
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(DomesticCup)),
  );
}

/** Play out every round by letting the home side through, without a match sim. */
function playOut(league: LeagueStore): LeagueStore {
  const cups = league.domesticCups.map((cup) => {
    let c = cup;
    for (let round = pendingRound(c); round !== null; round = pendingRound(c)) {
      const ties: CupTie[] = round.pairings.map((p) => ({
        round: round.round, matchday: round.matchday, home: p.home, away: p.away,
        homeGoals: 1, awayGoals: 0, wentToExtraTime: false, wentToPens: false,
        homePens: 0, awayPens: 0, winner: p.home, boxScore: null,
      }));
      c = advanceDomesticCup(c, league.competitions, ties);
    }
    return c;
  });
  return { ...league, domesticCups: cups };
}

describe("Domestic Cup page render", () => {
  const base = makeLeague(0, 1);

  it("explains itself on a save that has no cups yet", () => {
    const html = render({ ...base, domesticCups: [], domesticCupHistory: [] });
    expect(html).toContain("Domestic Cup");
    expect(html).toContain("next season");
  });

  it("renders a freshly drawn cup with its preliminary round", () => {
    const html = render(base);
    expect(html).toContain("English Cup");
    expect(html).toContain("Preliminary round");
    // The byes are explained rather than left as a silent gap in the field.
    expect(html).toContain("clubs enter in the next round");
  });

  it("renders a completed cup with its winners and every round", () => {
    const played = playOut(base);
    const html = render(played);
    expect(html).toContain("Winners");
    expect(html).toContain("Round of 32");
    expect(html).toContain("Quarter-final");
    expect(html).toContain("Semi-final");
    expect(html).toContain("Final");
    const champion = played.domesticCups[0].championTid!;
    expect(html).toContain(played.teams.find((t) => t.tid === champion)!.name);
  });

  it("renders an archived cup from a past season with no live cup", () => {
    const played = playOut(base);
    const html = render({
      ...played,
      season: 2,
      domesticCups: [],
      domesticCupHistory: played.domesticCups,
    });
    expect(html).toContain("English Cup");
    expect(html).toContain("Winners");
  });
});
