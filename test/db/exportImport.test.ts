import { describe, it, expect } from "vitest";
import { makeLeague } from "../helpers/league.js";
import {
  encodeLeagueFile,
  importLeagueJSON,
  readLeagueFileText,
} from "../../src/db/exportImport.js";
import { buildRosterFile } from "../../src/core/teams/rosterFile.js";

/** A stand-in for the browser File the import UI hands over. */
function jsonFile(name: string, value: unknown): File {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return new File([text], name, { type: "application/json" });
}

/** The file the export button now writes: compact JSON, gzipped. */
async function exportedFile(league: unknown): Promise<File> {
  const bytes = await encodeLeagueFile(league as never);
  return new File([bytes], "save.json.gz", { type: "application/gzip" });
}

describe("encodeLeagueFile", () => {
  it("writes gzip, not plain text", async () => {
    const bytes = await encodeLeagueFile(makeLeague(0, 1));
    // The two-byte gzip magic number. Import sniffs for exactly this, so if the
    // encoder ever stops emitting it, every export silently becomes unreadable.
    expect([bytes[0], bytes[1]]).toEqual([0x1f, 0x8b]);
  });

  it("writes compact JSON, not the pretty-printed form", async () => {
    // Half the old file was indentation whitespace. Nothing reads the export as
    // formatted text, so the indentation was pure cost.
    const league = makeLeague(0, 1);
    const text = await readLeagueFileText(await exportedFile(league));
    expect(text).toBe(JSON.stringify(league));
  });

  it("is dramatically smaller than the pretty-printed JSON it replaces", async () => {
    const league = makeLeague(0, 1);
    const before = JSON.stringify(league, null, 2).length;
    const after = (await encodeLeagueFile(league)).length;
    expect(after).toBeLessThan(before / 5);
  });
});

describe("readLeagueFileText", () => {
  it("passes an uncompressed file through unchanged", async () => {
    const text = await readLeagueFileText(jsonFile("plain.json", { a: 1 }));
    expect(text).toBe('{"a":1}');
  });

  it("decompresses a gzipped file", async () => {
    const gz = await encodeLeagueFile({ a: 1 } as never);
    const text = await readLeagueFileText(new File([gz], "x.json.gz"));
    expect(text).toBe('{"a":1}');
  });
});

describe("importLeagueJSON", () => {
  it("round-trips a gzipped save export", async () => {
    const league = makeLeague(0, 1);
    const imported = await importLeagueJSON(await exportedFile(league));
    expect(imported.meta.name).toBe(league.meta.name);
    expect(imported.season).toBe(league.season);
    expect(imported.players).toHaveLength(league.players.length);
    expect(imported.teams).toHaveLength(league.teams.length);
  });

  it("still reads an uncompressed save exported by an older build", async () => {
    const league = makeLeague(0, 1);
    const imported = await importLeagueJSON(jsonFile("save.json", league));
    expect(imported.meta.name).toBe(league.meta.name);
    expect(imported.meta.userTid).toBe(league.meta.userTid);
    expect(imported.season).toBe(league.season);
    expect(imported.players).toHaveLength(league.players.length);
    expect(imported.teams).toHaveLength(league.teams.length);
  });

  it("names the mix-up when handed a roster file instead of a saved game", async () => {
    // Reachable from the New League screen's "Import League", which takes only
    // a save. Before, this surfaced as a confusing 'missing "players" array'.
    const rosterFile = buildRosterFile(makeLeague(0, 1));
    await expect(
      importLeagueJSON(jsonFile("soccer-gm-teams-england.json", rosterFile)),
    ).rejects.toThrow(/roster file, not a saved game/i);
  });

  it("recognizes a roster file written before the format was renamed", async () => {
    // Files carrying the old tag are already in people's hands, so they must
    // still get the helpful message rather than a field-validation error.
    const legacy = { ...buildRosterFile(makeLeague(0, 1)), format: "soccer-gm-roster" };
    await expect(
      importLeagueJSON(jsonFile("old-teams-file.json", legacy)),
    ).rejects.toThrow(/roster file, not a saved game/i);
  });

  it("rejects a file that is not JSON", async () => {
    await expect(
      importLeagueJSON(jsonFile("notes.json", "this is not json")),
    ).rejects.toThrow(/invalid JSON/i);
  });

  it("rejects a JSON object that is missing league fields", async () => {
    await expect(
      importLeagueJSON(jsonFile("half.json", { teams: [], players: [] })),
    ).rejects.toThrow(/schedule/);
  });

  it("names the offending file in its errors", async () => {
    await expect(
      importLeagueJSON(jsonFile("my-save.json", { nope: true })),
    ).rejects.toThrow(/my-save\.json/);
  });
});
