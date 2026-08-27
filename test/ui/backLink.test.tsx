import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { BackLink } from "../../src/ui/components/BackLink.js";

function render(entries: string[], index: number): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: entries, initialIndex: index },
      createElement(BackLink, { fallback: "/leaders" }),
    ),
  );
}

/**
 * There's no DOM test environment here, so what's pinned is the branch choice:
 * a page opened cold gets a real link to the fallback, and a page reached from
 * somewhere else in the game gets the anchor whose click steps back instead.
 * The step itself is react-router's `navigate(-1)`.
 */
describe("BackLink", () => {
  it("links to the fallback when there's nothing to go back to", () => {
    const html = render(["/player/12"], 0);
    expect(html).toContain('href="/leaders"');
    expect(html).toContain("Back");
  });

  it("still points at the fallback href when it will step back instead", () => {
    // Middle-click and open-in-new-tab follow the href, so it has to stay a
    // real destination even on the branch that intercepts an ordinary click.
    const html = render(["/news", "/player/12"], 1);
    expect(html).toContain('href="/leaders"');
  });
});
