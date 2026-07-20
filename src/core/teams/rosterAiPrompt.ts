import type { LeagueStore } from "../leagueState.js";
import { POSITIONS, SKILL_KEYS } from "../players/types.js";
import { ROSTER_FILE_FORMAT, ROSTER_FILE_VERSION } from "./rosterFile.js";

/**
 * Build a ready-to-paste instruction block that teaches an AI assistant the
 * exact roster-file format, tailored to a specific save. The importer maps
 * clubs to competitions *by name*, so the prompt must list this world's real
 * competition names and slot counts — a generic prompt would produce a file
 * whose competitions don't match and silently apply nothing.
 */
export function buildImportPromptText(league: LeagueStore): string {
  const comps = league.competitions.map((c) => {
    const slots = league.teams.filter((t) => t.compId === c.id).length;
    return `  - "${c.name}" (${c.country}) — ${slots} club slots`;
  });

  const example = {
    format: ROSTER_FILE_FORMAT,
    formatVersion: ROSTER_FILE_VERSION,
    competitions: [
      {
        match: league.competitions[0]?.name ?? "English Division 1",
        clubs: [
          {
            name: "Example City",
            abbrev: "EXC",
            colors: ["#6cabdd", "#ffffff"],
            players: [
              { name: "Star Striker", pos: "ST", age: 24, overall: 88, nationality: "Norway" },
              {
                name: "Playmaker",
                pos: "AM",
                age: 29,
                ratings: Object.fromEntries(SKILL_KEYS.map((k) => [k, 80])),
              },
            ],
          },
          { name: "Rivals United", abbrev: "RVU", colors: ["#c0392b", "#ffffff"] },
        ],
      },
    ],
  };

  return [
    "I want you to create a roster file for the soccer management game soccer-gm.",
    "It overlays real club names and (optionally) real squads onto my save. Output ONE valid JSON file in exactly the format described below — no prose, no markdown fences, just the JSON.",
    "",
    "== My world's competitions ==",
    "Use these EXACT competition names in the `match` field (case doesn't matter). Each has this many club slots; the clubs you list fill them in order (first entry = first slot). List up to that many; you can list fewer and leave the rest as they are.",
    ...comps,
    "",
    "== File shape ==",
    "{",
    `  "format": "${ROSTER_FILE_FORMAT}",`,
    `  "formatVersion": ${ROSTER_FILE_VERSION},`,
    '  "competitions": [ { "match": "<competition name>", "clubs": [ <club>, ... ] }, ... ]',
    "}",
    "",
    "A <club> is:",
    '  { "name": string, "abbrev": string (2-4 letters), "colors": [primaryHex, secondaryHex], "players"?: [ <player>, ... ] }',
    "- Omit `players` to change only the club's name/abbrev/colors and keep its existing squad.",
    "- Include `players` to give it a real squad. That REPLACES the club's current players, so do this on a fresh save.",
    "- You don't have to list a full squad — whatever positions you leave short are auto-filled with lower-rated reserves so the team is always playable. A realistic first XI plus a few subs is plenty.",
    "",
    "A <player> is:",
    '  { "name": string, "pos": <position>, "age": number 15-45, ...ability, "nationality"?: string, "heightCm"?: number, "potential"?: number }',
    `- <position> is one of: ${POSITIONS.join(", ")} (GK=keeper, CB=centre-back, FB=full-back, DM=defensive mid, CM=central mid, AM=attacking mid, W=winger, ST=striker).`,
    "- ability: give EITHER an `overall` (a single 1-99 rating; the game builds sensible position-appropriate ratings to match it) OR an exact `ratings` object with all of these keys, each 1-99:",
    `    ${SKILL_KEYS.join(", ")}.`,
    "  Prefer `overall` unless you specifically want to hand-tune every attribute.",
    "- `potential` (optional, 1-99) is the player's ceiling; if omitted the game estimates it. `heightCm` and `nationality` are optional flavor.",
    "",
    "== Example ==",
    JSON.stringify(example, null, 2),
    "",
    "Now build the file for the competition(s) I ask for, using real clubs and players. Output only the JSON.",
  ].join("\n");
}
