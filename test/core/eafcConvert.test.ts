/**
 * Tests for the EA FC roster converter (scripts/eafc/).
 *
 * The converter is a dev-only tool, but it feeds the game's real importer, so
 * the tests that matter most are the round-trip ones: whatever it emits must
 * survive parseRosterFile and applyRosterFile, and must land inside soccer-gm's
 * own rating band rather than EA's.
 *
 * The fixture CSV is synthesized here rather than checked in — no EA-derived
 * data belongs in the repo.
 */
import { describe, it, expect } from "vitest";
import { makeLeague } from "../helpers/league.js";
import { parseCsv, readCsvTable, normalizeHeader } from "../../scripts/eafc/csv.js";
import { resolveColumns } from "../../scripts/eafc/schema.js";
import { mapPosition } from "../../scripts/eafc/positions.js";
import { mapLeague, buildLeagueResolver } from "../../scripts/eafc/leagues.js";
import { mapNation } from "../../scripts/eafc/nations.js";
import { buildRescaler } from "../../scripts/eafc/scale.js";
import { deriveAbbrev, uniquifyAbbrevs } from "../../scripts/eafc/identity.js";
import { convert } from "../../scripts/eafc/convert.js";
import { parseRosterFile, type RosterFile } from "../../src/core/teams/rosterFile.js";
import { applyRosterFile } from "../../src/core/teams/rosterImport.js";
import { mergeRosterFiles } from "../../scripts/eafc/mergeRosterFiles.js";
import { computeOvr } from "../../src/core/players/ovr.js";
import { mulberry32 } from "../../src/engine/rng.js";

// --- Synthetic EA-style fixture -------------------------------------------

const LONG_HEADERS = [
  "short_name", "player_positions", "overall", "potential", "age", "height_cm",
  "club_name", "league_name", "nationality_name",
  "pace", "shooting", "passing", "dribbling", "defending", "physic",
  "attacking_crossing", "attacking_finishing", "attacking_short_passing",
  "skill_dribbling", "skill_long_passing", "skill_ball_control",
  "movement_acceleration", "movement_sprint_speed",
  "power_jumping", "power_stamina", "power_strength", "power_long_shots",
  "mentality_interceptions", "mentality_positioning",
  "defending_marking_awareness", "defending_standing_tackle", "defending_sliding_tackle",
  "goalkeeping_diving", "goalkeeping_handling", "goalkeeping_positioning", "goalkeeping_reflexes",
];

const SQUAD_SHAPE: [string, number][] = [
  ["GK", 3], ["CB", 4], ["LB", 2], ["RB", 2], ["CDM", 2],
  ["CM", 4], ["CAM", 2], ["LW", 2], ["RW", 1], ["ST", 3],
];

/**
 * Build a deterministic EA-shaped CSV: `clubs` clubs per league, each with a
 * 25-man squad whose overalls sit in a club-specific band, so club strength
 * ordering and the rescale both have something real to chew on.
 */
