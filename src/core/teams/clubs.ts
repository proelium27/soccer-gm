import type { League } from "../league/generate.js";
import { HYPE_INITIAL, SCOUTING_SPEND_MIN } from "../constants.js";
import { chargeSeasonStart, wageBill } from "../finance/budget.js";

export interface ClubIdentity {
  name: string;
  abbrev: string;
  colors: [string, string];
}

/**
 * Default club identities are fictional (invented place names, no real-club
 * stand-ins) to avoid shipping real trademarks. Users can rename clubs
 * per-save via the Customize Teams editor on the Leagues page.
 */
export const CLUBS: ClubIdentity[] = [
  { name: "Ashcombe United",       abbrev: "ASH", colors: ["#c0392b", "#ffffff"] },
  { name: "Blackmoor Colliers",    abbrev: "BLK", colors: ["#1b4f72", "#f4d03f"] },
  { name: "Caldermere",            abbrev: "CAL", colors: ["#76d7c4", "#1a1a1a"] },
  { name: "Dunsworth Forgers",     abbrev: "DUN", colors: ["#f39c12", "#2c3e50"] },
  { name: "Eastcliffe Cormorants", abbrev: "EAS", colors: ["#2980b9", "#ffffff"] },
  { name: "Farrowgate Town",       abbrev: "FAR", colors: ["#27ae60", "#ffffff"] },
  { name: "Grimsdale",             abbrev: "GRI", colors: ["#8e44ad", "#f1c40f"] },
  { name: "Harrowfield Ploughmen", abbrev: "HAR", colors: ["#e74c3c", "#3498db"] },
  { name: "Ironbridge Wanderers",  abbrev: "IRO", colors: ["#7f8c8d", "#e67e22"] },
  { name: "Kestrel Park Sentinels", abbrev: "KES", colors: ["#16a085", "#ecf0f1"] },
  { name: "Lowton Sabres",         abbrev: "LOW", colors: ["#ffffff", "#2c3e50"] },
  { name: "Marshbrook",            abbrev: "MAR", colors: ["#d35400", "#1a1a1a"] },
  { name: "Netherby",              abbrev: "NET", colors: ["#f7dc6f", "#145a32"] },
  { name: "Oakhaven Stags",        abbrev: "OAK", colors: ["#145a32", "#f4d03f"] },
  { name: "Pendlewick Larks",      abbrev: "PEN", colors: ["#2e4053", "#e74c3c"] },
  { name: "Quarrington Masons",    abbrev: "QUA", colors: ["#6c3483", "#ffffff"] },
  { name: "Redmarsh Rovers",       abbrev: "RED", colors: ["#922b21", "#f0f3f4"] },
  { name: "Silverdale",            abbrev: "SIL", colors: ["#aab7b8", "#17202a"] },
  { name: "Thornbury Foresters",   abbrev: "THO", colors: ["#0e6251", "#f5b041"] },
  { name: "Wyverngate Crowns",     abbrev: "WYV", colors: ["#1f618d", "#f8f9f9"] },
  { name: "Ambervale Rovers",    abbrev: "AMB", colors: ["#8e2de2", "#f2f2f2"] },
  { name: "Brindlecombe",        abbrev: "BRI", colors: ["#2c3e50", "#e67e22"] },
  { name: "Copperfield Town",    abbrev: "COP", colors: ["#b5651d", "#ffffff"] },
  { name: "Draymoor United",     abbrev: "DRA", colors: ["#1a5276", "#f1c40f"] },
  { name: "Elderglen",           abbrev: "ELD", colors: ["#145a32", "#ecf0f1"] },
  { name: "Foxholt Wanderers",   abbrev: "FOX", colors: ["#c0392b", "#2c3e50"] },
  { name: "Gaunt Valley",        abbrev: "GAU", colors: ["#5b2c6f", "#f4d03f"] },
  { name: "Hollowbeck",          abbrev: "HOL", colors: ["#117864", "#ffffff"] },
  { name: "Inkersley Athletic",  abbrev: "INK", colors: ["#212f3d", "#e74c3c"] },
  { name: "Juniper Crossing",    abbrev: "JUN", colors: ["#1e8449", "#f7dc6f"] },
  { name: "Kirkstall Miners",    abbrev: "KIR", colors: ["#4a235a", "#aeb6bf"] },
  { name: "Larkspur Town",       abbrev: "LAR", colors: ["#0b5345", "#f5b041"] },
  { name: "Millbrook Rangers",   abbrev: "MIL", colors: ["#7b241c", "#f0f3f4"] },
  { name: "Norwick Athletic",    abbrev: "NOR", colors: ["#1b2631", "#f39c12"] },
  { name: "Old Fenwick",         abbrev: "OLF", colors: ["#154360", "#ffffff"] },
  { name: "Pinehollow",          abbrev: "PIN", colors: ["#145214", "#f8c471"] },
  { name: "Ravensgate",          abbrev: "RAV", colors: ["#1c2833", "#c0392b"] },
  { name: "Steeplecross",        abbrev: "STE", colors: ["#6e2c00", "#f4f6f6"] },
  { name: "Underholt Town",      abbrev: "UND", colors: ["#283747", "#f1948a"] },
  { name: "Vaultbridge",         abbrev: "VAU", colors: ["#512e5f", "#ffffff"] },
];

