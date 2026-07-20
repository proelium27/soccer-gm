import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { applyTeamIdentities } from "../../src/core/teams/customize.js";
import {
  buildRosterFile,
  parseRosterFile,
  rosterFileToEdits,
} from "../../src/core/teams/rosterFile.js";

const base = createLeagueState(0, mulberry32(7), 7);
// NewLeague names the league after the user's club; mirror that.
const league = { ...base, meta: { ...base.meta, name: base.teams[0].name } };

describe("buildRosterFile", () => {
  it("emits one competition entry per league competition, in table order", () => {
    const file = buildRosterFile(league);
    expect(file.format).toBe("soccer-gm-roster");
    expect(file.formatVersion).toBe(1);
    expect(file.competitions.map((c) => c.match)).toEqual(
      league.competitions.map((c) => c.name),
    );
  });

  it("lists each competition's clubs in ascending-tid slot order", () => {
    const file = buildRosterFile(league);
    for (const comp of league.competitions) {
      const entry = file.competitions.find((c) => c.match === comp.name)!;
      const expected = league.teams
        .filter((t) => t.compId === comp.id)
        .sort((a, b) => a.tid - b.tid)
        .map((t) => t.name);
      expect(entry.clubs.map((c) => c.name)).toEqual(expected);
    }
  });
});

describe("roundtrip (export -> apply)", () => {
  it("export then re-import leaves every identity unchanged", () => {
    const file = buildRosterFile(league);
    const { edits, warnings } = rosterFileToEdits(league, file);
    expect(warnings).toEqual([]);
    const updated = applyTeamIdentities(league, edits);
    for (const t of updated.teams) {
      expect(t.name).toBe(league.teams[t.tid].name);
      expect(t.abbrev).toBe(league.teams[t.tid].abbrev);
      expect(t.colors).toEqual(league.teams[t.tid].colors);
    }
  });
});

describe("rosterFileToEdits", () => {
  it("maps clubs positionally onto the matched competition's slots", () => {
    const comp = league.competitions[0];
    const file = parseRosterFile(
      JSON.stringify({
        format: "soccer-gm-roster",
        formatVersion: 1,
        competitions: [
          {
            match: comp.name,
            clubs: [
              { name: "Real Club", abbrev: "rcl", colors: ["#111111", "#222222"] },
              { name: "Second Club", abbrev: "SEC", colors: ["#333333", "#444444"] },
            ],
          },
        ],
      }),
    );
    const { edits, warnings } = rosterFileToEdits(league, file);
    expect(warnings).toEqual([]);
    const slots = league.teams
      .filter((t) => t.compId === comp.id)
      .sort((a, b) => a.tid - b.tid);
    expect(edits[0].tid).toBe(slots[0].tid);
    expect(edits[0].name).toBe("Real Club");
    expect(edits[1].tid).toBe(slots[1].tid);

    // Only the two named slots are touched once applied.
    const updated = applyTeamIdentities(league, edits);
    expect(updated.teams[slots[0].tid].name).toBe("Real Club");
    expect(updated.teams[slots[0].tid].abbrev).toBe("RCL"); // applyTeamIdentities uppercases
    expect(updated.teams[slots[2].tid].name).toBe(league.teams[slots[2].tid].name);
  });

  it("matches competition names case-insensitively", () => {
    const comp = league.competitions[0];
    const file = parseRosterFile(
      JSON.stringify({
        format: "soccer-gm-roster",
        formatVersion: 1,
        competitions: [
          { match: comp.name.toUpperCase(), clubs: [{ name: "X", abbrev: "X", colors: ["#000000", "#ffffff"] }] },
        ],
      }),
    );
    const { edits, warnings } = rosterFileToEdits(league, file);
    expect(warnings).toEqual([]);
    expect(edits).toHaveLength(1);
  });

  it("warns and skips an unknown competition name", () => {
    const file = parseRosterFile(
      JSON.stringify({
        format: "soccer-gm-roster",
        formatVersion: 1,
        competitions: [
          { match: "Martian Premier League", clubs: [{ name: "X", abbrev: "X", colors: ["#000000", "#ffffff"] }] },
        ],
      }),
    );
    const { edits, warnings } = rosterFileToEdits(league, file);
    expect(edits).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Martian Premier League");
  });

  it("warns and ignores clubs beyond the competition's slot count", () => {
    const comp = league.competitions[0];
    const slotCount = league.teams.filter((t) => t.compId === comp.id).length;
    const clubs = Array.from({ length: slotCount + 3 }, (_, i) => ({
      name: `Club ${i}`,
      abbrev: `C${i}`,
      colors: ["#000000", "#ffffff"] as [string, string],
    }));
    const file = parseRosterFile(
      JSON.stringify({ format: "soccer-gm-roster", formatVersion: 1, competitions: [{ match: comp.name, clubs }] }),
    );
    const { edits, warnings } = rosterFileToEdits(league, file);
    expect(edits).toHaveLength(slotCount);
    expect(warnings.some((w) => w.includes("ignored"))).toBe(true);
  });
});

describe("parseRosterFile validation", () => {
  it("rejects non-JSON", () => {
    expect(() => parseRosterFile("not json")).toThrow(/not valid JSON/);
  });
  it("rejects a wrong format tag", () => {
    expect(() => parseRosterFile(JSON.stringify({ format: "nope", formatVersion: 1, competitions: [] }))).toThrow(/format/);
  });
  it("rejects an unsupported version", () => {
    expect(() => parseRosterFile(JSON.stringify({ format: "soccer-gm-roster", formatVersion: 99, competitions: [] }))).toThrow(/version/);
  });
  it("rejects a missing competitions array", () => {
    expect(() => parseRosterFile(JSON.stringify({ format: "soccer-gm-roster", formatVersion: 1 }))).toThrow(/competitions/);
  });
  it("names the offending path on a malformed club", () => {
    expect(() =>
      parseRosterFile(
        JSON.stringify({
          format: "soccer-gm-roster",
          formatVersion: 1,
          competitions: [{ match: "English Division 1", clubs: [{ name: "ok", abbrev: "OK", colors: ["#000000"] }] }],
        }),
      ),
    ).toThrow(/competitions\[0\]\.clubs\[0\]\.colors/);
  });
});
