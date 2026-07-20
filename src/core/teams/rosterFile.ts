import type { LeagueStore } from "../leagueState.js";
import type { TeamIdentityEdit } from "./customize.js";

/**
 * A compact, human/AI-authorable file describing real club identities to
 * overlay onto an existing save's fixed world structure. Unlike the full-save
 * export (src/db/exportImport.ts, which round-trips the entire internal
 * LeagueStore), this format carries only what someone would want to hand-edit
 * to bring real teams into the game — club names, abbreviations, and colors —
 * keyed by which competition to overlay.
 *
 * It is deliberately partial-friendly: list only the competitions (and, within
 * one, only the leading clubs) you care about; every unlisted slot keeps its
 * existing identity. Clubs map positionally onto a competition's teams in the
 * game's own stable order (the same order buildRosterFile emits), so the
 * intended workflow is "export a template, edit the names, re-import".
 *
 * formatVersion 1 covers identities only. A future step layers optional
 * per-club rosters (real players) onto this same shape — an additive, optional
 * field, so files written now stay valid.
 */
export interface RosterFileClub {
  name: string;
  abbrev: string;
  colors: [string, string];
}

export interface RosterFileCompetition {
  /** The name of the competition to overlay (e.g. "English Division 1"). Matched case-insensitively against league.competitions. */
  match: string;
  /** Clubs in slot order; up to the competition's team count. Extra entries are ignored (with a warning). */
  clubs: RosterFileClub[];
}

export interface RosterFile {
  format: "soccer-gm-roster";
  formatVersion: 1;
  competitions: RosterFileCompetition[];
}

export const ROSTER_FILE_FORMAT = "soccer-gm-roster";
export const ROSTER_FILE_VERSION = 1;

/** The competition's teams, in the game's stable slot order (ascending tid). */
function teamsInCompetition(league: LeagueStore, compId: number) {
  return league.teams
    .filter((t) => t.compId === compId)
    .sort((a, b) => a.tid - b.tid);
}

/**
 * Serialize a save's current club identities to a roster file — one entry per
 * competition (in the competitions-table order), each listing its clubs in
 * slot order. This is the editable template authors start from.
 */
export function buildRosterFile(league: LeagueStore): RosterFile {
  return {
    format: ROSTER_FILE_FORMAT,
    formatVersion: ROSTER_FILE_VERSION,
    competitions: league.competitions.map((comp) => ({
      match: comp.name,
      clubs: teamsInCompetition(league, comp.id).map((t) => ({
        name: t.name,
        abbrev: t.abbrev,
        colors: [...t.colors] as [string, string],
      })),
    })),
  };
}

/**
 * Parse and structurally validate raw file text as a RosterFile. Throws a
 * descriptive error (naming the offending path) on any malformed field, so the
 * UI can surface exactly what's wrong rather than half-loading a bad file.
 */
export function parseRosterFile(text: string): RosterFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid roster file: not valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid roster file: expected a JSON object.");
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.format !== ROSTER_FILE_FORMAT) {
    throw new Error(
      `Invalid roster file: "format" must be "${ROSTER_FILE_FORMAT}" (got ${JSON.stringify(obj.format)}).`,
    );
  }
  if (obj.formatVersion !== ROSTER_FILE_VERSION) {
    throw new Error(
      `Unsupported roster file version ${JSON.stringify(obj.formatVersion)}: this game reads version ${ROSTER_FILE_VERSION}.`,
    );
  }
  if (!Array.isArray(obj.competitions)) {
    throw new Error(`Invalid roster file: "competitions" must be an array.`);
  }

  const competitions: RosterFileCompetition[] = obj.competitions.map((c, ci) => {
    if (typeof c !== "object" || c === null) {
      throw new Error(`Invalid roster file: competitions[${ci}] must be an object.`);
    }
    const comp = c as Record<string, unknown>;
    if (typeof comp.match !== "string" || comp.match.trim() === "") {
      throw new Error(`Invalid roster file: competitions[${ci}].match must be a non-empty string.`);
    }
    if (!Array.isArray(comp.clubs)) {
      throw new Error(`Invalid roster file: competitions[${ci}].clubs must be an array.`);
    }
    const clubs: RosterFileClub[] = comp.clubs.map((raw, ki) => {
      const path = `competitions[${ci}].clubs[${ki}]`;
      if (typeof raw !== "object" || raw === null) {
        throw new Error(`Invalid roster file: ${path} must be an object.`);
      }
      const club = raw as Record<string, unknown>;
      if (typeof club.name !== "string" || club.name.trim() === "") {
        throw new Error(`Invalid roster file: ${path}.name must be a non-empty string.`);
      }
      if (typeof club.abbrev !== "string" || club.abbrev.trim() === "") {
        throw new Error(`Invalid roster file: ${path}.abbrev must be a non-empty string.`);
      }
      if (
        !Array.isArray(club.colors) ||
        club.colors.length !== 2 ||
        !club.colors.every((x) => typeof x === "string")
      ) {
        throw new Error(`Invalid roster file: ${path}.colors must be an array of two color strings.`);
      }
      return {
        name: club.name,
        abbrev: club.abbrev,
        colors: [club.colors[0], club.colors[1]] as [string, string],
      };
    });
    return { match: comp.match, clubs };
  });

  return { format: ROSTER_FILE_FORMAT, formatVersion: ROSTER_FILE_VERSION, competitions };
}

export interface RosterFileEdits {
  edits: TeamIdentityEdit[];
  /** Non-fatal issues (unmatched competition, more clubs than slots) worth showing the user. */
  warnings: string[];
}

/**
 * Map a parsed roster file onto a specific save, producing the identity edits
 * to feed applyTeamIdentities. Each file competition is resolved to an existing
 * competition by name (case-insensitive); its clubs map positionally onto that
 * competition's teams in slot order. Anything that can't be applied cleanly is
 * reported as a warning rather than throwing, so a mostly-good file still
 * applies what it can.
 */
export function rosterFileToEdits(league: LeagueStore, file: RosterFile): RosterFileEdits {
  const byName = new Map(
    league.competitions.map((c) => [c.name.trim().toLowerCase(), c.id]),
  );
  const edits: TeamIdentityEdit[] = [];
  const warnings: string[] = [];

  for (const fc of file.competitions) {
    const compId = byName.get(fc.match.trim().toLowerCase());
    if (compId === undefined) {
      warnings.push(`No competition named "${fc.match}" in this save — skipped.`);
      continue;
    }
    const targets = teamsInCompetition(league, compId);
    if (fc.clubs.length > targets.length) {
      warnings.push(
        `"${fc.match}" lists ${fc.clubs.length} clubs but has ${targets.length} slots — the extra ${fc.clubs.length - targets.length} were ignored.`,
      );
    }
    const count = Math.min(fc.clubs.length, targets.length);
    for (let i = 0; i < count; i++) {
      edits.push({
        tid: targets[i].tid,
        name: fc.clubs[i].name,
        abbrev: fc.clubs[i].abbrev,
        colors: fc.clubs[i].colors,
      });
    }
  }

  return { edits, warnings };
}
