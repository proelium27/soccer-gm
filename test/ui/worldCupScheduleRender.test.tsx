import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import type { IntlTournament } from "../../src/core/international/index.js";
import { buildSquads } from "../../src/core/international/index.js";
import { initTournament } from "../../src/core/international/tournament.js";
import { INTL_FIELD_SIZE, INTL_GROUPS } from "../../src/core/constants.js";

/**
 * Render harness for the National Teams schedule page, specifically its
 * knockout round picker.
 *
 * That picker names its rounds from the *tournament's own* depth rather than
 * from the KO_ROUND_NAMES list, and this pins why. The World Cup's bracket is
 * four rounds at a 32-nation field, but a save that was mid-tournament when the
 * field grew still holds a three-round one; indexing the name list directly
 * would label that tournament's quarter-finals "Round of 16". There is no DOM
 * test environment here, and server rendering does not run error boundaries
 * (React re-throws to the caller), so a throw surfaces as a failure.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({ league: leagueRef.current, simming: false }),
}));

const { NTSchedule } = await import("../../src/ui/pages/nationalTeams/Schedule.js");

function render(league: LeagueStore): string {
  leagueRef.current = league;
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(NTSchedule)));
}

/** A league showing `tournament` as its live campaign. */
function withTournament(base: LeagueStore, tournament: IntlTournament): LeagueStore {
  return {
    ...base,
    international: { ...base.international, tournament, qualifying: null, stage: "groups" },
  };
}

const league = makeLeague(0, 5);
const field = buildSquads(league.players).slice(0, INTL_FIELD_SIZE).map((s) => s.nation);
const tournament = initTournament(field, league.players, league.season, league.lid)!;

describe("World Cup schedule", () => {
  it("draws the full-size field into the shipped number of groups", () => {
    expect(tournament.nations).toHaveLength(INTL_FIELD_SIZE);
    expect(tournament.groups).toHaveLength(INTL_GROUPS);
  });

  it("offers a round of 16 for an eight-group tournament", () => {
    const html = render(withTournament(league, tournament));
    for (const label of ["Group stage", "Round of 16", "Quarter-finals", "Semi-finals", "Final"]) {
      expect(html).toContain(label);
    }
  });

  it("does not offer a round of 16 for a four-group tournament", () => {
    // The shape a save drawn before the field grew still carries. Only the
    // group count matters to the picker, so slicing the groups is enough.
    const legacy: IntlTournament = { ...tournament, groups: tournament.groups.slice(0, 4) };
    const html = render(withTournament(league, legacy));
    expect(html).not.toContain("Round of 16");
    for (const label of ["Group stage", "Quarter-finals", "Semi-finals", "Final"]) {
      expect(html).toContain(label);
    }
  });
});
