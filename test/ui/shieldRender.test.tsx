import { describe, expect, it, vi } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import { buildCupState } from "../../src/core/cup/cup.js";
import { computeStandings } from "../../src/core/standings.js";
import { SHIELD_FORMAT, CONTINENTAL_CUP_FORMAT } from "../../src/core/constants.js";

/**
 * Render harness for the competition pages, covering the Shield's paths: the
 * empty state, a drawn-but-unplayed league phase, and the Standings page's two
 * stacked qualification bands.
 *
 * A throw here surfaces as a test failure. Server rendering does NOT run error
 * boundaries — React re-throws to the caller — so this sees raw throws
 * regardless of the boundaries App/Layout install around the router.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({
    league: leagueRef.current,
    simming: false,
  }),
}));

const { Cup, Shield } = await import("../../src/ui/pages/Cup.js");
const { Standings } = await import("../../src/ui/pages/Standings.js");

function render(league: LeagueStore, page: ComponentType): string {
  leagueRef.current = league;
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(page)),
  );
}

/** A fresh world with both competitions seeded off a synthetic set of final tables. */
function withCompetitions(): LeagueStore {
  const league = makeLeague(0, 1);
  // Synthetic final tables: every tier-1 club, ordered by tid, so qualification
  // is deterministic without paying for a simmed season.
  const tables = new Map<number, ReturnType<typeof computeStandings>>();
  for (const comp of league.competitions) {
    const tids = league.teams.filter((t) => t.compId === comp.id).map((t) => t.tid);
    tables.set(comp.id, computeStandings(tids, []));
  }
  // Standings renders nothing at all until a match has been played, so give it
  // one. The table's order comes from computeStandings either way.
  const firstComp = league.competitions.find((c) => c.tier === 1)!;
  const [homeTid, awayTid] = league.teams
    .filter((t) => t.compId === firstComp.id)
    .map((t) => t.tid);
  return {
    ...league,
    season: league.season + 1,
    played: [{
      home: homeTid, away: awayTid, homeGoals: 1, awayGoals: 0,
      possessionHome: 0.5, matchday: 1,
      boxScore: { home: [], away: [], events: [] },
    }],
    cup: buildCupState(league.competitions, tables, league.season + 1, CONTINENTAL_CUP_FORMAT),
    shield: buildCupState(league.competitions, tables, league.season + 1, SHIELD_FORMAT),
  };
}

describe("Shield page", () => {
  it("renders its own empty state, naming the Shield rather than the Cup", () => {
    const league = makeLeague(0, 1);
    const html = render(league, Shield);
    expect(html).toContain("Continental Shield");
    // The Cup's empty state must not leak into the Shield's page.
    expect(html).not.toContain("top four clubs of each of the four strongest leagues");
  });

  it("renders a drawn league phase with all 16 clubs and no crash", () => {
    const league = withCompetitions();
    expect(league.shield).not.toBeNull();
    const html = render(league, Shield);
    expect(html).toContain("Continental Shield");
    expect(html).toContain("League Phase");
    for (const tid of league.shield!.leaguePhase!.teams) {
      const name = league.teams.find((t) => t.tid === tid)!.name;
      expect(html).toContain(name);
    }
  });

  it("keeps the Cup page on the Cup's own state", () => {
    const league = withCompetitions();
    const html = render(league, Cup);
    expect(html).toContain("Continental Cup");
    expect(html).not.toContain("Continental Shield");
    // Cup and Shield fields are disjoint, so no Shield club appears here.
    const shieldOnly = league.shield!.leaguePhase!.teams.filter(
      (t) => !league.cup!.leaguePhase!.teams.includes(t),
    );
    expect(shieldOnly.length).toBeGreaterThan(0);
  });
});

describe("Standings qualification bands", () => {
  it("marks the Cup places and the Shield places directly below them", () => {
    const league = withCompetitions();
    const html = render(league, Standings);
    expect(html).toContain("qual-marker-cup");
    expect(html).toContain("qual-marker-shield");
    expect(html).toContain("to the Continental Cup");
    expect(html).toContain("to the Continental Shield");
    // No row can be in both zones — that would mean the fields overlap.
    expect(html).not.toContain("cup-qualification shield-qualification");
  });

  it("gives every row a marker slot so the position numbers stay aligned", () => {
    const league = withCompetitions();
    const html = render(league, Standings);
    const rows = html.split("<tr").length - 1;
    const markers = html.split("qual-marker").length - 1;
    // One marker per row, plus the two in the legend. Non-qualifying rows
    // render a hidden marker rather than nothing, which is what keeps the
    // numbers in one column.
    expect(markers).toBeGreaterThanOrEqual(rows);
    expect(html).toContain("qual-marker-none");
  });

  it("distinguishes the two competitions by shape, not colour alone", () => {
    // The Cup marker is filled and the Shield marker is hollow, so the two
    // survive grayscale and colour-vision deficiency (DESIGN.md's Signal Rule).
    // Pinning the class names here because the shape difference lives in CSS
    // and a future "simplification" to one shared class would silently break it.
    const league = withCompetitions();
    const html = render(league, Standings);
    expect(html).toContain("qual-marker qual-marker-cup");
    expect(html).toContain("qual-marker qual-marker-shield");
    expect(html).toContain("Continental Cup place");
    expect(html).toContain("Continental Shield place");
  });
});
