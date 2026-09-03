import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { makeLeague } from "../helpers/league.js";
import {
  SCOUTING_REGION_MAX, SCOUT_POSITION_MAX,
} from "../../src/core/constants.js";
import type { LeagueStore } from "../../src/core/leagueState.js";

/**
 * Render harness for the Youth Intake page's Scout directions panel.
 *
 * There is no DOM test env here, so this covers what the core tests can't: that
 * the panel renders in each of its states without throwing, and that both
 * rows show what the user actually picked. Every value it draws comes off
 * persisted `StoredTeam` fields that a save can carry from an older build or a
 * hand edit, so the states worth pinning are the empty one, the filled one and
 * the junk one — the last because `scoutDirectionsOf` is what stands between a
 * bad stored value and a render.
 *
 * Server rendering does not run error boundaries (React re-throws to the
 * caller), so a throw here is a test failure rather than a fallback render.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };
const saved: unknown[] = [];

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({
    league: leagueRef.current,
    signTrialistAction: () => {},
    setScoutDirectionsAction: (next: unknown) => { saved.push(next); },
    simming: false,
  }),
}));

const { YouthIntake } = await import("../../src/ui/pages/YouthIntake.js");

function withDirections(d: {
  scoutingRegions?: string[];
  scoutingPositions?: string[];
}): LeagueStore {
  const league = makeLeague(0, 5);
  return {
    ...league,
    teams: league.teams.map((t) => (t.tid === league.meta.userTid
      ? { ...t, ...d } as typeof t
      : t)),
  };
}

function render(league: LeagueStore): string {
  leagueRef.current = league;
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(YouthIntake)),
  );
}

describe("Scout directions panel", () => {
  it("renders both rows with nothing set", () => {
    const html = render(withDirections({}));
    expect(html).toContain("Scout directions");
    expect(html).toContain("Countries");
    expect(html).toContain("Positions");
    // The empty states read as a default rather than as a missing value.
    expect(html).toContain("anywhere close to home");
    expect(html).toContain("whoever they turn up");
  });

  it("shows what has been picked, and stops offering more at the caps", () => {
    const regions = ["Brazil", "Argentina", "France"];
    const positions = ["GK", "CB", "ST"];
    expect(regions).toHaveLength(SCOUTING_REGION_MAX);
    expect(positions).toHaveLength(SCOUT_POSITION_MAX);

    const html = render(withDirections({
      scoutingRegions: regions,
      scoutingPositions: positions,
    }));
    for (const c of regions) expect(html).toContain(c);
    // At the cap the "add another" pickers are gone, so the cap is visible
    // rather than enforced only on click.
    expect(html).not.toContain("Add a country...");
    expect(html).not.toContain("Add a position...");
  });

  it("survives stored junk instead of rendering it", () => {
    // An unrecognised entry would otherwise take a share of the draw that went
    // nowhere, weakening every real target beside it.
    const html = render(withDirections({
      scoutingRegions: ["Atlantis", "Brazil"],
      scoutingPositions: ["Striker", "ST"],
    }));
    expect(html).toContain("Brazil");
    expect(html).not.toContain("Atlantis");
    expect(html).not.toContain("Striker");
  });
});