function makeCsv(leagues: string[], clubs = 20): string {
  const rng = mulberry32(99);
  const rows: string[][] = [LONG_HEADERS];

  for (const league of leagues) {
    for (let c = 0; c < clubs; c++) {
      // Strongest club first, tailing off — mirrors a real league's spread.
      const clubTop = 88 - c * 1.6;
      // A comma in the club name exercises the CSV quoting path.
      const clubName = c === 0 ? `Alpha, ${league} FC` : `${league} Club ${c}`;
      for (const [pos, count] of SQUAD_SHAPE) {
        for (let i = 0; i < count; i++) {
          const overall = Math.round(clubTop - i * 2.5 - rng() * 6);
          const potential = Math.min(94, overall + Math.round(rng() * 6));
          const age = 18 + Math.floor(rng() * 17);
          const isGk = pos === "GK";
          // Attributes keyed off overall with position-appropriate tilt, so
          // defenders really do tackle better than strikers.
          const a = (bias: number) => Math.max(1, Math.min(99, Math.round(overall + bias)));
          const def = ["CB", "LB", "RB", "CDM"].includes(pos) ? 8 : -18;
          const att = ["ST", "CAM", "LW", "RW"].includes(pos) ? 8 : -14;
          rows.push([
            `${pos}${c}_${i} ${league.replace(/\s+/g, "")}`,
            pos,
            String(overall), String(potential), String(age),
            String(isGk ? 190 : 175 + Math.floor(rng() * 15)),
            clubName, league, i % 3 === 0 ? "England" : "Korea Republic",
            String(a(att - 2)), String(a(att)), String(a(-2)), String(a(att - 1)),
            String(a(def)), String(a(2)),
            String(a(att - 4)), String(a(att)), String(a(0)),
            String(a(att - 1)), String(a(-3)), String(a(att - 2)),
            String(a(att - 3)), String(a(att - 1)),
            String(a(1)), String(a(3)), String(a(2)), String(a(att - 5)),
            String(a(def)), String(a(att - 1)),
            String(a(def)), String(a(def)), String(a(def - 2)),
            String(isGk ? a(4) : 10), String(isGk ? a(3) : 11),
            String(isGk ? a(2) : 9), String(isGk ? a(5) : 12),
          ]);
        }
      }
    }
  }

  return rows
    .map((r) => r.map((cell) => (cell.includes(",") ? `"${cell}"` : cell)).join(","))
    .join("\n");
}

// --- Unit-level pieces ----------------------------------------------------

describe("csv parsing", () => {
  it("keeps commas inside quoted fields", () => {
    expect(parseCsv('a,b\n"x,y",z')).toEqual([["a", "b"], ["x,y", "z"]]);
  });

  it("handles doubled quotes and CRLF", () => {
    expect(parseCsv('a\r\n"he said ""hi"""')).toEqual([["a"], ['he said "hi"']]);
  });

  it("strips a UTF-8 BOM off the first header", () => {
    const table = readCsvTable("﻿short_name,overall\nx,80");
    expect(table.headers[0]).toBe("short_name");
  });

  it("normalizes header spellings to one key", () => {
    expect(normalizeHeader("Sprint Speed")).toBe("sprint_speed");
    expect(normalizeHeader("movement_sprint_speed")).toBe("movement_sprint_speed");
    expect(normalizeHeader("  GK Diving ")).toBe("gk_diving");
  });
});

describe("column detection", () => {
  it("resolves the long sofifa-style export", () => {
    const table = readCsvTable(makeCsv(["Premier League"], 1));
    const cols = resolveColumns(table);
    expect(cols.missingRequired).toEqual([]);
    expect(cols.found.short_passing ?? cols.found.shortPass).toBeDefined();
    expect(cols.found.standing_tackle).toBe("defending_standing_tackle");
  });

  it("resolves the shorter display-name export too", () => {
    const table = readCsvTable(
      "Name,Position,Age,Club,League,OVR,Sprint Speed,Standing Tackle,Def Awareness\n" +
        "A B,ST,24,Some FC,Premier League,80,88,40,42",
    );
    const cols = resolveColumns(table);
    expect(cols.missingRequired).toEqual([]);
    expect(cols.found.name).toBe("name");
    expect(cols.found.sprint_speed).toBe("sprint_speed");
    expect(cols.found.marking).toBe("def_awareness");
  });

  it("reports required columns it cannot find", () => {
    const cols = resolveColumns(readCsvTable("foo,bar\n1,2"));
    expect(cols.missingRequired).toContain("name");
    expect(cols.missingRequired).toContain("overall");
  });
});

describe("position mapping", () => {
  it("takes the first listed position", () => {
    expect(mapPosition("ST, LW, CF")).toBe("ST");
    expect(mapPosition("CDM, CM")).toBe("DM");
  });

  it("collapses full-backs and wide players onto FB/W", () => {
    for (const p of ["LB", "RB", "LWB", "RWB"]) expect(mapPosition(p)).toBe("FB");
    for (const p of ["LM", "RM", "LW", "RW"]) expect(mapPosition(p)).toBe("W");
  });

  it("returns null for nothing recognisable, rather than guessing", () => {
    expect(mapPosition("SUB")).toBeNull();
    expect(mapPosition(undefined)).toBeNull();
    expect(mapPosition("")).toBeNull();
  });
});

