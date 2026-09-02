import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

/**
 * The AI prompt has to be reachable from the screens that import a roster file.
 *
 * It wasn't. `buildImportPromptText` was offered only from TopBar, TopBar
 * renders only inside `Layout`, and `/leagues` and `/new-league` both sit
 * OUTSIDE `Layout` (App.tsx) because they are pre-save screens — while roster
 * import is creation-only by design. So the one copy of the format spec lived
 * behind a save you had to already have, on a route you had to already have
 * left. The Import Custom League screen's own help text admitted as much: it
 * told you to go find "the top bar of any save".
 *
 * That is not a cosmetic gap. A 232-club file turned up on 2026-09-02 breaking
 * four separate rules the prompt states plainly — no `country`/`tier`,
 * real-world division sizes rather than this world's, an invented competition,
 * and names rebuilt from the country rather than copied — which is what a file
 * written without the spec looks like.
 *
 * These render the three routes and assert the control is present. A unit test
 * of the button component would pass while every page that should carry it
 * dropped it, which is precisely the regression to catch.
 */
vi.mock("../../src/ui/sportName.js", () => ({
  useSportName: () => ({ brand: "World Soccer Simulator", term: "soccer", choose: () => {} }),
}));

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({
    league: null,
    leagues: [],
    createLeagueAction: () => {},
    customizeTeamsAction: () => {},
    importJSON: () => {},
    refresh: () => {},
    simming: false,
  }),
}));

/**
 * A real BUTTON carrying the label, not merely the label somewhere on the page.
 *
 * That distinction is the whole test. The roster screen's help text already
 * said the words "Copy AI Prompt to Customize" — while telling you to go and
 * find it in another save's top bar — so a plain substring check passes on the
 * exact code this change exists to fix.
 */
const BUTTON = /<button[^>]*>Copy AI Prompt to Customize<\/button>/;

const render = (Page: React.ComponentType, route: string) =>
  renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [route] }, createElement(Page)),
  );

describe("the AI prompt is reachable without a save open", () => {
  it("offers it on the Leagues screen, where Import lives", async () => {
    const { Leagues } = await import("../../src/ui/pages/Leagues.js");
    expect(render(Leagues, "/leagues")).toMatch(BUTTON);
  });

  it("offers it on the Import Custom League screen", async () => {
    const { NewLeague } = await import("../../src/ui/pages/NewLeague.js");
    expect(render(NewLeague, "/new-league?roster=1")).toMatch(BUTTON);
  });

  // Roster files load from the plain New League screen too, and that is where
  // someone who hasn't got a file yet is standing.
  it("offers it on the plain New League screen", async () => {
    const { NewLeague } = await import("../../src/ui/pages/NewLeague.js");
    expect(render(NewLeague, "/new-league")).toMatch(BUTTON);
  });

  // This sentence is what documented the gap — it told the reader to go and
  // find the button somewhere else. If it comes back, the advice is wrong again.
  it("no longer sends the reader to another save's top bar", async () => {
    const { NewLeague } = await import("../../src/ui/pages/NewLeague.js");
    expect(render(NewLeague, "/new-league?roster=1")).not.toMatch(/top bar of any save/i);
  });
});
