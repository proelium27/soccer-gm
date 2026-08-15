/**
 * Shape of one player-facing changelog entry. Lives in its own module so an
 * entry file can `import type` it without pulling in the glob in `index.ts`
 * (which would be a cycle: index imports every entry, every entry imports index).
 */
export interface ChangelogEntry {
  /** ISO calendar date (YYYY-MM-DD); the page formats it for display. */
  date: string;
  title: string;
  /** Each string is one paragraph (default) or one bullet (when `list` is true). */
  items: string[];
  /** Render `items` as a bulleted list instead of prose paragraphs — only for feature enumerations. */
  list?: boolean;
}