describe("league mapping", () => {
  it("matches first tiers across naming conventions", () => {
    expect(mapLeague("English Premier League")).toBe("English Division 1");
    expect(mapLeague("Spain Primera Division")).toBe("Spanish Division 1");
    expect(mapLeague("LaLiga EA Sports")).toBe("Spanish Division 1");
    expect(mapLeague("German 1. Bundesliga")).toBe("German Division 1");
    expect(mapLeague("Ligue 1 Uber Eats")).toBe("French Division 1");
    expect(mapLeague("Liga Portugal Betclic")).toBe("Portuguese Division 1");
  });

  it("does not let a second tier fall through to its first tier", () => {
    expect(mapLeague("English League Championship")).toBe("English Division 2");
    expect(mapLeague("German 2. Bundesliga")).toBe("German Division 2");
    expect(mapLeague("2. Bundesliga")).toBe("German Division 2");
    expect(mapLeague("Liga Portugal 2")).toBe("Portuguese Division 2");
    expect(mapLeague("LaLiga Hypermotion")).toBe("Spanish Division 2");
    expect(mapLeague("Italian Serie B")).toBe("Italian Division 2");
    expect(mapLeague("Ligue 2 BKT")).toBe("French Division 2");
  });

  it("skips leagues the game does not model", () => {
    expect(mapLeague("Major League Soccer")).toBeNull();
    expect(mapLeague("Eredivisie")).toBeNull();
  });

  it("matches Belgium and Turkey by their qualified names", () => {
    expect(mapLeague("Jupiler Pro League")).toBe("Belgian Division 1");
    expect(mapLeague("Belgian First Division A")).toBe("Belgian Division 1");
    expect(mapLeague("Süper Lig")).toBe("Turkish Division 1");
    expect(mapLeague("Trendyol Süper Lig")).toBe("Turkish Division 1");
    expect(mapLeague("Super Lig")).toBe("Turkish Division 1");
    expect(mapLeague("Challenger Pro League")).toBe("Belgian Division 2");
    expect(mapLeague("TFF 1. Lig")).toBe("Turkish Division 2");
  });

  it("never claims a bare 'Pro League' — Saudi Arabia and the UAE share the name", () => {
    // FC26 carries three leagues called exactly "Pro League": Belgium (id 4),
    // Saudi Arabia (350) and the UAE (2013). Belgium is reached by id, so the
    // name must stay unclaimed or Al Hilal ends up in the Belgian top flight.
    expect(mapLeague("Pro League")).toBeNull();
  });

  it("leaves accented lookalikes to other countries", () => {
    // These are the two names that folding diacritics in normalizeLeague would
    // hand to Italy and Spain: Brazil's Série A (14 clubs) and Uruguay's
    // Primera División. The accents are what keeps them apart.
    expect(mapLeague("Série A")).toBeNull();
    expect(mapLeague("Primera División")).toBeNull();
    // And bare "1. Lig" is not a pattern, because Poland's league contains it.
    expect(mapLeague("Fortuna 1 Liga")).toBeNull();
  });
});

