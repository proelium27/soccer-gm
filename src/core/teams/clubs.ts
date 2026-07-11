import type { League } from "../league/generate.js";
import { BASE_SEASON_BUDGET, HYPE_INITIAL, SCOUTING_SPEND_MIN } from "../constants.js";

export interface ClubIdentity {
  name: string;
  abbrev: string;
  colors: [string, string];
}

export const CLUBS: ClubIdentity[] = [
  { name: "Islington Sentinels",     abbrev: "ISL", colors: ["#1a5276", "#f4d03f"] },
  { name: "Tottenham Marshmen",      abbrev: "TOT", colors: ["#c0392b", "#ffffff"] },
  { name: "Chelsea Regents",         abbrev: "CHE", colors: ["#27ae60", "#1a1a1a"] },
  { name: "Fulham Rivermen",         abbrev: "FUL", colors: ["#8e44ad", "#ecf0f1"] },
  { name: "Brentford Canalmen",      abbrev: "BRE", colors: ["#2c3e50", "#e67e22"] },
  { name: "Crystal Palace Glassmen", abbrev: "CRY", colors: ["#1abc9c", "#2c3e50"] },
  { name: "West Ham Ironworks",      abbrev: "WHU", colors: ["#2980b9", "#ffffff"] },
  { name: "Aston Furnace",           abbrev: "AST", colors: ["#d35400", "#1a1a1a"] },
  { name: "Bournemouth Sandpipers",  abbrev: "BOU", colors: ["#7f8c8d", "#c0392b"] },
  { name: "Brighton Mods",           abbrev: "BHA", colors: ["#3498db", "#f1c40f"] },
  { name: "Burnley Looms",           abbrev: "BUR", colors: ["#e74c3c", "#ecf0f1"] },
  { name: "Everton Beacon",          abbrev: "EVE", colors: ["#e67e22", "#2c3e50"] },
  { name: "Anfield Privateers",      abbrev: "ANF", colors: ["#16a085", "#ffffff"] },
  { name: "Leeds Millers",           abbrev: "LEE", colors: ["#c0392b", "#f4d03f"] },
  { name: "Ancoats Engineers",       abbrev: "ANC", colors: ["#34495e", "#1abc9c"] },
  { name: "Trafford Merchants",      abbrev: "TRA", colors: ["#9b59b6", "#f39c12"] },
  { name: "Newcastle Colliers",      abbrev: "NEW", colors: ["#2ecc71", "#ffffff"] },
  { name: "Nottingham Outlaws",      abbrev: "NOT", colors: ["#e84393", "#2d3436"] },
  { name: "Sunderland Shipwrights",  abbrev: "SUN", colors: ["#0984e3", "#dfe6e9"] },
  { name: "Wolverhampton Hunters",   abbrev: "WOL", colors: ["#fdcb6e", "#2d3436"] },
];

export interface StoredTeam {
  tid: number;
  name: string;
  abbrev: string;
  colors: [string, string];
  roster: number[];
  /** Funds available to spend on wages, transfers, and scouting. */
  budget: number;
  /** Fame/popularity, 0-100; drives a damped ticket/jersey revenue channel. */
  hype: number;
  /** This season's scouting spend, deducted from budget; lowers transfer valuation noise. */
  scoutingSpend: number;
  /** Fixed generation-time strength anchor for this club's youth intake (see LeagueTeam.academyBase). */
  academyBase: number;
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
      academyBase: t.academyBase,
    };
  });
}