export interface StoredTeam {
  tid: number;
  name: string;
  abbrev: string;
  colors: [string, string];
  roster: number[];
  /**
   * The user's own youth-academy holding pool (see YOUTH_CONTRACT_LENGTH /
   * ACADEMY_STIPEND_WEEKLY in constants.ts): prospects here draw a flat
   * stipend, can't be transferred, and need an explicit "promote" action to
   * join `roster`. AI clubs' youth intake still lands straight on `roster`
   * (unchanged) — only the user's academy is a real holding pool — so this
   * stays empty for every AI team.
   */
  academyRoster: number[];
  /** Funds available to spend on wages, transfers, and scouting. */
  budget: number;
  /** Fame/popularity, 0-100; drives a damped ticket/jersey revenue channel. */
  hype: number;
  /** This season's scouting spend, deducted from budget; lowers transfer valuation noise. */
  scoutingSpend: number;
  /** Fixed generation-time strength anchor for this club's youth intake (see LeagueTeam.academyBase). */
  academyBase: number;
  /** Which division this club currently plays in: 0 = English Division 1, 1 = English Division 2. Changes on promotion/relegation. */
  division: 0 | 1;
  /**
   * Non-null while academyBase is still converging toward this division's
   * strength band after a promotion/relegation swap (see src/core/promotion.ts).
   * Null for a club that hasn't swapped divisions (or finished converging).
   */
  divisionConvergence: { seasonsRemaining: number } | null;
  /**
   * User-chosen starting XI (11 pids), or null to auto-select via selectXI.
   * Only ever set for the user's own team; AI teams always auto-select.
   */
  starters: number[] | null;
}

/**
 * Zip club identities onto league teams: CLUBS[tid] provides the name,
 * abbreviation, and colors for each team. Season 1 starts like every other
 * season: the base allocation arrives and the initial squad's wages come
 * straight out of it, so a club's opening budget is its genuinely spendable
 * cash (expensive squads start with less of it).
 */
export function assignIdentities(league: League): StoredTeam[] {
  const salaryMap = new Map(league.players.map((p) => [p.pid, p.contract.salary]));
  return league.teams.map((t) => {
    const club = CLUBS[t.tid];
    return {
      tid: t.tid,
      name: club.name,
      abbrev: club.abbrev,
      colors: club.colors,
      roster: t.roster,
      academyRoster: [],
      budget: chargeSeasonStart(0, wageBill(t.roster, salaryMap), t.division),
      hype: HYPE_INITIAL,
      scoutingSpend: SCOUTING_SPEND_MIN,
      academyBase: t.academyBase,
      division: t.division,
      divisionConvergence: null,
      starters: null,
    };
  });
}