describe("league resolution by id", () => {
  // Mirrors the real FC26 dataset: several federations share a league name and
  // the export has dropped the country prefix that would separate them.
  const rows = [
    { name: "Premier League", id: "13" },   // England
    { name: "Premier League", id: "332" },  // Ukraine
    { name: "Bundesliga", id: "19" },       // Germany
    { name: "Bundesliga", id: "80" },       // Austria
    { name: "Serie A", id: "31" },          // Italy
    { name: "Serie A", id: "2018" },        // Ecuador
    { name: "Liga Portugal 2", id: "9999" },// unknown id, unambiguous name
    { name: "Pro League", id: "4" },        // Belgium
    { name: "Pro League", id: "350" },      // Saudi Arabia
    { name: "Pro League", id: "2013" },     // UAE
    { name: "Süper Lig", id: "68" },        // Turkey
  ];

  it("separates Belgium from the two other 'Pro League's by id alone", () => {
    const r = buildLeagueResolver(rows);
    expect(r.resolve("Pro League", "4")).toBe("Belgian Division 1");
    expect(r.resolve("Pro League", "350")).toBeNull();
    expect(r.resolve("Pro League", "2013")).toBeNull();
    expect(r.resolve("Süper Lig", "68")).toBe("Turkish Division 1");
  });

  it("uses the id, so a shared name cannot import the wrong country", () => {
    const r = buildLeagueResolver(rows);
    expect(r.resolve("Premier League", "13")).toBe("English Division 1");
    expect(r.resolve("Bundesliga", "19")).toBe("German Division 1");
    expect(r.resolve("Serie A", "31")).toBe("Italian Division 1");
  });

  it("drops a shared name under an id it does not recognise", () => {
    const r = buildLeagueResolver(rows);
    // Austria's Bundesliga and Ukraine's Premier League must not be imported.
    expect(r.resolve("Bundesliga", "80")).toBeNull();
    expect(r.resolve("Premier League", "332")).toBeNull();
    expect(r.resolve("Serie A", "2018")).toBeNull();
  });

  it("still trusts an unknown id when the name identifies one league", () => {
    const r = buildLeagueResolver(rows);
    expect(r.resolve("Liga Portugal 2", "9999")).toBe("Portuguese Division 2");
  });

  it("reports which names were ambiguous", () => {
    const r = buildLeagueResolver(rows);
    const names = r.ambiguous.map((a) => a.name).sort();
    expect(names).toEqual(["Bundesliga", "Premier League", "Serie A"]);
  });

  it("falls back to name matching when the file carries no ids at all", () => {
    const r = buildLeagueResolver([
      { name: "Premier League", id: undefined },
      { name: "Bundesliga", id: undefined },
    ]);
    expect(r.resolve("Premier League", undefined)).toBe("English Division 1");
    expect(r.resolve("Bundesliga", undefined)).toBe("German Division 1");
    expect(r.ambiguous).toEqual([]);
  });
});

describe("nation mapping", () => {
  it("renames EA spellings onto the game's nationality keys", () => {
    expect(mapNation("Korea Republic")).toBe("South Korea");
    expect(mapNation("Côte d'Ivoire")).toBe("Ivory Coast");
    expect(mapNation("Czechia")).toBe("Czech Republic");
  });

  it("passes unknown nations through untouched", () => {
    expect(mapNation("Wales")).toBe("Wales");
    expect(mapNation("Latvia")).toBe("Latvia");
  });
});

