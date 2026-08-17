/**
 * Shape of one player-facing changelog entry. Lives in its own module so an
 * entry file can `import type` it without pulling in the glob in `index.ts`
 * (which would be a cycle: index imports every entry, every entry imports index).
 */
export interface ChangelogEntry {
  /** ISO calendar date (YYYY-MM-DD); the page formats it for display. */
  date: string;
  title: string;
  /**
   * The entry body, as **markdown** (GFM). Strings are joined with a blank
   * line, so each one is its own block — the shape every entry written before
   * 2026-08-16 relies on, when an item was simply one paragraph.
   *
   * Use whatever markdown suits the entry: paragraphs, `-` lists, `**bold**`,
   * `` `code` ``, tables. Raw HTML is not rendered (it shows as literal text),
   * so angle brackets in prose are safe.
   */
  items: string[];
  /**
   * Legacy: renders every item as a bullet. Predates markdown, when bullets
   * were all-or-nothing for an entry. Three entries still set it and it is kept
   * working for them; new entries write `-` in the markdown instead, which can
   * mix lists and paragraphs in the same entry.
   */
  list?: boolean;
}
