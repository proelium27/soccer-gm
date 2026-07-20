import type { LeagueStore } from "../leagueState.js";
import type { TeamIdentityEdit } from "./customize.js";
import type { PlayerRatings, Position } from "../players/types.js";
import { POSITIONS, SKILL_KEYS } from "../players/types.js";

/**
 * A compact, human/AI-authorable file describing real clubs to overlay onto an
 * existing save's fixed world structure. Unlike the full-save export
 * (src/db/exportImport.ts, which round-trips the entire internal LeagueStore),
 * this format carries only what someone would want to hand-edit to bring real
 * teams into the game — club identities and, optionally, real squads — keyed by
 * which competition to overlay.
 *
 * It is deliberately partial-friendly: list only the competitions (and, within
 * one, only the leading clubs) you care about; every unlisted slot keeps its
 * existing identity and squad. Clubs map positionally onto a competition's
 * teams in the game's own stable order (the same order buildRosterFile emits),
 * so the intended workflow is "export a template, edit it, re-import".
 *
 * `players` is optional per club and opt-in: omit it and only the club's
 * identity (name/abbrev/colors) changes, leaving its auto-generated squad
 * intact. Provide it and that club's squad is replaced by the listed players
 * (topped up with filler to a legal squad — see src/core/teams/rosterImport.ts).
 * buildRosterFile deliberately emits identities only, so a plain
 * export-edit-reimport to rename a club never disturbs any roster.
 */
export interface RosterFilePlayer {
  name: string;
  pos: Position;
  age: number;
  nationality?: string;
  heightCm?: number;
  /** Optional peak-ability hint; defaults to a scouted estimate. Clamped to >= overall. */
  potential?: number;
  /**
   * Target overall (0-100). The game synthesizes position-appropriate ratings
   * scaled to hit it. Ignored if `ratings` is also given.
   */
  overall?: number;
  /** Exact per-skill ratings. Takes precedence over `overall` when both are present. */
  ratings?: PlayerRatings;
}

