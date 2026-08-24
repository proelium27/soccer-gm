import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { GroupStandings, type StandingRow } from "../../src/ui/pages/nationalTeams/shared.js";

/**
 * The National Teams tables mark two things: the nations through from a group,
 * and (on Rosters) the eleven a nation would field. Both used Bootstrap's
 * `.table-success`, which compiles to a fixed light-theme mint with black text
 * and ignores the app's tokens entirely — a pale slab on the dark pages, with
 * every link inside it dropped to about 2:1 contrast.
 *
 * These pin the replacement so nobody reaches back for a contextual `.table-*`
 * class: none of them are themed, and the failure is silent (it renders, it
 * just renders wrong).
 */

const ROWS: StandingRow[] = ["Germany", "Spain", "Italy", "France"].map((nation, i) => ({
  nation,
  played: 3,
  won: 3 - i,
  drawn: 0,
  lost: i,
  gf: 6 - i,
  ga: i,
  gd: 6 - 2 * i,
  points: 9 - 3 * i,
}));

function renderGroup(advancing: number): string {
  const through = new Set(ROWS.slice(0, advancing).map((r) => r.nation));
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(GroupStandings, { rows: ROWS, highlight: (n: string) => through.has(n) }),
    ),
  );
}

describe("National Teams group standings", () => {
  it("marks the advancing rows with the themed highlight", () => {
    const html = renderGroup(2);
    expect(html.split('class="row-selected"').length - 1).toBe(2);
  });

  it("never falls back to an unthemed Bootstrap contextual class", () => {
    const html = renderGroup(2);
    for (const cls of ["table-success", "table-info", "table-warning", "table-danger"]) {
      expect(html).not.toContain(cls);
    }
  });

  it("leaves every other row unmarked", () => {
    const html = renderGroup(0);
    expect(html).not.toContain("row-selected");
  });
});
