import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";

/**
 * The Simulation card is phase-aware: it holds the matchday buttons in season
 * and the offseason ones in the offseason, so the control that moves time
 * forward never moves down the page. These cases pin that the swap happens
 * *inside that card* rather than merely somewhere on the screen — the whole
 * point of the arrangement is position, which a plain "contains the text"
 * assertion would not catch if the offseason controls drifted back into a card
 * of their own.
 *
 * Server rendering does not run error boundaries (React re-throws to the
 * caller), so a throw in any branch surfaces as a test failure.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({
    league: leagueRef.current,
    simAction: () => {},
    simLiveAction: () => {},
    jumpSeasonsAction: () => {},
    setScoutingSpendAction: () => {},
    intlStageAction: () => {},
    simming: false,
  }),
}));

const { Dashboard } = await import("../../src/ui/pages/Dashboard.js");

function render(league: LeagueStore): string {
  leagueRef.current = league;
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Dashboard)));
}

/**
 * The slice of markup between the Simulation heading and the card after it.
 *
 * Ends at whichever card comes next rather than naming one: it used to end at
 * "Jump ahead", which then moved to the top bar and took this helper's end
 * marker with it. Every card on the page opens with a `card-title`, so the next
 * one is the boundary whatever it happens to be.
 */
function simCard(html: string): string {
  const start = html.indexOf("Simulation</h5>");
  expect(start).toBeGreaterThan(-1);
  const next = html.indexOf('class="card-title', start + 1);
  return next === -1 ? html.slice(start) : html.slice(start, next);
}

describe("the Dashboard's Simulation card", () => {
  it("holds the matchday buttons in season", () => {
    const card = simCard(render(makeLeague(0, 1)));
    expect(card).toContain("Sim One Game");
    expect(card).toContain("Watch Next Game");
    expect(card).toContain("Sim to End of Season");
  });

  it("swaps them for the advance button in the offseason", () => {
    const league = { ...makeLeague(0, 1), phase: "offseason" as const };
    const card = simCard(render(league));
    expect(card).toContain("Advance to");
    // The matchday buttons are gone, not merely disabled: there is no matchday
    // left to play, and a row of dead buttons is what this replaced.
    expect(card).not.toContain("Sim One Game");
    expect(card).not.toContain("Sim to End of Season");
  });

  it("shows a sacked manager his way out, in the same place", () => {
    const base = makeLeague(0, 1);
    const league = {
      ...base,
      phase: "offseason" as const,
      manager: { ...base.manager, sacked: true },
    };
    const card = simCard(render(league));
    // Escaped: React writes an apostrophe as &#x27; in static markup.
    expect(card).toContain("See who&#x27;ll have you");
    expect(card).not.toContain("Advance to");
  });
});
