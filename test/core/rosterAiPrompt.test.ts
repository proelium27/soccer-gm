import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng.js";
import { createLeagueState } from "../../src/core/leagueState.js";
import { buildImportPromptText } from "../../src/core/teams/rosterAiPrompt.js";
import { parseRosterFile } from "../../src/core/teams/rosterFile.js";
import { POSITIONS, SKILL_KEYS } from "../../src/core/players/types.js";

const league = createLeagueState(0, mulberry32(3), 3);

describe("buildImportPromptText", () => {
  const prompt = buildImportPromptText(league);

  it("names the format and version", () => {
    expect(prompt).toContain("soccer-gm-roster");
    expect(prompt).toContain("formatVersion");
  });

  it("lists this save's actual competitions with slot counts", () => {
    for (const c of league.competitions) {
      expect(prompt).toContain(`"${c.name}"`);
    }
    // Slot count for a competition appears (e.g. "20 club slots").
    const anyComp = league.competitions[0];
    const slots = league.teams.filter((t) => t.compId === anyComp.id).length;
    expect(prompt).toContain(`${slots} club slots`);
  });

  it("documents every position and skill key so an AI can produce exact ratings", () => {
    for (const p of POSITIONS) expect(prompt).toContain(p);
    for (const k of SKILL_KEYS) expect(prompt).toContain(k);
  });

  it("embeds an example that itself parses as a valid roster file", () => {
    const start = prompt.indexOf("== Example ==");
    expect(start).toBeGreaterThan(-1);
    const jsonStart = prompt.indexOf("{", start);
    // The example is the last JSON block; grab from its opening brace to the
    // final closing brace before the trailing instruction line.
    const jsonText = prompt.slice(jsonStart, prompt.lastIndexOf("}") + 1);
    const parsed = parseRosterFile(jsonText);
    expect(parsed.competitions.length).toBeGreaterThan(0);
    expect(parsed.competitions[0].clubs[0].players?.length).toBeGreaterThan(0);
  });
});
