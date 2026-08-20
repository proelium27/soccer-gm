import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";
import type { IntlConfederationCup } from "../../src/core/international/index.js";
import {
  initConfederationCups, confederationCupKnockoutPending, summarizeConfederationCups, buildPowerSnapshot,
} from "../../src/core/international/index.js";
import {
  playConfederationCupGroups, playConfederationCupKnockoutRound,
} from "../../src/core/international/confederationCup.js";

/**
 * Render harness for the Confederation Cups page.
 *
 * The page has to draw tournaments of genuinely different shapes side by side
 * — a sixteen-nation Euro with a three-round bracket next to a five-nation
 * Copa whose whole knockout is one final — plus the archived form of both, and
 * there is no DOM test environment in this repo to catch a throw any other way.
 * Server rendering does NOT run error boundaries (React re-throws to the
 * caller), so a throw here surfaces as a test failure.
 *
 * Deliberately built from the confederation cup functions directly rather than by
 * simming seasons: the page only needs the state, and a simmed offseason costs
 * minutes.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({ league: leagueRef.current, simming: false }),
}));

const { NTConfederationCups } = await import("../../src/ui/pages/nationalTeams/ConfederationCups.js");

function render(league: LeagueStore): string {
  leagueRef.current = league;
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(NTConfederationCups)),
  );
}

/** A league whose international state carries the given confederation cups. */
function withConfederationCups(
  base: LeagueStore,
  confederationCups: IntlConfederationCup[],
  confederationCupHistory: LeagueStore["international"]["confederationCupHistory"] = [],
): LeagueStore {
  return {
    ...base,
    international: {
      ...base.international,
      confederationCups,
      confederationCupHistory,
      // A power-ranking snapshot is enough for the page to consider
      // international football started, so the empty state isn't shown.
      powerRankings: [buildPowerSnapshot(base.players, base.season)],
    },
  };
}

const league = makeLeague(0, 5);
const SEASON = 2;

const drawn = initConfederationCups(league.players, SEASON, league.lid);

/** The same championships, played out to their champions. */
const finished = (() => {
  let tournaments = playConfederationCupGroups(drawn, league.players, league.lid).tournaments;
  for (let guard = 0; confederationCupKnockoutPending(tournaments) && guard < 6; guard++) {
    tournaments = playConfederationCupKnockoutRound(tournaments, league.players, league.lid).tournaments;
  }
  return tournaments;
})();

describe("Confederation Cups page", () => {
  it("has championships of more than one shape to render", () => {
    // The point of the harness: if every tournament had the same shape it
    // wouldn't be exercising the variable-format rendering at all.
    expect(drawn.length).toBeGreaterThan(1);
    expect(new Set(drawn.map((t) => t.groups.length)).size).toBeGreaterThan(1);
  });

  it("renders a drawn but unplayed set of championships", () => {
    const html = render(withConfederationCups(league, drawn));
    expect(html).toContain("Confederation Cups");
    for (const t of drawn) expect(html).toContain(t.name);
    // Nothing is played, so the bracket is still empty. Matched without the
    // apostrophe, which server rendering escapes to &#x27;.
    expect(html).toContain("knockout stage hasn");
  });

  it("renders finished championships, each with its own champion", () => {
    const html = render(withConfederationCups(league, finished));
    for (const t of finished) {
      expect(t.championNid).not.toBeNull();
      expect(html).toContain(t.nations[t.championNid!]);
    }
    expect(html).toContain("Winners");
    // A two-round bracket must not label its first round "Quarter-finals".
    const shortest = finished.reduce(
      (a: IntlConfederationCup, b: IntlConfederationCup) =>
        (a.bracket.length <= b.bracket.length ? a : b),
    );
    if (shortest.bracket.length === 2) expect(html).toContain("Final");
  });

  it("renders archived championships when the live ones are gone", () => {
    const summaries = summarizeConfederationCups(finished, league.players);
    expect(summaries.length).toBe(finished.length);
    const html = render(withConfederationCups(league, [], summaries));
    for (const s of summaries) {
      expect(html).toContain(s.name);
      expect(html).toContain(s.champion);
    }
  });

  it("explains itself when no championship has been played", () => {
    const html = render(withConfederationCups(league, []));
    expect(html).toContain("No confederation cup has been played yet");
  });
});
