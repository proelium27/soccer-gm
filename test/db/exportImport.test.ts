import { describe, it, expect } from "vitest";
import { makeLeague } from "../helpers/league.js";
import { importLeagueJSON } from "../../src/db/exportImport.js";
import { buildRosterFile } from "../../src/core/teams/rosterFile.js";

/** A stand-in for the browser File the import UI hands over. */
function jsonFile(name: string, value: unknown): File {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return new File([text], name, { type: "application/json" });
}

describe("importLeagueJSON", () => {
  it("round-trips a full save export", async () => {
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