export interface RosterFileClub {
  name: string;
  abbrev: string;
  colors: [string, string];
  /** Optional real squad. Omit to keep the club's existing auto-generated roster. */
  players?: RosterFilePlayer[];
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
 * slot order. This is the editable template authors start from. It emits
 * identities only (no `players`): the template's job is to show the club/slot
 * structure to rename, and exporting the fictional squads would (a) bloat the
 * file and (b) make a rename-only round-trip destructively replace rosters.
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

function parsePlayer(raw: unknown, path: string): RosterFilePlayer {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`Invalid roster file: ${path} must be an object.`);
  }
  const p = raw as Record<string, unknown>;
  if (typeof p.name !== "string" || p.name.trim() === "") {
    throw new Error(`Invalid roster file: ${path}.name must be a non-empty string.`);
  }
  if (typeof p.pos !== "string" || !(POSITIONS as readonly string[]).includes(p.pos)) {
    throw new Error(`Invalid roster file: ${path}.pos must be one of ${POSITIONS.join(", ")}.`);
  }
  if (typeof p.age !== "number" || !Number.isFinite(p.age) || p.age < 15 || p.age > 45) {
    throw new Error(`Invalid roster file: ${path}.age must be a number between 15 and 45.`);
  }
  const hasRatings = p.ratings !== undefined;
  const hasOverall = p.overall !== undefined;
  if (!hasRatings && !hasOverall) {
    throw new Error(`Invalid roster file: ${path} must have either "overall" or "ratings".`);
  }
  let ratings: PlayerRatings | undefined;
  if (hasRatings) {
    if (typeof p.ratings !== "object" || p.ratings === null) {
      throw new Error(`Invalid roster file: ${path}.ratings must be an object of skill ratings.`);
    }
    const r = p.ratings as Record<string, unknown>;
    for (const key of SKILL_KEYS) {
      if (typeof r[key] !== "number" || !Number.isFinite(r[key])) {
        throw new Error(`Invalid roster file: ${path}.ratings.${key} must be a number.`);
      }
    }
    ratings = Object.fromEntries(SKILL_KEYS.map((k) => [k, r[k] as number])) as PlayerRatings;
  }
  let overall: number | undefined;
  if (hasOverall) {
    if (typeof p.overall !== "number" || !Number.isFinite(p.overall)) {
      throw new Error(`Invalid roster file: ${path}.overall must be a number.`);
    }
    overall = p.overall;
  }
  if (p.nationality !== undefined && typeof p.nationality !== "string") {
    throw new Error(`Invalid roster file: ${path}.nationality must be a string.`);
  }
  if (p.heightCm !== undefined && (typeof p.heightCm !== "number" || !Number.isFinite(p.heightCm))) {
    throw new Error(`Invalid roster file: ${path}.heightCm must be a number.`);
  }
  if (p.potential !== undefined && (typeof p.potential !== "number" || !Number.isFinite(p.potential))) {
    throw new Error(`Invalid roster file: ${path}.potential must be a number.`);
  }
  return {
    name: p.name,
    pos: p.pos as Position,
    age: p.age,
    nationality: p.nationality as string | undefined,
    heightCm: p.heightCm as number | undefined,
    potential: p.potential as number | undefined,
    overall,
    ratings,
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
      let players: RosterFilePlayer[] | undefined;
      if (club.players !== undefined) {
        if (!Array.isArray(club.players)) {
          throw new Error(`Invalid roster file: ${path}.players must be an array.`);
        }
        players = club.players.map((pr, pi) => parsePlayer(pr, `${path}.players[${pi}]`));
      }
      return {
        name: club.name,
        abbrev: club.abbrev,
        colors: [club.colors[0], club.colors[1]] as [string, string],
        players,
      };
    });
    return { match: comp.match, clubs };
  });

  return { format: ROSTER_FILE_FORMAT, formatVersion: ROSTER_FILE_VERSION, competitions };
}

/** One resolved file club paired with the save tid it maps onto. */
export interface RosterSlot {
  tid: number;
  club: RosterFileClub;
}

export interface RosterSlotResolution {
  slots: RosterSlot[];
  /** Non-fatal issues (unmatched competition, more clubs than slots) worth showing the user. */
  warnings: string[];
}

/**
 * Resolve every file club to the save tid it overlays. Each file competition is
 * matched to an existing competition by name (case-insensitive); its clubs map
 * positionally onto that competition's teams in slot order. Anything that can't
 * be mapped cleanly becomes a warning rather than an error, so a mostly-good
 * file still applies what it can. Shared by both the identity-edit path and the
 * roster-replacement path so the "which club goes where" rule lives once.
 */
export function resolveRosterSlots(league: LeagueStore, file: RosterFile): RosterSlotResolution {
  const byName = new Map(
    league.competitions.map((c) => [c.name.trim().toLowerCase(), c.id]),
  );
  const slots: RosterSlot[] = [];
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
      slots.push({ tid: targets[i].tid, club: fc.clubs[i] });
    }
  }

  return { slots, warnings };
}

export interface RosterFileEdits {
  edits: TeamIdentityEdit[];
  /** Non-fatal issues (unmatched competition, more clubs than slots) worth showing the user. */
  warnings: string[];
}

/**
 * Map a parsed roster file to the identity edits to feed applyTeamIdentities
 * (names/abbrevs/colors only — squads are handled separately by
 * applyRosterFile in src/core/teams/rosterImport.ts).
 */
export function rosterFileToEdits(league: LeagueStore, file: RosterFile): RosterFileEdits {
  const { slots, warnings } = resolveRosterSlots(league, file);
  const edits: TeamIdentityEdit[] = slots.map(({ tid, club }) => ({
    tid,
    name: club.name,
    abbrev: club.abbrev,
    colors: club.colors,
  }));
  return { edits, warnings };
}
