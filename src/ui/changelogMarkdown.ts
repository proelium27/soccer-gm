import { createElement, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders one changelog entry's markdown.
 *
 * Entries were plain strings rendered as paragraphs until 2026-08-16, which
 * made every post a wall of prose. They are markdown now, so an entry can mix
 * paragraphs with lists and use emphasis where it earns its place.
 *
 * **Raw HTML is deliberately not enabled** (no `rehype-raw`). Entries are ours,
 * so this is not an injection defence so much as a guarantee that an entry is
 * text and cannot reach into the page's markup. The one place it bites: a bare
 * `<club>`-style placeholder is parsed as an HTML tag and dropped, so write it
 * in backticks. A test asserts no shipped entry carries one.
 *
 * Headings are capped at the card's own scale in `Changelog.tsx`, so an entry
 * cannot out-shout the title it sits under.
 */
export function renderChangelogMarkdown(source: string): ReactNode {
  return createElement(Markdown, {
    remarkPlugins: [remarkGfm],
    components: MARKDOWN_COMPONENTS,
    children: source,
  });
}

/**
 * Keep an entry's markup inside the card's visual hierarchy: any heading level
 * renders at the small bold size, tables get Bootstrap's compact styling, and
 * links open in a new tab since every one of them points off-app.
 */
const MARKDOWN_COMPONENTS = {
  h1: (props: object) => createElement("p", { ...props, className: "fw-semibold mb-1" }),
  h2: (props: object) => createElement("p", { ...props, className: "fw-semibold mb-1" }),
  h3: (props: object) => createElement("p", { ...props, className: "fw-semibold mb-1" }),
  h4: (props: object) => createElement("p", { ...props, className: "fw-semibold mb-1" }),
  h5: (props: object) => createElement("p", { ...props, className: "fw-semibold mb-1" }),
  h6: (props: object) => createElement("p", { ...props, className: "fw-semibold mb-1" }),
  table: (props: object) =>
    createElement(
      "div",
      { className: "table-responsive" },
      createElement("table", { ...props, className: "table table-sm table-striped" }),
    ),
  a: (props: object) =>
    createElement("a", { ...props, target: "_blank", rel: "noreferrer" }),
} as const;

/**
 * One entry's `items` as a single markdown document.
 *
 * `items` predates markdown: each string was one paragraph, and the legacy
 * `list` flag turned all of them into bullets. Joining with a blank line
 * reproduces both exactly (a blank line is a paragraph break in markdown), so
 * every entry written before this renders unchanged while a new one can put
 * whatever markdown it likes inside a string.
 */
export function changelogSource(items: string[], list?: boolean): string {
  return list
    ? items.map((item) => `- ${item}`).join("\n")
    : items.join("\n\n");
}
