import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { ROSTER_FILE_FORMAT, type RosterFile } from "../../src/core/teams/rosterFile.js";
import { setPendingRoster } from "../../src/ui/pendingRoster.js";
import { NewLeague } from "../../src/ui/pages/NewLeague.js";

/**
 * The world editor has to be reachable from the roster-import flow, not just the
 * plain one.
 *
 * It used to be hidden there on purpose, and the reason was real: the page held
 * the file's clubs already *resolved* onto slots, so reshaping the world under a
 * loaded file left that resolution pointing at the wrong clubs. The fix was to
 * hold only the files and resolve against the world as it currently stands, and
 * this pins the visible half of that — because the thing a player most needs to
 * do with a file the world doesn't fit is add the league it was written for, and
 * that control was on the one screen they couldn't reach.
 *
 * Server rendering does not run error boundaries (React re-throws to the
 * caller), so a throw on this page surfaces here as a failure.
 */

// The real provider reads localStorage on mount, which this node test env
// doesn't have. Only `brand` is read by the page under test.
vi.mock("../../src/ui/sportName.js", () => ({
  useSportName: () => ({ brand: "World Soccer Simulator", term: "soccer", choose: () => {} }),
}));

vi.mock("../../src/ui/context/LeagueContext.js", () => ({
  useLeague: () => ({
    league: null,
    leagues: [],
    setLeague: () => {},
    importJSON: () => {},
    refresh: () => {},
    simming: false,
  }),
}));

/** A roster file naming one competition — by default one this world hasn't got. */
function rosterFile(match = "Eredivisie"): RosterFile {
  return {
    format: ROSTER_FILE_FORMAT,
    formatVersion: 1,
    competitions: [{
      match,
      clubs: [
        { name: "Amsterdam XI", abbrev: "AMS", colors: ["#e74c3c", "#ffffff"] },
        { name: "Rotterdam Port", abbrev: "ROT", colors: ["#1b4f72", "#f4d03f"] },
      ],
    }],
  };
}

/**
 * Imported once rather than re-imported per case behind vi.resetModules(): the
 * handoff is a module variable, and a reset can hand the page a *different*
 * instance of that module from the one the test just wrote to, which made this
 * file fail on some runs and pass on others. Nothing leaks between cases —
 * takePendingRoster clears as it reads, and every case sets its own.
 */
function renderNewLeague(
  url: string,
  handoff?: { name: string; file: RosterFile }[],
): string {
  if (handoff) setPendingRoster({ files: handoff });
  return renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [url] }, createElement(NewLeague)),
  );
}

describe("the New League screen offers the world editor", () => {
  it("shows it once a roster file has been imported", () => {
    const html = renderNewLeague("/new-league?roster=1", [
      { name: "netherlands.json", file: rosterFile() },
    ]);
    expect(html).toContain("netherlands.json");
    expect(html).toContain("World setup");
    expect(html).toContain("Add a league");
  });

  it("says what to do about a league the world hasn't got", () => {
    const html = renderNewLeague("/new-league?roster=1", [
      { name: "netherlands.json", file: rosterFile() },
    ]);
    // The file names a competition this world has no equivalent of, so every
    // club in it is skipped — and the fix (rename a league, or add one) is on
    // this same screen.
    expect(html).toContain("Eredivisie");
    expect(html).toContain("skipped");
    expect(html).toContain("World setup");
  });

  it("shows it on the plain New League screen too", () => {
    const html = renderNewLeague("/new-league");
    expect(html).toContain("World setup");
    // Offered, but shut: the editor is a tall block and this page is for
    // picking a club. What has to be present is the way in, plus the summary
    // that says what world you would get without opening it.
    expect(html).toContain('aria-controls="world-setup-body"');
    expect(html).toContain("12 countries, 24 divisions, 420 clubs");
    expect(html).not.toContain("Add a league");
  });

  it("opens the editor for a roster import, since that is where the fix lives", () => {
    // A file naming a league this world hasn't got is skipped entirely, and
    // adding or renaming a league in the editor is the only thing that makes it
    // apply — so collapsing it here would hide the cure behind a card the
    // warning merely points at.
    const html = renderNewLeague("/new-league?roster=1", [
      { name: "netherlands.json", file: rosterFile() },
    ]);
    expect(html).toContain("Add a league");
  });

  it("offers roster files from the plain screen, so both ways in do the same things", () => {
    const html = renderNewLeague("/new-league");
    expect(html).toContain("Load roster files");
  });

  it("still shows the file picker first when roster mode starts empty", () => {
    const html = renderNewLeague("/new-league?roster=1");
    expect(html).toContain("Choose Roster Files");
    // The explainer screen, not the club picker: the world editor comes with the
    // step that has a world to show.
    expect(html).not.toContain("World setup");
  });

  it("resolves a file against the world rather than a fixed one", () => {
    // A file aimed at a league the world DOES have lands on its clubs, which is
    // the same resolution path the reshaped-world case relies on.
    const html = renderNewLeague("/new-league?roster=1", [
      { name: "england.json", file: rosterFile("English Division 1") },
    ]);
    expect(html).toContain("Amsterdam XI");
    // The clubs landed, so no unmatched-competition warning — as distinct from
    // the standing hint, which explains what skipping means and always shows.
    expect(html).not.toContain("No competition named");
  });
});
