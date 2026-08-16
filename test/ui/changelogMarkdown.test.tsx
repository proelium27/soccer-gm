import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { Changelog } from "../../src/ui/pages/Changelog.js";
import { CHANGELOG } from "../../src/core/changelog/index.js";
import { renderChangelogMarkdown, changelogSource } from "../../src/ui/changelogMarkdown.js";

/**
 * Entries are markdown as of 2026-08-16, so an entry can mix paragraphs, lists
 * and inline emphasis instead of being a wall of prose paragraphs.
 *
 * The risk this guards is not "does markdown work" but "did switching 57
 * already-written entries onto a markdown renderer quietly change any of them".
 */
function md(source: string): string {
  return renderToStaticMarkup(createElement("div", null, renderChangelogMarkdown(source)));
}

describe("changelog markdown", () => {
  it("turns a dash list into real list items", () => {
    const html = md("- first\n- second");
    expect(html).toContain("<li>first</li>");
    expect(html).toContain("<li>second</li>");
  });

  it("mixes a paragraph with a list in one entry", () => {
    const html = md("Opening line.\n\n- a bullet\n\nClosing line.");
    expect(html).toContain("<p>Opening line.</p>");
    expect(html).toContain("<li>a bullet</li>");
    expect(html).toContain("<p>Closing line.</p>");
  });

  it("renders inline emphasis and code", () => {
    expect(md("a **bold** word")).toContain("<strong>bold</strong>");
    expect(md("an `avgRating` field")).toContain("<code>avgRating</code>");
  });

  it("supports GFM tables and strikethrough", () => {
    expect(md("| a | b |\n| - | - |\n| 1 | 2 |")).toContain("<table");
    expect(md("~~gone~~")).toContain("<del>gone</del>");
  });

  it("does not render raw HTML, so an entry cannot inject markup", () => {
    // Raw HTML is escaped to visible text, not executed: no element is built.
    const html = md('<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("keeps an angle-bracket placeholder visible without needing backticks", () => {
    // A shipped entry uses "Sold to <club>" as a placeholder. Escaping (rather
    // than dropping) the tag is what lets it survive untouched, so no already
    // written entry had to be edited for the switch to markdown.
    expect(md("Sold to <club>")).toContain("Sold to &lt;club&gt;");
  });
});

describe("existing entries survive the switch to markdown", () => {
  it("renders every entry without throwing", () => {
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(Changelog)),
    );
    expect(html).toContain("Changelog");
    // One card per entry.
    expect((html.match(/class="card mb-3"/g) ?? []).length).toBe(CHANGELOG.length);
  });

  it("still shows the one entry that contains an angle-bracket placeholder", () => {
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(Changelog)),
    );
    expect(html).toContain("Sold to &lt;club&gt;");
  });

  it("renders a legacy list-flag entry as bullets", () => {
    // Three entries predate markdown and set `list: true`; joining their items
    // with "- " has to keep reproducing that, or they silently become one
    // run-on paragraph.
    const legacy = CHANGELOG.find((e) => e.list);
    expect(legacy).toBeDefined();
    expect(md(changelogSource(legacy!.items, legacy!.list))).toContain("<li>");
  });
});
