import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { makeLeague } from "../helpers/league.js";
import type { LeagueStore } from "../../src/core/leagueState.js";

/**
 * The top bar's Sim menu is the sim control reachable from every page, so it
 * gets the same phase swap the Dashboard's Simulation card does: matchday items
 * in season, offseason items in the offseason, never a menu of dead entries.
 *
 * The menu is deliberately checked for the *absence* of the matchday items in
 * the offseason as well as the presence of the offseason ones — leaving them
 * rendered but disabled is the state this replaced, and it would still pass a
 * presence-only assertion.
 */
const leagueRef: { current: LeagueStore | null } = { current: null };

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({
    league: leagueRef.current,
    simAction: () => {},
    simLiveAction: () => {},
    intlStageAction: () => {},
    jumpSeasonsAction: () => {},
    simming: false,
    exportJSON: () => {},
    switchLeagueAction: () => {},
    setGodModeAction: () => {},
  }),
}));

// The real hook throws outside its provider, and the provider reads
// localStorage, which server rendering has no business touching.
vi.mock("../../src/ui/sportName.js", () => ({
  useSportName: () => ({ choice: "football", term: "Football", brand: "World Football Simulator" }),
}));

const { TopBar } = await import("../../src/ui/components/TopBar.js");

function render(league: LeagueStore): string {
  leagueRef.current = league;
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(TopBar, { onToggleNav: () => {} })),
  );
}

describe("the top bar's Sim menu", () => {
  it("lists the matchday actions in season", () => {
    const html = render(makeLeague(0, 1));
    expect(html).toContain("Sim One Game");
    expect(html).toContain("Watch Next Game");
    expect(html).toContain("Sim to End of Season");
  });

  it("lists the offseason actions instead in the offseason", () => {
    const html = render({ ...makeLeague(0, 1), phase: "offseason" as const });
    expect(html).toContain("Advance to");
    expect(html).not.toContain("Sim One Game");
    expect(html).not.toContain("Watch Next Game");
    expect(html).not.toContain("Sim to End of Season");
  });

  it("offers a sacked manager the same way out the Dashboard does", () => {
    const base = makeLeague(0, 1);
    const html = render({
      ...base,
      phase: "offseason" as const,
      manager: { ...base.manager, sacked: true },
    });
    // Escaped: React writes an apostrophe as &#x27; in static markup.
    expect(html).toContain("See who&#x27;ll have you");
    expect(html).not.toContain("Advance to");
  });

  it("keeps the menu itself usable in the offseason", () => {
    // The trigger used to carry `disabled` whenever the phase was offseason,
    // which would now hide the very items the swap exists to show.
    const html = render({ ...makeLeague(0, 1), phase: "offseason" as const });
    const trigger = html.slice(html.indexOf("dropdown-toggle"), html.indexOf("dropdown-menu"));
    expect(trigger).not.toContain("disabled");
  });
});

/**
 * Jump ahead moved off the Dashboard and into the bar, so it is reachable from
 * every page rather than only the one. Import came out of the bar entirely: the
 * Leagues screen has its own, which handles roster files as well as saves, and
 * that is the screen you go to to manage saves anyway.
 */
describe("the top bar's other controls", () => {
  it("carries the jump form, in its own menu rather than inside Sim", () => {
    const html = render(makeLeague(0, 1));
    expect(html).toContain("topbar-jump");
    expect(html).toContain("Seasons to jump");

    // Its own control: Sim advances a step at a time, this hands a managed club
    // to the AI for years, and folding them together would make the two read as
    // the same kind of thing.
    const simMenu = html.slice(html.indexOf("dropdown-menu"), html.indexOf("topbar-jump"));
    expect(simMenu).not.toContain("Seasons to jump");
  });

  it("no longer offers Import anywhere in the bar", () => {
    const html = render(makeLeague(0, 1));
    expect(html).not.toContain("Import");
    // Export stays: it is the half with no other home.
    expect(html).toContain("Export");
  });
});
