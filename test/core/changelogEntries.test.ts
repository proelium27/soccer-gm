import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CHANGELOG } from "../../src/core/changelog/index.js";

const ENTRIES_DIR = fileURLToPath(new URL("../../src/core/changelog/entries/", import.meta.url));
const FILENAME = /^(\d{4}-\d{2}-\d{2})-(\d{2})-[a-z0-9-]+\.ts$/;

/**
 * The changelog's ordering is *derived*, never authored: newest `date` first,
 * then filename ascending so the `NN` slot breaks a same-day tie. That is what
 * lets two open PRs each ship an entry without touching a shared list — the
 * conflict the one-file-per-entry layout exists to prevent.
 *
 * It only works while the filename and the `date` field agree. If they drift,
 * nothing throws and the page still renders; entries just quietly sort into the
 * wrong order, which is the sort of thing nobody notices until the changelog
 * reads oddly months later. Hence this file. It is also the only check on the
 * naming convention itself, which two accounts follow from a doc comment.
 */
describe("changelog entries", () => {
  const files = readdirSync(ENTRIES_DIR).filter((f) => f.endsWith(".ts")).sort();

  it("finds the entries (guards the reader itself)", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(CHANGELOG.length).toBe(files.length);
  });

  it("names every file YYYY-MM-DD-NN-slug.ts", () => {
    for (const f of files) {
      expect(f, `${f} does not match the entry naming convention`).toMatch(FILENAME);
    }
  });

  it("gives every entry a real date matching its filename", () => {
    // A mismatch sorts the entry by one date while its filename claims another,
    // so same-day ordering silently stops meaning anything.
    const byDate = new Map<string, string[]>();
    for (const f of files) {
      const date = FILENAME.exec(f)![1];
      byDate.set(date, [...(byDate.get(date) ?? []), f]);
      expect(new Date(date).toString(), `${f} has an unparseable date`).not.toBe("Invalid Date");
    }
    for (const entry of CHANGELOG) {
      expect(byDate.has(entry.date), `no entry file is dated ${entry.date}`).toBe(true);
    }
  });

  it("is ordered newest first", () => {
    const dates = CHANGELOG.map((e) => e.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("gives every entry a title and at least one item", () => {
    for (const e of CHANGELOG) {
      expect(e.title.trim(), `${e.date} has an empty title`).not.toBe("");
      expect(e.items.length, `${e.date} "${e.title}" has no items`).toBeGreaterThan(0);
      for (const item of e.items) {
        expect(item.trim(), `${e.date} "${e.title}" has an empty item`).not.toBe("");
      }
    }
  });

  // NOT asserted here: CLAUDE.md's "no em-dashes in player-facing prose" rule.
  // Five shipped entries break it (2026-08-10-02, -08-12-01, -08-17-02,
  // -08-18-01, -08-19-01), so a test would fail on existing content, and
  // rewriting shipped entries — or relaxing the rule — is a call for whoever
  // owns the voice, not something to settle by adding an assertion.
});
