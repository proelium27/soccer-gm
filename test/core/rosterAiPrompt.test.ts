import { describe, it, expect } from "vitest";
import { makeLeague } from "../helpers/league.js";
import { buildImportPromptText } from "../../src/core/teams/rosterAiPrompt.js";
import { parseRosterFile } from "../../src/core/teams/rosterFile.js";
import { POSITIONS, SKILL_KEYS } from "../../src/core/players/types.js";

const league = makeLeague(0, 3, 3);

describe("buildImportPromptText", () => {
  const prompt = buildImportPromptText(league);

  it("names the format and version", () => {
    expect(prompt).toContain("world-soccer-sim-roster");
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

  // The two ways a roster file silently applies nothing, per resolveRosterSlots:
  // an unrecognised `match` drops the whole competition, and an over-long club
  // list truncates from the end. Both were hit for real on 2026-08-29, so the
  // prompt has to warn about each by name.
  it("warns that an unmatched competition name is dropped in silence", () => {
    expect(prompt).toContain("never build one out of the country's name");
    expect(prompt).toMatch(/skipped with no error/i);
  });

  it("names a real competition whose name is not its country's", () => {
    // The warning is only convincing with an example, and it is taken from the
    // world so it stays true for a custom one.
    const odd = league.competitions.find(
      (c) => !c.name.toLowerCase().startsWith(c.country.toLowerCase()),
    );
    expect(odd).toBeDefined();
    expect(prompt).toContain(`this world calls ${odd!.country}'s top division "${odd!.name}"`);
  });

  it("caps the club list at the slot count and says what overflow costs", () => {
    expect(prompt).toContain("NEVER list more clubs than a competition's slot count");
    expect(prompt).toMatch(/thrown away from the END/);
  });

  it("says the divisions are different sizes when they are", () => {
    const sizes = new Set(
      league.competitions.map((c) => league.teams.filter((t) => t.compId === c.id).length),
    );
    expect(sizes.size).toBeGreaterThan(1);
    expect(prompt).toMatch(/deliberately different sizes/);
  });

  it("tells the AI to report a missing league rather than invent a name for it", () => {
    expect(prompt).toContain("Don't invent a competition");
  });

  // The regression test for the actual bug: three hand-authored files used
  // "Scotland/Greece/Serbia Division 1" — the `<country> Division N` form a
  // league ADDED in World setup gets — against shipped names like "Scottish
  // Division 1", and resolved to zero clubs. The prompt must never put that
  // form in front of an AI for a competition that isn't really called it.
  it("never shows the <country> Division N form for a competition not named that", () => {
    for (const c of league.competitions) {
      const constructed = `${c.country} Division ${c.tier}`;
      if (constructed.toLowerCase() === c.name.toLowerCase()) continue;
      expect(prompt).not.toContain(constructed);
    }
  });

  it("ends with a checklist covering both silent failures", () => {
    const checklist = prompt.slice(prompt.indexOf("== Check these before you answer =="));
    expect(checklist).toContain("character for character");
    expect(checklist).toContain("more clubs than its slot count");
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
