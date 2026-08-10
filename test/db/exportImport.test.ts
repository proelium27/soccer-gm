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

  it("names the mix-up when handed a teams file instead of a saved game", async () => {
    // The two imports take different files and their buttons sit one page
    // apart, so this is the easy mistake to make. Before, it surfaced as a
    // confusing 'missing "players" array'.
    const rosterFile = buildRosterFile(makeLeague(0, 1));
    await expect(
      importLeagueJSON(jsonFile("soccer-gm-teams-england.json", rosterFile)),
    ).rejects.toThrow(/teams file, not a saved game/i);
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
