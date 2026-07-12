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
  { name: "Blackmoor Rovers",      abbrev: "BLK", colors: ["#1b4f72", "#f4d03f"] },
  { name: "Caldermere City",       abbrev: "CAL", colors: ["#76d7c4", "#1a1a1a"] },
  { name: "Dunsworth Athletic",    abbrev: "DUN", colors: ["#f39c12", "#2c3e50"] },
  { name: "Eastcliffe FC",         abbrev: "EAS", colors: ["#2980b9", "#ffffff"] },
  { name: "Farrowgate Town",       abbrev: "FAR", colors: ["#27ae60", "#ffffff"] },
  { name: "Grimsdale County",      abbrev: "GRI", colors: ["#8e44ad", "#f1c40f"] },
  { name: "Harrowfield United",    abbrev: "HAR", colors: ["#e74c3c", "#3498db"] },
  { name: "Ironbridge Wanderers",  abbrev: "IRO", colors: ["#7f8c8d", "#e67e22"] },
  { name: "Kestrel Park FC",       abbrev: "KES", colors: ["#16a085", "#ecf0f1"] },
  { name: "Lowton Albion",         abbrev: "LOW", colors: ["#ffffff", "#2c3e50"] },
  { name: "Marshbrook FC",         abbrev: "MAR", colors: ["#d35400", "#1a1a1a"] },
  { name: "Netherby Town",         abbrev: "NET", colors: ["#f7dc6f", "#145a32"] },
  { name: "Oakhaven Athletic",     abbrev: "OAK", colors: ["#145a32", "#f4d03f"] },
  { name: "Pendlewick Rangers",    abbrev: "PEN", colors: ["#2e4053", "#e74c3c"] },
  { name: "Quarrington FC",        abbrev: "QUA", colors: ["#6c3483", "#ffffff"] },
  { name: "Redmarsh Rovers",       abbrev: "RED", colors: ["#922b21", "#f0f3f4"] },
  { name: "Silverdale City",       abbrev: "SIL", colors: ["#aab7b8", "#17202a"] },
  { name: "Thornbury Wanderers",   abbrev: "THO", colors: ["#0e6251", "#f5b041"] },
  { name: "Wyverngate United",     abbrev: "WYV", colors: ["#1f618d", "#f8f9f9"] },
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
      budget: chargeSeasonStart(0, wageBill(t.roster, salaryMap)),
      hype: HYPE_INITIAL,
      scoutingSpend: SCOUTING_SPEND_MIN,
      academyBase: t.academyBase,
      starters: null,
    };
  });
}
