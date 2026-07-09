import type { League } from "../league/generate.js";
import { BASE_SEASON_BUDGET, HYPE_INITIAL, SCOUTING_SPEND_MIN } from "../constants.js";

export interface ClubIdentity {
  name: string;
  abbrev: string;
  colors: [string, string];
}

export const CLUBS: ClubIdentity[] = [
  { name: "Ashworth City",       abbrev: "ASH", colors: ["#1a5276", "#f4d03f"] },
  { name: "Northdale United",    abbrev: "NTD", colors: ["#c0392b", "#ffffff"] },
  { name: "Greenbrook FC",       abbrev: "GBK", colors: ["#27ae60", "#1a1a1a"] },
  { name: "Kingsley Town",       abbrev: "KGS", colors: ["#8e44ad", "#ecf0f1"] },
  { name: "Hartfield Rovers",    abbrev: "HTF", colors: ["#2c3e50", "#e67e22"] },
  { name: "Dunmore Athletic",    abbrev: "DUN", colors: ["#1abc9c", "#2c3e50"] },
  { name: "Westbury Albion",     abbrev: "WBA", colors: ["#2980b9", "#ffffff"] },
  { name: "Foxhall Rangers",     abbrev: "FOX", colors: ["#d35400", "#1a1a1a"] },
  { name: "Stonebridge FC",      abbrev: "STN", colors: ["#7f8c8d", "#c0392b"] },
  { name: "Linfield City",       abbrev: "LIN", colors: ["#3498db", "#f1c40f"] },
  { name: "Bramford Town",       abbrev: "BRM", colors: ["#e74c3c", "#ecf0f1"] },
  { name: "Copperhill United",   abbrev: "COP", colors: ["#e67e22", "#2c3e50"] },
  { name: "Haleston Borough",    abbrev: "HAL", colors: ["#16a085", "#ffffff"] },
  { name: "Redmarsh Wanderers",  abbrev: "RED", colors: ["#c0392b", "#f4d03f"] },
  { name: "Thornwick City",      abbrev: "THW", colors: ["#34495e", "#1abc9c"] },
  { name: "Millhaven Athletic",  abbrev: "MIL", colors: ["#9b59b6", "#f39c12"] },
  { name: "Daleford FC",         abbrev: "DAL", colors: ["#2ecc71", "#ffffff"] },
  { name: "Ashborne Rovers",     abbrev: "ABR", colors: ["#e84393", "#2d3436"] },
  { name: "Whitmore Town",       abbrev: "WHT", colors: ["#0984e3", "#dfe6e9"] },
  { name: "Elmsgate United",     abbrev: "ELM", colors: ["#fdcb6e", "#2d3436"] },
];

export interface StoredTeam {
  tid: number;
  name: string;
  abbrev: string;
  colors: [string, string];
  roster: number[];
  /** Funds available to spend on wages, transfers, and scouting. */
  budget: number;
  /** Fame/popularity, 0-100; drives a damped revenue channel and free-agent appeal. */
  hype: number;
  /** This season's scouting spend, deducted from budget; lowers transfer valuation noise. */
  scoutingSpend: number;
}

/**
 * Zip club identities onto league teams: CLUBS[tid] provides the name,
 * abbreviation, and colors for each team.
 */
export function assignIdentities(league: League): StoredTeam[] {
  return league.teams.map((t) => {
    const club = CLUBS[t.tid];
    return {
      tid: t.tid,
      name: club.name,
      abbrev: club.abbrev,
      colors: club.colors,
      roster: t.roster,
      budget: BASE_SEASON_BUDGET,
      hype: HYPE_INITIAL,
      scoutingSpend: SCOUTING_SPEND_MIN,
    };
  });
}
