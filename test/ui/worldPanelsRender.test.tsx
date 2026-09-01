import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import type { CupState, CupTie } from "../../src/core/cup/types.js";
import type { IntlTournament } from "../../src/core/international/types.js";
import { SPECTATOR_TID } from "../../src/core/spectator.js";

// `ClubLink` resolves a club through the league context, so the panels can't
// render without one.
const leagueRef: { current: LeagueStore | null } = { current: null };
vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({ league: leagueRef.current, simming: false }),
}));

const {
  PowerRankingPanel, CupBracketPanel, InternationalBracketPanel,
} = await import("../../src/ui/pages/worldPanels.js");

/**
 * Render harness for the dashboard's world panels.
 *
 * These are all "which branch am I in" components — a cup that hasn't been
 * drawn, one still in its league phase, one with a bracket, a World Cup
 * offseason, a confederation one, and a plain qualifying year that must show
 * nothing at all. Reaching the last three by simulation would mean playing four
 * seasons for one assertion each, so they are built as fixtures.
 */
function render(element: React.ReactElement, league?: LeagueStore): string {
  if (league) leagueRef.current = league;
  return renderToStaticMarkup(createElement(MemoryRouter, null, element));
}

function tie(round: number, home: number, away: number, hg: number, ag: number): CupTie {
  return {
    round, matchday: 30, home, away, homeGoals: hg, awayGoals: ag,
    wentToExtraTime: false, wentToPens: false, homePens: 0, awayPens: 0,
    winner: hg > ag ? home : away, boxScore: null,
  };
}

