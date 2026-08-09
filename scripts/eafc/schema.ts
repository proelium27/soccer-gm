/**
 * Column detection for EA FC player CSVs.
 *
 * There is no single canonical export. The long-standing sofifa-derived Kaggle
 * files use snake_case group prefixes (`attacking_short_passing`,
 * `defending_standing_tackle`, `movement_sprint_speed`); the newer "EA Sports
 * FC 25" exports use bare display names (`Short Passing`, `Standing Tackle`,
 * `Sprint Speed`, `Def Awareness`). Rather than pin one, every logical field
 * lists its known aliases and we resolve against whatever the file actually
 * has, reporting exactly what was found and what was missing so a surprising
 * file fails loudly instead of importing silent zeroes.
 *
 * Header matching runs on normalizeHeader() output, so "Sprint Speed",
 * "sprint_speed" and "SprintSpeed" all collapse to the same key.
 */
import { normalizeHeader, type CsvTable } from "./csv.js";

/** Logical fields we look for, each with aliases in preference order. */
export const FIELD_ALIASES: Record<string, string[]> = {
  // Identity / metadata
  name: ["short_name", "name", "player_name", "known_as", "long_name", "full_name"],
  position: ["player_positions", "positions", "position", "best_position", "main_position", "pos"],
  age: ["age"],
  club: ["club_name", "club", "team_name", "club_team", "team"],
  league: ["league_name", "league", "club_league_name", "league_name_1"],
  overall: ["overall", "overall_rating", "ovr", "rating"],
  potential: ["potential", "potential_rating", "pot"],
  nationality: ["nationality_name", "nationality", "nation", "country", "nation_name"],
  height: ["height_cm", "height", "heightcm"],

  // Face stats (fallbacks when the detailed attribute is absent)
  pace: ["pace", "pac"],
  shooting: ["shooting", "sho"],
  passing: ["passing", "pas"],
  dribbling_face: ["dribbling", "dri"],
  defending_face: ["defending", "def"],
  physic: ["physic", "physicality", "phy"],

  // Detailed attributes
  acceleration: ["movement_acceleration", "acceleration"],
  sprint_speed: ["movement_sprint_speed", "sprint_speed", "sprintspeed"],
  strength: ["power_strength", "strength"],
  stamina: ["power_stamina", "stamina"],
  jumping: ["power_jumping", "jumping"],
  short_passing: ["attacking_short_passing", "short_passing", "shortpassing"],
  long_passing: ["skill_long_passing", "long_passing", "longpassing"],
  crossing: ["attacking_crossing", "crossing"],
  skill_dribbling: ["skill_dribbling", "dribbling_skill"],
  ball_control: ["skill_ball_control", "ball_control", "ballcontrol"],
  agility: ["movement_agility", "agility"],
  long_shots: ["power_long_shots", "long_shots", "longshots"],
  finishing: ["attacking_finishing", "finishing"],
  standing_tackle: ["defending_standing_tackle", "standing_tackle", "standingtackle"],
  sliding_tackle: ["defending_sliding_tackle", "sliding_tackle", "slidingtackle"],
  marking: ["defending_marking_awareness", "defending_marking", "def_awareness", "defensive_awareness", "marking"],
  interceptions: ["mentality_interceptions", "interceptions"],
  att_positioning: ["mentality_positioning", "attacking_position", "positioning"],
  reactions: ["movement_reactions", "reactions"],
  composure: ["mentality_composure", "composure"],
  vision: ["mentality_vision", "vision"],

  // Goalkeeping
  gk_diving: ["goalkeeping_diving", "gk_diving", "gkdiving", "diving"],
  gk_handling: ["goalkeeping_handling", "gk_handling", "gkhandling", "handling"],
  gk_kicking: ["goalkeeping_kicking", "gk_kicking", "gkkicking", "kicking"],
  gk_positioning: ["goalkeeping_positioning", "gk_positioning", "gkpositioning"],
  gk_reflexes: ["goalkeeping_reflexes", "gk_reflexes", "gkreflexes", "reflexes"],
};

/** Fields without which we cannot build a roster at all. */
export const REQUIRED_FIELDS = ["name", "position", "age", "club", "overall"] as const;

export interface ResolvedColumns {
  /** logical field -> actual normalized header present in the file. */
  found: Record<string, string>;
  missingRequired: string[];
  /** Detailed-attribute fields we could not find (import still works, with fallbacks). */
  missingOptional: string[];
}

export function resolveColumns(table: CsvTable): ResolvedColumns {
  const present = new Set(table.headers);
  const found: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const key = normalizeHeader(alias);
      if (present.has(key)) {
        found[field] = key;
        break;
      }
    }
  }
  const missingRequired = REQUIRED_FIELDS.filter((f) => found[f] === undefined);
  const missingOptional = Object.keys(FIELD_ALIASES).filter(
    (f) => found[f] === undefined && !(REQUIRED_FIELDS as readonly string[]).includes(f),
  );
  return { found, missingRequired, missingOptional };
}

/** Read one logical field from a row as a number, or undefined if absent/unparseable. */
export function num(
  row: Record<string, string>,
  cols: ResolvedColumns,
  field: string,
): number | undefined {
  const col = cols.found[field];
  if (col === undefined) return undefined;
  const raw = row[col];
  if (raw === undefined || raw === "") return undefined;
  // EA exports write in-form attributes as "78+2"; take the base value.
  const m = /^(-?\d+(?:\.\d+)?)/.exec(raw.trim());
  if (!m) return undefined;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : undefined;
}

/** Read one logical field from a row as a trimmed string, or undefined. */
export function str(
  row: Record<string, string>,
  cols: ResolvedColumns,
  field: string,
): string | undefined {
  const col = cols.found[field];
  if (col === undefined) return undefined;
  const raw = row[col];
  return raw === undefined || raw.trim() === "" ? undefined : raw.trim();
}

/** Mean of the defined values, or undefined if none are. */
export function meanDefined(...xs: (number | undefined)[]): number | undefined {
  const vals = xs.filter((x): x is number => x !== undefined);
  if (vals.length === 0) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
