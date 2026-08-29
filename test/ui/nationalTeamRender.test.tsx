import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import { initInternationalCampaign } from "../../src/core/international/index.js";
import { emptyNationalManagerState } from "../../src/core/nationalManager/index.js";

/**
 * Render harness for the two national-team management pages.
 *
 * These pages have states a pure-function test can't reach: no country at all,
 * a country with nothing to pick for, a live campaign with a squad and a pitch,
 * a dismissal, and an offer list. Each is a distinct render path and a throw in
 * any of them blanks the page.
 *
 * Server rendering does NOT run error boundaries — React re-throws to the
 * caller — so a throw here surfaces as a test failure regardless of the
 * boundaries App/Layout install around the router. Same harness pattern as
 * `transfersRender.test.tsx`; see the note there.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({
    league: leagueRef.current,
    setNationalSquadAction: () => {},
    setNationalLineupAction: () => {},
    setNationalFormationAction: () => {},
    autoPickNationalXIAction: () => {},
    takeNationalJobAction: () => {},
    leaveNationalJobAction: () => {},
    declineNationalOffersAction: () => {},
    setNationalSackingEnabledAction: () => {},
    simming: false,
  }),
}));

const { NTMySquad } = await import("../../src/ui/pages/nationalTeams/MySquad.js");
const { NTFederation } = await import("../../src/ui/pages/nationalTeams/Federation.js");

function render(page: () => ReactElement, league: LeagueStore): string {
  leagueRef.current = league;
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(page)),
  );
}

/** A league parked with this offseason's campaign drawn but unplayed. */
function staged(nation: string | null): LeagueStore {
  const league = makeLeague(0, 1);
  return {
    ...league,
    nationalManager: emptyNationalManagerState(nation, 1),
    international: initInternationalCampaign(
      league.international, league.players, league.season, league.lid,
    ),
  };
}

const someNation = (): string => {
  const league = makeLeague(0, 1);
  const drawn = initInternationalCampaign(
    league.international, league.players, league.season, league.lid,
  );
  return drawn.qualifying!.squads[0].nation;
};

describe("My Squad page", () => {
  it("explains itself when the user manages no country", () => {
    const html = render(NTMySquad, staged(null));
    expect(html).toContain("don&#x27;t manage a national team");
    expect(html).toContain("/national-teams/federation");
  });

  it("renders the pitch, the bench strip and the squad table for a live campaign", () => {
    const nation = someNation();
    const html = render(NTMySquad, staged(nation));
    expect(html).toContain("pitch-field");
    // A chip per starter and per reserve, so the whole squad is draggable.
    expect(html.match(/pitch-chip/g)?.length).toBeGreaterThanOrEqual(11);
    expect(html).toContain("Rest of the squad");
    expect(html).toContain("Best XI");
    expect(html).toContain("called up");
  });

  /**
   * The eligible pool is several hundred players, so it stays shut until asked
   * for — both because it is a search rather than a list to browse, and because
   * open it is thousands of table cells on a page whose job is picking eleven
   * names. Closed, the only table on the page is the 23-man squad.
   */
  it("keeps the eligible pool behind a disclosure", () => {
    const nation = someNation();
    const html = render(NTMySquad, staged(nation));
    expect(html).toContain("Call someone up");
    expect(html).not.toContain("Search eligible players");
    expect(html.match(/<table/g)?.length).toBe(1);
  });

  /**
   * Between campaigns the page is read-only rather than blank: arranging an
   * eleven that will never be fielded is worse than showing the last one.
   */
  it("shows the last squad read-only when nothing is pending", () => {
    const base = staged(someNation());
    const html = render(NTMySquad, {
      ...base,
      international: { ...base.international, stage: "done" },
    });
    expect(html).toContain("Nothing to pick for right now");
    expect(html).not.toContain("Best XI");
  });

  it("copes with a country that never named a squad", () => {
    const league = makeLeague(0, 1);
    const html = render(NTMySquad, {
      ...league,
      nationalManager: emptyNationalManagerState("Nowhere at all", 1),
    });
    expect(html).toContain("haven&#x27;t named a squad yet");
  });
});

describe("Federation page", () => {
  it("invites a manager with no country rather than showing an empty meter", () => {
    const html = render(NTFederation, staged(null));
    expect(html).toContain("You don&#x27;t manage a country");
    expect(html).toContain("Nobody&#x27;s been in touch");
  });

  it("shows the confidence bar and career table for a manager in a job", () => {
    const nation = someNation();
    const html = render(NTFederation, staged(nation));
    expect(html).toContain("progress-bar");
    expect(html).toContain("Career");
    expect(html).toContain("World Cups");
    expect(html).toContain("Step down");
  });

  it("renders an offer list", () => {
    const base = staged(null);
    const html = render(NTFederation, {
      ...base,
      nationalManager: {
        ...base.nationalManager,
        offers: [{ nation: "Brazil", confederation: "South America", rank: 1, nations: 44, prestige: 1 }],
      },
    });
    expect(html).toContain("Brazil");
    expect(html).toContain("Take the job");
    expect(html).toContain("Turn them all down");
  });

  it("leads with the dismissal when a federation has just let you go", () => {
    const base = staged(null);
    const html = render(NTFederation, {
      ...base,
      nationalManager: { ...base.nationalManager, sacked: true },
    });
    expect(html).toContain("alert-danger");
    expect(html).toContain("back to club football only");
  });

  /**
   * The verdict panel has its own branch per campaign kind, and a qualifying
   * verdict reads "Qualified"/"Missed out" where a tournament reads a placement.
   */
  it("explains the last campaign's verdict", () => {
    const base = staged("Brazil");
    const html = render(NTFederation, {
      ...base,
      nationalManager: {
        ...base.nationalManager,
        lastVerdict: {
          kind: "qualifying",
          competition: "World Cup qualifying",
          placement: 38,
          expectedRank: 3,
          nations: 44,
          overperformance: -0.8,
          titles: 0,
          continentalTitles: 0,
          qualified: false,
          demand: 0.9,
          delta: -40,
          confidence: 20,
          sacked: false,
          season: 3,
          nation: "Brazil",
          previousConfidence: 60,
        },
      },
    });
    expect(html).toContain("World Cup qualifying");
    expect(html).toContain("Missed out");
    expect(html).toContain("60");
    expect(html).toContain("they noticed");
  });
});