describe("world panels: power rankings", () => {
  it("ranks the whole world and reads top-down", () => {
    const league = makeLeague(SPECTATOR_TID, 1);
    const html = render(createElement(PowerRankingPanel, { league }), league);
    expect(html).toContain("Power rankings");
    expect(html).toContain("/power-rankings");

    // The column has to descend or the board reads as an unsorted list — the
    // bug that shipped for a few minutes when it showed OVR beside a ranking
    // ordered by power score.
    const scores = [...html.matchAll(/text-end text-muted">(\d+)</g)].map((m) => Number(m[1]));
    expect(scores.length).toBeGreaterThan(1);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });
});

describe("world panels: a continental competition", () => {
  const base = makeLeague(SPECTATOR_TID, 1);

  function cupWith(over: Partial<CupState>): CupState {
    return {
      competition: "continental", season: 2, name: "Continental Cup",
      teams: [0, 1, 2, 3, 4, 5, 6, 7], seeds: {}, leaguePhase: null, playoff: null,
      playIn: null, ties: [], championTid: null, twoLegged: true, koLegs: null,
      statLines: null, ...over,
    } as CupState;
  }

  it("says it starts next season when there isn't one yet", () => {
    const html = render(createElement(CupBracketPanel, {
      cup: null, title: "Continental Cup", href: "/cup",
    }), base);
    expect(html).toContain("starts next season");
  });

  /**
   * A cup spends most of the season in its Swiss league phase, so a panel that
   * only knew how to draw a bracket would be empty from August to March.
   */
  it("shows the league-phase leaders before the knockout", () => {
    const cup = cupWith({
      leaguePhase: {
        teams: [0, 1, 2, 3],
        matches: [
          { home: 0, away: 1, homeGoals: 3, awayGoals: 0, played: true, round: 0 },
          { home: 2, away: 3, homeGoals: 1, awayGoals: 0, played: true, round: 0 },
        ],
      } as CupState["leaguePhase"],
      seeds: { 0: 1, 1: 2, 2: 3, 3: 4 },
    });
    const html = render(createElement(CupBracketPanel, {
      cup, title: "Continental Cup", href: "/cup",
    }), base);
    expect(html).toContain("League phase");
    expect(html).not.toContain("Quarter-finals");
  });

  it("draws the bracket once the knockout is under way, newest round last", () => {
    const cup = cupWith({
      // A league phase, even an empty one. `isSwissCup` is just `!!leaguePhase`,
      // so a fixture without one is a *legacy* cup, whose bracket is a fixed
      // four rounds — and round 0 then reads "Round of 16" rather than the
      // quarter-finals an eight-club field is actually playing. Every cup a real
      // save builds is Swiss.
      leaguePhase: { teams: [0, 1, 2, 3, 4, 5, 6, 7], matches: [] } as CupState["leaguePhase"],
      ties: [tie(0, 0, 1, 2, 0), tie(0, 2, 3, 1, 3), tie(1, 0, 3, 1, 0)],
    });
    const html = render(createElement(CupBracketPanel, {
      cup, title: "Continental Cup", href: "/cup",
    }), base);
    expect(html).toContain("Quarter-finals");
    expect(html).toContain("Semi-finals");
    expect(html.indexOf("Quarter-finals")).toBeLessThan(html.indexOf("Semi-finals"));
    expect(html).toContain("/cup");
  });

  it("names the winner once it is won", () => {
    const cup = cupWith({ ties: [tie(0, 0, 1, 2, 0)], championTid: base.teams[0].tid });
    const html = render(createElement(CupBracketPanel, {
      cup, title: "Continental Cup", href: "/cup",
    }), base);
    expect(html).toContain("win it");
  });
});

describe("world panels: the summer's international football", () => {
  const base = makeLeague(SPECTATOR_TID, 1);

  function tournament(over: Partial<IntlTournament> = {}): IntlTournament {
    return {
      season: 4, name: "World Cup",
      nations: ["England", "Brazil", "France", "Spain"],
      squads: [], groups: [], bracket: [0, 1, 2, 3],
      ties: [tie(0, 0, 1, 2, 1), tie(0, 2, 3, 0, 1), tie(1, 0, 3, 3, 0)],
      championNid: null, ...over,
    } as IntlTournament;
  }

  function leagueAt(season: number, over: Partial<LeagueStore> = {}): LeagueStore {
    return { ...base, season, phase: "offseason", ...over } as LeagueStore;
  }

  /**
   * The cycle is four seasons long: a World Cup on season % 4 === 0, the
   * confederation championships on season % 4 === 2, qualifying alone on the
   * other two. So a tournament panel appears every other year, and the two
   * quiet years must show nothing rather than an empty card.
   */
  it("shows the World Cup in a World Cup offseason", () => {
    const html = render(createElement(InternationalBracketPanel, {
      league: leagueAt(4, {
        international: { ...base.international, tournament: tournament() },
      }),
    }));
    expect(html).toContain("World Cup");
    // Four nations is a two-round bracket, so round 0 is the semi-finals, not
    // the final — the reason depth comes off the field and not off how many
    // rounds happen to have been played.
    expect(html).toContain("Semi-finals");
    expect(html).toContain("Final");
    expect(html).toContain("England");
  });

  it("shows the confederation cups in their offseason", () => {
    const cups = [
      { ...tournament({ name: "European Championship" }), confederation: "UEFA", qualifyPerGroup: 2 },
    ];
    const html = render(createElement(InternationalBracketPanel, {
      league: leagueAt(2, {
        international: { ...base.international, confederationCups: cups },
      } as Partial<LeagueStore>),
    }));
    expect(html).toContain("Confederation cups");
    expect(html).toContain("European Championship");
  });

  it("shows nothing in a qualifying-only offseason", () => {
    for (const season of [1, 3, 5, 7]) {
      expect(render(createElement(InternationalBracketPanel, { league: leagueAt(season) }))).toBe("");
    }
  });

  it("shows nothing during the season, whatever year it is", () => {
    const html = render(createElement(InternationalBracketPanel, {
      league: { ...leagueAt(4), phase: "regular" } as LeagueStore,
    }));
    expect(html).toBe("");
  });

  it("waits for the draw rather than drawing an empty bracket", () => {
    const html = render(createElement(InternationalBracketPanel, {
      league: leagueAt(4, { international: { ...base.international, tournament: null } }),
    }));
    expect(html).toContain("Waiting on the draw");
  });
});
