import { describe, expect, it } from "vitest";
import { CHANGELOG } from "../../src/core/changelog/index.js";
import type { ChangelogEntry } from "../../src/core/changelog/types.js";

/**
 * The changelog is assembled by globbing `src/core/changelog/entries/*.ts`
 * rather than from a hand-written list, so nothing in the repo asserts that a
 * new entry file is well-formed or lands in the right place. These do.
 *
 * The glob is repeated here (rather than exported from the module under test)
 * so the filename↔content checks compare against the real filenames.
 */
const files = import.meta.glob<ChangelogEntry>("../../src/core/changelog/entries/*.ts", {
  eager: true,
  import: "default",
});

const FILENAME_RE = /^(\d{4}-\d{2}-\d{2})-(\d{2})-[a-z0-9-]+\.ts$/;

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

describe("changelog entries", () => {
  it("finds entry files at all", () => {
    // A broken glob pattern silently yields {} and would empty the page.
    expect(Object.keys(files).length).toBeGreaterThan(0);
    expect(CHANGELOG.length).toBe(Object.keys(files).length);
  });

  it("names every file YYYY-MM-DD-NN-slug.ts", () => {
    for (const path of Object.keys(files)) {
      expect(basename(path)).toMatch(FILENAME_RE);
    }
  });

  it("gives every entry a date matching its filename, a title, and items", () => {
    for (const [path, entry] of Object.entries(files)) {
      const name = basename(path);
      const datePrefix = FILENAME_RE.exec(name)?.[1];
      expect(entry, name).toBeTruthy();
      expect(entry.date, name).toBe(datePrefix);
      // A real calendar date, not just a well-shaped string.
      const [y, m, d] = entry.date.split("-").map(Number);
      const parsed = new Date(y, m - 1, d);
      expect([parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate()], name).toEqual([y, m, d]);
      expect(entry.title.trim().length, name).toBeGreaterThan(0);
      expect(entry.items.length, name).toBeGreaterThan(0);
      for (const item of entry.items) expect(item.trim().length, name).toBeGreaterThan(0);
    }
  });

  it("orders newest first, and same-day entries by filename", () => {
    for (let i = 1; i < CHANGELOG.length; i++) {
      expect(CHANGELOG[i - 1].date >= CHANGELOG[i].date).toBe(true);
    }
    const expected = Object.keys(files)
      .sort()
      .map((path) => files[path])
      .sort((a, b) => b.date.localeCompare(a.date));
    expect(CHANGELOG.map((e) => e.title)).toEqual(expected.map((e) => e.title));
  });
});
