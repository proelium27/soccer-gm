import type { League } from "../league/generate.js";
import type { Competition } from "../competitions.js";
import { HYPE_INITIAL, SCOUTING_SPEND_DEFAULT } from "../constants.js";
import { chargeSeasonStart, wageBill } from "../finance/budget.js";
import { clampScoutingSpend } from "../finance/scouting.js";
import { tierOf } from "../competitions.js";

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
  // Spanish-flavored fictional identities (tids 40-79), same invented-place-name
  // convention as the English list above — no real club names.
  { name: "Montebrisa Deportivo", abbrev: "MBR", colors: ["#c0392b", "#f1c40f"] },
  { name: "Riolindo CF",          abbrev: "RLN", colors: ["#1a5276", "#ffffff"] },
  { name: "Valdesierra Atletico", abbrev: "VDS", colors: ["#e74c3c", "#1a1a1a"] },
  { name: "Puertoclaro Union",    abbrev: "PCL", colors: ["#154360", "#f4d03f"] },
  { name: "Sierrablanca CD",      abbrev: "SBL", colors: ["#ffffff", "#2874a6"] },
  { name: "Casanegra Real",       abbrev: "CNG", colors: ["#1a1a1a", "#f0f3f4"] },
  { name: "Torrefuego CF",        abbrev: "TFG", colors: ["#d35400", "#1a1a1a"] },
  { name: "Almadera Deportivo",   abbrev: "ALM", colors: ["#7d6608", "#f7dc6f"] },
  { name: "Vegaoscura Atletico",  abbrev: "VOS", colors: ["#212f3d", "#e74c3c"] },
  { name: "Cantoverde Union",     abbrev: "CVR", colors: ["#196f3d", "#ffffff"] },
  { name: "Riobello CF",          abbrev: "RBL", colors: ["#a04000", "#f5b7b1"] },
  { name: "Monteclaro Deportivo", abbrev: "MCL", colors: ["#5b2c6f", "#f4d03f"] },
  { name: "Puertosueno CD",       abbrev: "PSU", colors: ["#0b5345", "#f8c471"] },
  { name: "Sierradulce Real",     abbrev: "SDU", colors: ["#943126", "#ecf0f1"] },
  { name: "Casaviento CF",        abbrev: "CVT", colors: ["#1b4f72", "#e67e22"] },
  { name: "Torresombra Atletico", abbrev: "TSB", colors: ["#17202a", "#c0392b"] },
  { name: "Almaverde Union",      abbrev: "AVE", colors: ["#145a32", "#f1c40f"] },
  { name: "Vegadorada Deportivo", abbrev: "VDO", colors: ["#b7950b", "#1a1a1a"] },
  { name: "Cantobravo CF",        abbrev: "CBR", colors: ["#78281f", "#f0f3f4"] },
  { name: "Riosanto CD",          abbrev: "RST", colors: ["#ffffff", "#922b21"] },
  { name: "Montefiel Deportivo",  abbrev: "MFL", colors: ["#2e4053", "#f39c12"] },
  { name: "Puertohondo CF",       abbrev: "PHD", colors: ["#0e6251", "#ecf0f1"] },
  { name: "Sierraluna Atletico",  abbrev: "SLU", colors: ["#4a235a", "#f7dc6f"] },
  { name: "Casadulce Union",      abbrev: "CDU", colors: ["#e67e22", "#1a1a1a"] },
  { name: "Torreverde CD",        abbrev: "TVR", colors: ["#186a3b", "#f4f6f6"] },
  { name: "Almasol Real",         abbrev: "AMS", colors: ["#f1c40f", "#212f3d"] },
  { name: "Vegabravo CF",         abbrev: "VBR", colors: ["#641e16", "#f0f3f4"] },
  { name: "Cantoclaro Deportivo", abbrev: "CCL", colors: ["#1a5276", "#f5b041"] },
  { name: "Riofiel CF",           abbrev: "RFL", colors: ["#6e2c00", "#ffffff"] },
  { name: "Montesombra Atletico", abbrev: "MSB", colors: ["#1c2833", "#e74c3c"] },
  { name: "Puertobello Union",    abbrev: "PBL", colors: ["#0b5345", "#f8c471"] },
  { name: "Sierrasueno CD",       abbrev: "SSU", colors: ["#512e5f", "#f0f3f4"] },
  { name: "Casafuego Real",       abbrev: "CFU", colors: ["#a93226", "#f4d03f"] },
  { name: "Torrebravo CF",        abbrev: "TBR", colors: ["#154360", "#e67e22"] },
  { name: "Almadorado Deportivo", abbrev: "ADO", colors: ["#7d6608", "#ffffff"] },
  { name: "Vegaclara CF",         abbrev: "VCL", colors: ["#117864", "#f7dc6f"] },
  { name: "Cantosanto Atletico",  abbrev: "CST", colors: ["#78281f", "#ecf0f1"] },
  { name: "Riohondo Union",       abbrev: "RHD", colors: ["#1b2631", "#f39c12"] },
  { name: "Monteveloz CD",        abbrev: "MVL", colors: ["#0e6251", "#f5b7b1"] },
  { name: "Sierrafiel Real",      abbrev: "SFL", colors: ["#283747", "#f8f9f8"] },
  // Italian-flavored fictional identities (tids 80-119), same convention.
  { name: "Montefosca Calcio",       abbrev: "MFO", colors: ["#1e8449", "#ffffff"] },
  { name: "Riondato AC",             abbrev: "RDT", colors: ["#154360", "#f1c40f"] },
  { name: "Vallescura Unione",       abbrev: "VSC", colors: ["#78281f", "#1a1a1a"] },
  { name: "Portofiero FC",           abbrev: "PFR", colors: ["#1a1a1a", "#f4d03f"] },
  { name: "Serracalda AC",           abbrev: "SCA", colors: ["#c0392b", "#f0f3f4"] },
  { name: "Casanera Sportiva",       abbrev: "CNR", colors: ["#212f3d", "#e67e22"] },
  { name: "Torresole Calcio",        abbrev: "TSL", colors: ["#d68910", "#1a1a1a"] },
  { name: "Almafiore AC",            abbrev: "AFI", colors: ["#7d3c98", "#f7dc6f"] },
  { name: "Valdombra Unione",        abbrev: "VDM", colors: ["#0b5345", "#e74c3c"] },
  { name: "Cantogrande FC",          abbrev: "CGR", colors: ["#1b4f72", "#f0f3f4"] },
  { name: "Rionero Calcio",          abbrev: "RNR", colors: ["#943126", "#ecf0f1"] },
  { name: "Montesalvo AC",           abbrev: "MSV", colors: ["#186a3b", "#f4d03f"] },
  { name: "Portovento Sportiva",     abbrev: "PVN", colors: ["#5b2c6f", "#f8c471"] },
  { name: "Serradolce FC",           abbrev: "SDL", colors: ["#b03a2e", "#ffffff"] },
  { name: "Casaluna Calcio",         abbrev: "CLN", colors: ["#17202a", "#e67e22"] },
  { name: "Torreombra AC",           abbrev: "TOM", colors: ["#0e6251", "#f5b041"] },
  { name: "Almaverdi Unione",        abbrev: "AVD", colors: ["#196f3d", "#f1c40f"] },
  { name: "Vegadorato FC",           abbrev: "VGD", colors: ["#b7950b", "#1a1a1a"] },
  { name: "Cantobruno Calcio",       abbrev: "CBN", colors: ["#6e2c00", "#f4f6f6"] },
  { name: "Riosanto AC",             abbrev: "RSA", colors: ["#ffffff", "#78281f"] },
  { name: "Montefiero Sportiva",     abbrev: "MFR", colors: ["#2e4053", "#f39c12"] },
  { name: "Portoprofondo FC",        abbrev: "PPR", colors: ["#0b5345", "#ecf0f1"] },
  { name: "Serraluna Calcio",        abbrev: "SRL", colors: ["#4a235a", "#f7dc6f"] },
  { name: "Casadolce AC",            abbrev: "CDL", colors: ["#e67e22", "#1a1a1a"] },
  { name: "Torreverdi Unione",       abbrev: "TVD", colors: ["#186a3b", "#f8f9f9"] },
  { name: "Almasole FC",             abbrev: "AMO", colors: ["#f1c40f", "#1a1a1a"] },
  { name: "Vegabruno Calcio",        abbrev: "VBN", colors: ["#641e16", "#f4f6f6"] },
  { name: "Cantochiaro AC",          abbrev: "CCH", colors: ["#1a5276", "#f5b041"] },
  { name: "Riofiero Sportiva",       abbrev: "RFR", colors: ["#6e2c00", "#ecf0f1"] },
  { name: "Monteombra FC",           abbrev: "MOM", colors: ["#1c2833", "#e74c3c"] },
  { name: "Portobello Calcio",       abbrev: "PBE", colors: ["#0b5345", "#f8c471"] },
  { name: "Serrasogno AC",           abbrev: "SSG", colors: ["#512e5f", "#f4f6f6"] },
  { name: "Casafuoco Unione",        abbrev: "CFO", colors: ["#a93226", "#f4d03f"] },
  { name: "Torrebruno FC",           abbrev: "TBN", colors: ["#154360", "#e67e22"] },
  { name: "Almadorato Calcio",       abbrev: "AMD", colors: ["#7d6608", "#ffffff"] },
  { name: "Vegachiara AC",           abbrev: "VCH", colors: ["#117864", "#f7dc6f"] },
  { name: "Cantosanto Sportiva",     abbrev: "CTS", colors: ["#78281f", "#f0f3f4"] },
  { name: "Riofondo FC",             abbrev: "RFN", colors: ["#1b2631", "#f39c12"] },
  { name: "Montevelo Calcio",        abbrev: "MVO", colors: ["#0e6251", "#f5b7b1"] },
  { name: "Serrafiera AC",           abbrev: "SFR", colors: ["#283747", "#f8f9f9"] },
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
  /** Which competition this club currently plays in (see src/core/competitions.ts). Changes on promotion/relegation. */
  compId: number;
  /**
   * Non-null while academyBase is still converging toward this competition's
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
export function assignIdentities(league: League, competitions: Competition[]): StoredTeam[] {
  const salaryMap = new Map(league.players.map((p) => [p.pid, p.contract.salary]));
  return league.teams.map((t) => {
    const club = CLUBS[t.tid];
    const budget = chargeSeasonStart(0, wageBill(t.roster, salaryMap), tierOf(competitions, t.compId));
    return {
      tid: t.tid,
      name: club.name,
      abbrev: club.abbrev,
      colors: club.colors,
      roster: t.roster,
      academyRoster: [],
      budget,
      hype: HYPE_INITIAL,
      scoutingSpend: clampScoutingSpend(SCOUTING_SPEND_DEFAULT, budget),
      academyBase: t.academyBase,
      compId: t.compId,
      divisionConvergence: null,
      starters: null,
    };
  });
}