describe("rescaler", () => {
  const reference = Array.from({ length: 1000 }, (_, i) => 25 + (i / 999) * 56); // 25..81

  it("maps the source range onto the reference range", () => {
    const source = Array.from({ length: 500 }, (_, i) => 50 + (i / 499) * 41); // 50..91
    const r = buildRescaler(source, reference);
    expect(r(50)).toBeGreaterThanOrEqual(25);
    expect(r(91)).toBeLessThanOrEqual(81);
    expect(r(91)).toBeGreaterThan(r(50));
  });

  it("gives tied source values identical outputs", () => {
    const source = [70, 70, 70, 80, 80, 90];
    const r = buildRescaler(source, reference);
    expect(r(70)).toBe(r(70));
    const outs = source.map(r);
    expect(outs[0]).toBe(outs[1]);
    expect(outs[1]).toBe(outs[2]);
    expect(outs[3]).toBe(outs[4]);
  });

  it("is monotonic non-decreasing", () => {
    const source = Array.from({ length: 300 }, (_, i) => 45 + (i % 47));
    const r = buildRescaler(source, reference);
    let prev = -Infinity;
    for (let ea = 40; ea <= 99; ea++) {
      const v = r(ea);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe("club identity derivation", () => {
  it("skips club-type noise words", () => {
    expect(deriveAbbrev("FC Barcelona")).toBe("BAR");
    expect(deriveAbbrev("Real Madrid")).toBe("MAD");
  });

  it("deaccents rather than emitting junk", () => {
    expect(deriveAbbrev("1. FC Köln")).toBe("KOL");
  });

  it("makes abbrevs unique within a competition", () => {
    const out = uniquifyAbbrevs(["Manchester City", "Manchester City", "Manchester City"]);
    expect(new Set(out).size).toBe(3);
    expect(out.every((a) => a.length === 3)).toBe(true);
  });

  it("resolves a whole league of identical names without spinning", () => {
    // A league of "<Town> United" all abbreviate the same once noise words are
    // dropped; the collision sweep must stay bounded rather than loop forever.
    const out = uniquifyAbbrevs(Array.from({ length: 20 }, () => "Premier League Club"));
    expect(new Set(out).size).toBe(20);
    expect(out.every((a) => a.length === 3)).toBe(true);
  });
});

// --- End-to-end -----------------------------------------------------------

const CSV = makeCsv(["Premier League", "English League Championship", "Serie A"]);
const converted = convert(CSV);

describe("convert (end to end)", () => {
  it("maps each league onto its competition and fills every slot", () => {
    const names = converted.file.competitions.map((c) => c.match);
    expect(names).toContain("English Division 1");
    expect(names).toContain("English Division 2");
    expect(names).toContain("Italian Division 1");
    for (const comp of converted.file.competitions) {
      expect(comp.clubs).toHaveLength(20);
      for (const club of comp.clubs) expect(club.players).toHaveLength(25);
    }
  });

  it("emits a file the game's own parser accepts", () => {
    const round = parseRosterFile(JSON.stringify(converted.file));
    expect(round.competitions).toHaveLength(converted.file.competitions.length);
    expect(round.competitions[0].clubs[0].players).toBeDefined();
  });

  it("is deterministic — same CSV in, same file out", () => {
    const again = convert(CSV);
    expect(JSON.stringify(again.file)).toBe(JSON.stringify(converted.file));
  });

  it("ranks the strongest club into the first slot", () => {
    const d1 = converted.file.competitions.find((c) => c.match === "English Division 1")!;
    expect(d1.clubs[0].name).toBe("Alpha, Premier League FC");
  });

  it("keeps club abbrevs unique within a competition", () => {
    for (const comp of converted.file.competitions) {
      const abbrevs = comp.clubs.map((c) => c.abbrev);
      expect(new Set(abbrevs).size).toBe(abbrevs.length);
    }
  });

  it("gives every club a legal squad shape (at least one keeper)", () => {
    for (const comp of converted.file.competitions) {
      for (const club of comp.clubs) {
        const keepers = club.players!.filter((p) => p.pos === "GK");
        expect(keepers.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe("rescaling into soccer-gm's band", () => {
  const all = converted.file.competitions.flatMap((c) =>
    c.clubs.flatMap((k) => k.players!),
  );

  const ovrOf = (p: (typeof all)[number]) => computeOvr(p.pos, p.ratings!, p.heightCm ?? 180);

  it("does not import EA's inflated top end", () => {
    // A fresh soccer-gm world tops out around 81 and only reaches 90+ through
    // progression; the fixture's EA overalls peak at 88. Nothing imported
    // should land in the band the game reserves for developed players.
    const ovrs = all.map(ovrOf);
    expect(Math.max(...ovrs)).toBeLessThanOrEqual(85);
    expect(Math.max(...ovrs)).toBeGreaterThan(70);
  });

  it("never emits a potential below the player's own overall", () => {
    for (const p of all) {
      if (p.potential === undefined) continue;
      expect(p.potential).toBeGreaterThanOrEqual(ovrOf(p));
    }
  });

  it("gives potential its own curve rather than reusing the overall one", () => {
    // Potential is a different distribution from overall. Pushing it through
    // the overall curve clamped every high-ceiling player to the top of the
    // overall range, so they all came out with an identical potential.
    const potentials = all.map((p) => p.potential!).filter((x) => x !== undefined);
    expect(Math.max(...potentials)).toBeGreaterThan(Math.max(...all.map(ovrOf)));

    // And the ceiling must not be a single flat value shared by everyone.
    const top = Math.max(...potentials);
    const atCeiling = potentials.filter((x) => x === top).length;
    expect(atCeiling).toBeLessThan(potentials.length * 0.1);
  });

  it("puts the second tier below the first", () => {
    const meanOf = (match: string) => {
      const comp = converted.file.competitions.find((c) => c.match === match)!;
      const vals = comp.clubs.flatMap((k) => k.players!.map((p) => p.ratings!.positioning));
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    expect(meanOf("English Division 2")).toBeLessThan(meanOf("English Division 1"));
  });

  it("preserves individuality — defenders tackle, forwards finish", () => {
    const cbs = all.filter((p) => p.pos === "CB");
    const sts = all.filter((p) => p.pos === "ST");
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(cbs.map((p) => p.ratings!.tackling)))
      .toBeGreaterThan(mean(sts.map((p) => p.ratings!.tackling)));
    expect(mean(sts.map((p) => p.ratings!.finishing)))
      .toBeGreaterThan(mean(cbs.map((p) => p.ratings!.finishing)));
  });

  it("keeps goalkeeping high for keepers and low for everyone else", () => {
    const gks = all.filter((p) => p.pos === "GK");
    const others = all.filter((p) => p.pos !== "GK");
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(gks.map((p) => p.ratings!.goalkeeping)))
      .toBeGreaterThan(mean(others.map((p) => p.ratings!.goalkeeping)) + 20);
  });
});

describe("applying the converted file to a real save", () => {
  it("imports onto a generated world and lands in the game's OVR band", () => {
    const league = makeLeague(0, 7, 7);
    const before = league.players.length;
    const result = applyRosterFile(league, parseRosterFile(JSON.stringify(converted.file)));

    expect(result.squadsReplaced).toBe(60); // 3 competitions x 20 clubs
    expect(result.playersAdded).toBeGreaterThan(0);
    expect(before).toBeGreaterThan(0);

    // Every imported club is renamed and re-squadded.
    const d1 = result.league.competitions.find((c) => c.name === "English Division 1")!;
    const d1Teams = result.league.teams.filter((t) => t.compId === d1.id);
    expect(d1Teams[0].name).toBe("Alpha, Premier League FC");

    // The imported world must sit in the same band a generated one does —
    // this is the whole point of the rescale.
    const byPid = new Map(result.league.players.map((p) => [p.pid, p]));
    const importedOvrs = d1Teams.flatMap((t) =>
      t.roster.map((pid) => byPid.get(pid)!.ovr),
    );
    expect(Math.max(...importedOvrs)).toBeLessThanOrEqual(85);
    const mean = importedOvrs.reduce((a, b) => a + b, 0) / importedOvrs.length;
    expect(mean).toBeGreaterThan(50);
    expect(mean).toBeLessThan(72);
  });
});

describe("mergeRosterFiles — filling uncovered slots from a names file", () => {
  const roster = (competitions: { match: string; clubs: string[] }[]): RosterFile =>
    parseRosterFile(
      JSON.stringify({
        format: "world-soccer-sim-roster",
        formatVersion: 1,
        competitions: competitions.map((c) => ({
          match: c.match,
          clubs: c.clubs.map((name) => ({
            name,
            abbrev: name.slice(0, 3).toUpperCase(),
            colors: ["#111111", "#eeeeee"],
          })),
        })),
      }),
    );

  const clubNames = (file: RosterFile, match: string): string[] =>
    file.competitions.find((c) => c.match === match)!.clubs.map((k) => k.name);

  it("fills a short competition from the names file", () => {
    const base = roster([{ match: "German Division 1", clubs: ["FC Bayern München", "Borussia Dortmund"] }]);
    const names = roster([
      { match: "German Division 1", clubs: ["Bayern Munich", "Borussia Dortmund", "SSV Ulm 1846", "Jahn Regensburg"] },
    ]);
    const { file, filled } = mergeRosterFiles(base, names);
    expect(clubNames(file, "German Division 1")).toEqual([
      "FC Bayern München",
      "Borussia Dortmund",
      "SSV Ulm 1846",
      "Jahn Regensburg",
    ]);
    expect(filled.map((f) => f.club)).toEqual(["SSV Ulm 1846", "Jahn Regensburg"]);
  });

  it("re-derives a filled club's abbrev when it collides inside the competition", () => {
    // A names file has had no uniqueness pass, so two of its clubs can carry
    // the same code — "UD Leiria" and "Leixões SC" both abbreviate to LEI, and
    // a table showing LEI twice is unreadable. The base club keeps its code.
    const base = roster([{ match: "Portuguese Division 2", clubs: ["Leiria"] }]);
    const names = roster([
      { match: "Portuguese Division 2", clubs: ["Leiria", "Leixland", "Leixmore"] },
    ]);
    const { file } = mergeRosterFiles(base, names);
    const abbrevs = file.competitions[0].clubs.map((k) => k.abbrev);
    expect(abbrevs[0]).toBe("LEI"); // the base club is undisturbed
    expect(new Set(abbrevs).size).toBe(abbrevs.length);
  });

  it("never places a club that already exists in ANOTHER division", () => {
    // The case this whole tool exists for: a names file that disagrees about
    // tiers would otherwise put Schalke in both divisions at once.
    const base = roster([
      { match: "German Division 1", clubs: ["FC Bayern München"] },
      { match: "German Division 2", clubs: ["FC Schalke 04", "Hertha BSC"] },
    ]);
    const names = roster([
      { match: "German Division 1", clubs: ["Bayern Munich", "Schalke 04"] },
      { match: "German Division 2", clubs: ["FC Schalke 04", "Hertha BSC"] },
    ]);
    const { file } = mergeRosterFiles(base, names);
    expect(clubNames(file, "German Division 1")).toEqual(["FC Bayern München"]);
    // The invariant that matters: Schalke exists once in the whole world, not
    // once per division the two files disagree about.
    const everyClub = file.competitions.flatMap((c) => c.clubs.map((k) => k.name));
    expect(everyClub.filter((n) => /Schalke/.test(n))).toHaveLength(1);
  });

  it("carries over a competition the base file omits entirely", () => {
    const base = roster([{ match: "Portuguese Division 1", clubs: ["SL Benfica"] }]);
    const names = roster([
      { match: "Portuguese Division 1", clubs: ["Benfica"] },
      { match: "Portuguese Division 2", clubs: ["Varzim SC", "UD Leiria"] },
    ]);
    const { file } = mergeRosterFiles(base, names);
    expect(clubNames(file, "Portuguese Division 2")).toEqual(["Varzim SC", "UD Leiria"]);
  });

  it("takes the names file's colors for a club the base already has", () => {
    // The converter has no color data and hashes the club name into a pair, so
    // Liverpool comes out purple. Once imported clubs stopped drawing their
    // slot's crest, those colors became the club's whole visual identity.
    const base = roster([{ match: "English Division 1", clubs: ["Liverpool"] }]);
    base.competitions[0].clubs[0].colors = ["#8e44ad", "#f1c40f"]; // synthesized
    const names = roster([{ match: "English Division 1", clubs: ["Liverpool"] }]);
    names.competitions[0].clubs[0].colors = ["#c8102e", "#ffffff"]; // real

    const { file, recolored } = mergeRosterFiles(base, names);
    expect(file.competitions[0].clubs[0].colors).toEqual(["#c8102e", "#ffffff"]);
    expect(recolored.map((r) => r.club)).toEqual(["Liverpool"]);
  });

  it("recolors through the same fuzzy match used for dedupe", () => {
    const base = roster([{ match: "German Division 1", clubs: ["FC Bayern München"] }]);
    base.competitions[0].clubs[0].colors = ["#8e44ad", "#f1c40f"];
    const names = roster([{ match: "German Division 1", clubs: ["Bayern Munich"] }]);
    names.competitions[0].clubs[0].colors = ["#dc052d", "#ffffff"];

    const { file } = mergeRosterFiles(base, names);
    expect(file.competitions[0].clubs[0].colors).toEqual(["#dc052d", "#ffffff"]);
    // The base club's own name is kept — only the colors are adopted.
    expect(file.competitions[0].clubs[0].name).toBe("FC Bayern München");
  });

  it("spends a names entry on recoloring, so it can't also fill a slot", () => {
    // Without this ordering, the entry that describes Liverpool would recolor
    // nothing and instead be dropped into the empty slot as a second Liverpool.
    const base = roster([{ match: "English Division 1", clubs: ["Liverpool"] }]);
    const names = roster([{ match: "English Division 1", clubs: ["Liverpool", "Everton"] }]);
    const { file } = mergeRosterFiles(base, names);
    expect(clubNames(file, "English Division 1")).toEqual(["Liverpool", "Everton"]);
  });

  it("leaves a club the names file doesn't recognize alone", () => {
    const base = roster([{ match: "English Division 1", clubs: ["Some Unknown FC"] }]);
    base.competitions[0].clubs[0].colors = ["#8e44ad", "#f1c40f"];
    const names = roster([{ match: "English Division 1", clubs: ["Liverpool"] }]);
    const { file, recolored } = mergeRosterFiles(base, names);
    expect(file.competitions[0].clubs[0].colors).toEqual(["#8e44ad", "#f1c40f"]);
    expect(recolored).toEqual([]);
  });

  it("adds names only — a filled slot never gains players", () => {
    const base = roster([{ match: "German Division 1", clubs: ["FC Bayern München"] }]);
    const names = roster([{ match: "German Division 1", clubs: ["SSV Ulm 1846", "Jahn Regensburg"] }]);
    const { file } = mergeRosterFiles(base, names);
    expect(file.competitions[0].clubs.every((k) => k.players === undefined)).toBe(true);
  });

  it.each([
    ["Casa Pia", "Casa Pia AC"],
    ["Alverca", "FC Alverca"],
    ["VfL Bochum 1848", "VfL Bochum"],
    ["ESTAC Troyes", "Troyes Aubois"],
    ["Vitória SC", "Vitoria de Guimaraes"],
    ["AVS Futebol SAD", "AVS"],
    ["SpVgg Greuther Fürth", "Greuther Fürth"],
    ["En Avant Guingamp", "EA Guingamp"],
    // Cross-language spellings, which no general string rule recovers.
    ["FC Bayern München", "Bayern Munich"],
    ["1. FC Nürnberg", "Nuremberg"],
  ])("treats %s and %s as the same club", (a, b) => {
    // The base is SHORT of the names file, so there is an empty slot a second
    // copy could wrongly land in if the two names weren't recognized as one.
    const { file, recolored } = mergeRosterFiles(
      roster([{ match: "German Division 1", clubs: [a] }]),
      roster([{ match: "German Division 1", clubs: [b, "Only Spare Club"] }]),
    );
    // Recognized: b's entry is spent recoloring a...
    expect(recolored.map((r) => r.from)).toContain(b);
    // ...and the empty slot went to the spare, not to a second copy of a.
    expect(clubNames(file, "German Division 1")).toEqual([a, "Only Spare Club"]);
  });

  it.each([
    ["Borussia Dortmund", "Borussia Mönchengladbach"],
    ["Stade Rennais FC", "Stade Brestois 29"],
    ["Olympique de Marseille", "Olympique Lyonnais"],
    ["1. FC Köln", "1. FC Kaiserslautern"],
    ["AS Saint-Étienne", "Paris Saint-Germain"],
  ])("keeps %s and %s apart", (a, b) => {
    const { file } = mergeRosterFiles(
      roster([{ match: "German Division 1", clubs: [a] }]),
      roster([{ match: "German Division 1", clubs: [a, b] }]),
    );
    expect(clubNames(file, "German Division 1")).toEqual([a, b]);
  });
});
