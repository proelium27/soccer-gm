import type { League } from "../league/generate.js";
import { BASE_SEASON_BUDGET, HYPE_INITIAL, SCOUTING_SPEND_MIN } from "../constants.js";

export interface ClubIdentity {
  name: string;
  abbrev: string;
  colors: [string, string];
}

export const CLUBS: ClubIdentity[] = [
  { name: "Arsenal",                 abbrev: "ARS", colors: ["#ef0107", "#ffffff"] },
  { name: "Tottenham Hotspur",       abbrev: "TOT", colors: ["#ffffff", "#132257"] },
  { name: "Chelsea",                 abbrev: "CHE", colors: ["#034694", "#ffffff"] },
  { name: "Fulham",                  abbrev: "FUL", colors: ["#ffffff", "#1a1a1a"] },
  { name: "Brentford",               abbrev: "BRE", colors: ["#e30613", "#ffffff"] },
  { name: "Crystal Palace",          abbrev: "CRY", colors: ["#1b458f", "#c4122e"] },
  { name: "West Ham United",         abbrev: "WHU", colors: ["#7a263a", "#1bb1e7"] },
  { name: "Aston Villa",             abbrev: "AVL", colors: ["#670e36", "#95bfe5"] },
  { name: "Bournemouth",             abbrev: "BOU", colors: ["#da291c", "#1a1a1a"] },
  { name: "Brighton & Hove Albion",  abbrev: "BHA", colors: ["#0057b8", "#ffffff"] },
  { name: "Burnley",                 abbrev: "BUR", colors: ["#6c1d45", "#99d6ea"] },
  { name: "Everton",                 abbrev: "EVE", colors: ["#003399", "#ffffff"] },
  { name: "Liverpool",               abbrev: "LIV", colors: ["#c8102e", "#ffffff"] },
  { name: "Leeds United",            abbrev: "LEE", colors: ["#ffffff", "#1d428a"] },
  { name: "Manchester City",         abbrev: "MCI", colors: ["#6cabdd", "#ffffff"] },
  { name: "Manchester United",       abbrev: "MUN", colors: ["#da291c", "#fbe122"] },
  { name: "Newcastle United",        abbrev: "NEW", colors: ["#241f20", "#ffffff"] },
  { name: "Nottingham Forest",       abbrev: "NFO", colors: ["#dd0000", "#ffffff"] },
  { name: "Sunderland",              abbrev: "SUN", colors: ["#eb172b", "#ffffff"] },
  { name: "Wolverhampton Wanderers", abbrev: "WOL", colors: ["#fdb913", "#231f20"] },
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
  /**
   * User-chosen starting XI (11 pids), or null to auto-select via selectXI.
   * Only ever set for the user's own team; AI teams always auto-select.
   */
  starters: number[] | null;
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
      starters: null,
    };
  });
}
