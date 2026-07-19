import type { League } from "../league/generate.js";
import type { Competition } from "../competitions.js";
import type { FormationId } from "../lineup/formations.js";
import { chooseBestFormation } from "../lineup/formations.js";
import type { Player } from "../players/types.js";
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
// English clubs (tids 0-19, 20-39... see below): real English cities/towns
// paired with generic, non-trademarked suffixes (United/Town/Rovers/Athletic/
// Wanderers/etc., or no suffix) — not reproductions of actual club names.
export const CLUBS: ClubIdentity[] = [
  { name: "Ashbourne United",     abbrev: "ASH", colors: ["#c0392b", "#ffffff"] },
  { name: "Bakewell Colliers",    abbrev: "BAK", colors: ["#1b4f72", "#f4d03f"] },
  { name: "Chipping Norton",      abbrev: "CHN", colors: ["#76d7c4", "#1a1a1a"] },
  { name: "Devizes Forgers",      abbrev: "DEV", colors: ["#f39c12", "#2c3e50"] },
  { name: "Evesham Cormorants",   abbrev: "EVE", colors: ["#2980b9", "#ffffff"] },
  { name: "Faversham Town",       abbrev: "FAV", colors: ["#27ae60", "#ffffff"] },
  { name: "Glastonbury",          abbrev: "GLA", colors: ["#8e44ad", "#f1c40f"] },
  { name: "Henley Ploughmen",     abbrev: "HEN", colors: ["#e74c3c", "#3498db"] },
  { name: "Ilkley Wanderers",     abbrev: "ILK", colors: ["#7f8c8d", "#e67e22"] },
  { name: "Knaresborough Sentinels", abbrev: "KNA", colors: ["#16a085", "#ecf0f1"] },
  { name: "Ludlow Sabres",        abbrev: "LUD", colors: ["#ffffff", "#2c3e50"] },
  { name: "Marlow",               abbrev: "MAR", colors: ["#d35400", "#1a1a1a"] },
  { name: "Newark",               abbrev: "NEW", colors: ["#f7dc6f", "#145a32"] },
  { name: "Oakham Stags",         abbrev: "OAK", colors: ["#145a32", "#f4d03f"] },
  { name: "Petworth Larks",       abbrev: "PET", colors: ["#2e4053", "#e74c3c"] },
  { name: "Ross Masons",          abbrev: "ROS", colors: ["#6c3483", "#ffffff"] },
  { name: "Sudbury Rovers",       abbrev: "SUD", colors: ["#922b21", "#f0f3f4"] },
  { name: "Tewkesbury",           abbrev: "TEW", colors: ["#aab7b8", "#17202a"] },
  { name: "Uppingham Foresters",  abbrev: "UPP", colors: ["#0e6251", "#f5b041"] },
  { name: "Wallingford Crowns",   abbrev: "WAL", colors: ["#1f618d", "#f8f9f9"] },
  { name: "Amersham Rovers",     abbrev: "AME", colors: ["#8e2de2", "#f2f2f2"] },
  { name: "Bourton",             abbrev: "BOU", colors: ["#2c3e50", "#e67e22"] },
  { name: "Corbridge Town",      abbrev: "CBR", colors: ["#b5651d", "#ffffff"] },
  { name: "Dorking United",      abbrev: "DOR", colors: ["#1a5276", "#f1c40f"] },
  { name: "Emsworth",            abbrev: "EMS", colors: ["#145a32", "#ecf0f1"] },
  { name: "Framlingham Wanderers", abbrev: "FRA", colors: ["#c0392b", "#2c3e50"] },
  { name: "Grantham",            abbrev: "GRN", colors: ["#5b2c6f", "#f4d03f"] },
  { name: "Haslemere",           abbrev: "HAS", colors: ["#117864", "#ffffff"] },
  { name: "Ivybridge Athletic",  abbrev: "IVY", colors: ["#212f3d", "#e74c3c"] },
  { name: "Kirkby",              abbrev: "KIR", colors: ["#1e8449", "#f7dc6f"] },
  { name: "Louth Miners",        abbrev: "LOU", colors: ["#4a235a", "#aeb6bf"] },
  { name: "Malmesbury Town",     abbrev: "MAL", colors: ["#0b5345", "#f5b041"] },
  { name: "Nantwich Rangers",    abbrev: "NAN", colors: ["#7b241c", "#f0f3f4"] },
  { name: "Oundle Athletic",     abbrev: "OUN", colors: ["#1b2631", "#f39c12"] },
  { name: "Pershore",            abbrev: "PSH", colors: ["#154360", "#ffffff"] },
  { name: "Rye",                 abbrev: "RYE", colors: ["#145214", "#f8c471"] },
  { name: "Stamford",            abbrev: "STA", colors: ["#1c2833", "#c0392b"] },
  { name: "Thirsk",              abbrev: "THI", colors: ["#6e2c00", "#f4f6f6"] },
  { name: "Uttoxeter Town",      abbrev: "UTT", colors: ["#283747", "#f1948a"] },
  { name: "Wetherby",            abbrev: "WET", colors: ["#512e5f", "#ffffff"] },
  // Spanish clubs (tids 40-79): real Spanish cities/towns, styled like the
  // English list above — most carry a distinctive noun suffix (varied, not a
  // single generic tag repeated), some stand alone with just the town name.
  { name: "Madrid",              abbrev: "MAD", colors: ["#c0392b", "#f1c40f"] },
  { name: "Barcelona Halcones",  abbrev: "BAR", colors: ["#1a5276", "#ffffff"] },
  { name: "Valencia",            abbrev: "VAL", colors: ["#e74c3c", "#1a1a1a"] },
  { name: "Sevilla Toros",       abbrev: "SEV", colors: ["#154360", "#f4d03f"] },
  { name: "Zaragoza Mineros",    abbrev: "ZAR", colors: ["#ffffff", "#2874a6"] },
  { name: "Malaga",              abbrev: "MLG", colors: ["#1a1a1a", "#f0f3f4"] },
  { name: "Murcia Lobos",        abbrev: "MUR", colors: ["#d35400", "#1a1a1a"] },
  { name: "Palma Aguilas",       abbrev: "PAL", colors: ["#7d6608", "#f7dc6f"] },
  { name: "Bilbao Centinelas",   abbrev: "BIL", colors: ["#212f3d", "#e74c3c"] },
  { name: "Alicante",            abbrev: "ALI", colors: ["#196f3d", "#ffffff"] },
  { name: "Cordoba Cazadores",   abbrev: "COR", colors: ["#a04000", "#f5b7b1"] },
  { name: "Valladolid Real",     abbrev: "VLL", colors: ["#5b2c6f", "#f4d03f"] },
  { name: "Vigo Pescadores",     abbrev: "VIG", colors: ["#0b5345", "#f8c471"] },
  { name: "Gijon",               abbrev: "GIJ", colors: ["#943126", "#ecf0f1"] },
  { name: "Granada Leones",      abbrev: "GRA", colors: ["#1b4f72", "#e67e22"] },
  { name: "Vitoria Errantes",    abbrev: "VIT", colors: ["#17202a", "#c0392b"] },
  { name: "Elche",               abbrev: "ELC", colors: ["#145a32", "#f1c40f"] },
  { name: "Oviedo Herreros",     abbrev: "OVI", colors: ["#b7950b", "#1a1a1a"] },
  { name: "Badalona Union",      abbrev: "BAD", colors: ["#78281f", "#f0f3f4"] },
  { name: "Cartagena Forjadores", abbrev: "CAR", colors: ["#ffffff", "#922b21"] },
  { name: "Terrassa",            abbrev: "TER", colors: ["#2e4053", "#f39c12"] },
  { name: "Jerez Halcones",      abbrev: "JER", colors: ["#0e6251", "#ecf0f1"] },
  { name: "Sabadell Guardianes", abbrev: "SAB", colors: ["#4a235a", "#f7dc6f"] },
  { name: "Mostoles",            abbrev: "MOS", colors: ["#e67e22", "#1a1a1a"] },
  { name: "Alcala Toros",        abbrev: "ALC", colors: ["#186a3b", "#f4f6f6"] },
  { name: "Pamplona Sables",     abbrev: "PAM", colors: ["#f1c40f", "#212f3d"] },
  { name: "Fuenlabrada Atletico", abbrev: "FUE", colors: ["#641e16", "#f0f3f4"] },
  { name: "Almeria",             abbrev: "ALM", colors: ["#1a5276", "#f5b041"] },
  { name: "Leganes Alondras",    abbrev: "LEG", colors: ["#6e2c00", "#ffffff"] },
  { name: "Santander Coronados", abbrev: "SAN", colors: ["#1c2833", "#e74c3c"] },
  { name: "Burgos",              abbrev: "BUR", colors: ["#0b5345", "#f8c471"] },
  { name: "Castellon Canteros",  abbrev: "CAS", colors: ["#512e5f", "#f0f3f4"] },
  { name: "Getafe Real",         abbrev: "GET", colors: ["#a93226", "#f4d03f"] },
  { name: "Albacete Ciervos",    abbrev: "ALB", colors: ["#154360", "#e67e22"] },
  { name: "Alcorcon",            abbrev: "ALK", colors: ["#7d6608", "#ffffff"] },
  { name: "Donostia Lobos",      abbrev: "DON", colors: ["#117864", "#f7dc6f"] },
  { name: "Logrono Aguilas",     abbrev: "LOG", colors: ["#78281f", "#ecf0f1"] },
  { name: "Huelva",              abbrev: "HUE", colors: ["#1b2631", "#f39c12"] },
  { name: "Tarragona Centinelas", abbrev: "TAR", colors: ["#0e6251", "#f5b7b1"] },
  { name: "Leon CF",             abbrev: "LEO", colors: ["#283747", "#f8f9f8"] },
  // Italian clubs (tids 80-119): real Italian cities/towns, same styling
  // principle as Spain above — varied noun suffixes or none, not a single
  // generic tag (Calcio/AC/FC/Unione/Sportiva) repeated for every club.
  { name: "Milano",              abbrev: "MLN", colors: ["#1e8449", "#ffffff"] },
  { name: "Torino Lupi",         abbrev: "TOR", colors: ["#154360", "#f1c40f"] },
  { name: "Napoli",              abbrev: "NAP", colors: ["#78281f", "#1a1a1a"] },
  { name: "Genova Falchi",       abbrev: "GEN", colors: ["#1a1a1a", "#f4d03f"] },
  { name: "Bologna Aquile",      abbrev: "BOL", colors: ["#c0392b", "#f0f3f4"] },
  { name: "Firenze",             abbrev: "FIR", colors: ["#212f3d", "#e67e22"] },
  { name: "Bari Leoni",          abbrev: "BAI", colors: ["#d68910", "#1a1a1a"] },
  { name: "Catania Cacciatori",  abbrev: "CAT", colors: ["#7d3c98", "#f7dc6f"] },
  { name: "Verona",              abbrev: "VER", colors: ["#0b5345", "#e74c3c"] },
  { name: "Padova Pescatori",    abbrev: "PAD", colors: ["#1b4f72", "#f0f3f4"] },
  { name: "Venezia Minatori",    abbrev: "VEN", colors: ["#943126", "#ecf0f1"] },
  { name: "Palermo",             abbrev: "PLM", colors: ["#186a3b", "#f4d03f"] },
  { name: "Trieste Fabbri",      abbrev: "TRI", colors: ["#5b2c6f", "#f8c471"] },
  { name: "Brescia Sentinelle",  abbrev: "BRE", colors: ["#b03a2e", "#ffffff"] },
  { name: "Parma",               abbrev: "PAR", colors: ["#17202a", "#e67e22"] },
  { name: "Modena Vagabondi",    abbrev: "MOD", colors: ["#0e6251", "#f5b041"] },
  { name: "Reggio Guardiani",    abbrev: "REG", colors: ["#196f3d", "#f1c40f"] },
  { name: "Perugia",             abbrev: "PER", colors: ["#b7950b", "#1a1a1a"] },
  { name: "Livorno Scalpellini", abbrev: "LIV", colors: ["#6e2c00", "#f4f6f6"] },
  { name: "Foggia Allodole",     abbrev: "FOG", colors: ["#ffffff", "#78281f"] },
  { name: "Salerno",             abbrev: "SAL", colors: ["#2e4053", "#f39c12"] },
  { name: "Ferrara Cervi",       abbrev: "FER", colors: ["#0b5345", "#ecf0f1"] },
  { name: "Pisa Sciabole",       abbrev: "PIS", colors: ["#4a235a", "#f7dc6f"] },
  { name: "Bergamo",             abbrev: "BGM", colors: ["#e67e22", "#1a1a1a"] },
  { name: "Vicenza Boscaioli",   abbrev: "VIC", colors: ["#186a3b", "#f8f9f9"] },
  { name: "Taranto Incoronati",  abbrev: "TRN", colors: ["#f1c40f", "#1a1a1a"] },
  { name: "Cagliari",            abbrev: "CAG", colors: ["#641e16", "#f4f6f6"] },
  { name: "Messina Lupi",        abbrev: "MES", colors: ["#1a5276", "#f5b041"] },
  { name: "Siena Falchi",        abbrev: "SIE", colors: ["#6e2c00", "#ecf0f1"] },
  { name: "Cremona",             abbrev: "CRE", colors: ["#1c2833", "#e74c3c"] },
  { name: "Ravenna Aquile",      abbrev: "RVN", colors: ["#0b5345", "#f8c471"] },
  { name: "Lecce Leoni",         abbrev: "LEC", colors: ["#512e5f", "#f4f6f6"] },
  { name: "Pescara",             abbrev: "PES", colors: ["#a93226", "#f4d03f"] },
  { name: "Ancona Cacciatori",   abbrev: "ANC", colors: ["#154360", "#e67e22"] },
  { name: "Piacenza Pescatori",  abbrev: "PIA", colors: ["#7d6608", "#ffffff"] },
  { name: "Novara",              abbrev: "NOV", colors: ["#117864", "#f7dc6f"] },
  { name: "Udine Minatori",      abbrev: "UDI", colors: ["#78281f", "#f0f3f4"] },
  { name: "Como Fabbri",         abbrev: "COM", colors: ["#1b2631", "#f39c12"] },
  { name: "Latina",              abbrev: "LAT", colors: ["#0e6251", "#f5b7b1"] },
  { name: "Sassari Sentinelle",  abbrev: "SAS", colors: ["#283747", "#f8f9f9"] },
  // German clubs (tids 120-159): real German cities/towns, same styling
  // principle as Spain/Italy above — varied German noun suffixes (Adler/Lowen/
  // Bergleute/Schmiede/etc.) or none, deliberately not reproductions of real
  // Bundesliga club names. ASCII-only spellings (no umlauts/ss), matching the
  // accent-free Spanish/Italian entries.
  { name: "Berlin Adler",        abbrev: "BER", colors: ["#1b2631", "#f1c40f"] },
  { name: "Munchen Lowen",       abbrev: "MUN", colors: ["#c0392b", "#ffffff"] },
  { name: "Hamburg",             abbrev: "HAM", colors: ["#1a5276", "#f0f3f4"] },
  { name: "Koln Greifen",        abbrev: "KLN", colors: ["#7d3c98", "#f7dc6f"] },
  { name: "Frankfurt Falken",    abbrev: "FRK", colors: ["#17202a", "#e74c3c"] },
  { name: "Stuttgart Schmiede",  abbrev: "STU", colors: ["#943126", "#f4d03f"] },
  { name: "Dortmund Bergleute",  abbrev: "DTM", colors: ["#f39c12", "#1a1a1a"] },
  { name: "Leipzig",             abbrev: "LPZ", colors: ["#186a3b", "#ffffff"] },
  { name: "Bremen Wachter",      abbrev: "BRM", colors: ["#0e6251", "#f5b041"] },
  { name: "Hannover Rosser",     abbrev: "HNV", colors: ["#b03a2e", "#f0f3f4"] },
  { name: "Nurnberg",            abbrev: "NRN", colors: ["#212f3d", "#f8c471"] },
  { name: "Dresden Kurfursten",  abbrev: "DRS", colors: ["#5b2c6f", "#f4d03f"] },
  { name: "Freiburg Jager",      abbrev: "FRB", colors: ["#196f3d", "#e67e22"] },
  { name: "Augsburg Weber",      abbrev: "AUG", colors: ["#1a5276", "#ecf0f1"] },
  { name: "Bochum Hammer",       abbrev: "BOC", colors: ["#4a235a", "#f7dc6f"] },
  { name: "Mainz Winzer",        abbrev: "MNZ", colors: ["#7b241c", "#f5b7b1"] },
  { name: "Kiel Mowen",          abbrev: "KIE", colors: ["#154360", "#ffffff"] },
  { name: "Rostock Anker",       abbrev: "RST", colors: ["#0b5345", "#f1c40f"] },
  { name: "Essen Zechen",        abbrev: "ESS", colors: ["#1c2833", "#e74c3c"] },
  { name: "Duisburg Schmelzer",  abbrev: "DUI", colors: ["#6e2c00", "#f4f6f6"] },
  { name: "Bielefeld Leinen",    abbrev: "BIE", colors: ["#283747", "#f39c12"] },
  { name: "Karlsruhe Markgrafen", abbrev: "KRL", colors: ["#a04000", "#f5b041"] },
  { name: "Mannheim Kurpfalz",   abbrev: "MAN", colors: ["#512e5f", "#f0f3f4"] },
  { name: "Wiesbaden Quellen",   abbrev: "WIE", colors: ["#117864", "#f8c471"] },
  { name: "Munster Radler",      abbrev: "MST", colors: ["#1b4f72", "#f7dc6f"] },
  { name: "Aachen Kaiser",       abbrev: "AAC", colors: ["#1a1a1a", "#f4d03f"] },
  { name: "Braunschweig Herzoge", abbrev: "BSC", colors: ["#78281f", "#f8f9f9"] },
  { name: "Kassel Landgrafen",   abbrev: "KSL", colors: ["#186a3b", "#ecf0f1"] },
  { name: "Ulm Spatzen",         abbrev: "ULM", colors: ["#2874a6", "#ffffff"] },
  { name: "Erfurt Gartner",      abbrev: "ERF", colors: ["#0e6251", "#f5b7b1"] },
  { name: "Jena Optiker",        abbrev: "JEN", colors: ["#1e8449", "#1a1a1a"] },
  { name: "Osnabruck Lerchen",   abbrev: "OSN", colors: ["#641e16", "#f4d03f"] },
  { name: "Paderborn Domherren", abbrev: "PBN", colors: ["#154360", "#f5b041"] },
  { name: "Ingolstadt Schanzer", abbrev: "ING", colors: ["#212f3d", "#e67e22"] },
  { name: "Regensburg Steinerne", abbrev: "RGB", colors: ["#7d6608", "#f0f3f4"] },
  { name: "Furth Kleeblatter",   abbrev: "FUR", colors: ["#196f3d", "#ffffff"] },
  { name: "Heidenheim Brenztaler", abbrev: "HDH", colors: ["#b7950b", "#1a1a1a"] },
  { name: "Darmstadt Lilien",    abbrev: "DAR", colors: ["#1b2631", "#5dade2"] },
  { name: "Magdeburg Ottonen",   abbrev: "MAG", colors: ["#0b5345", "#f7dc6f"] },
  { name: "Chemnitz Spinner",    abbrev: "CHE", colors: ["#4a235a", "#f8c471"] },
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
  /**
   * The scouting spend locked in for the *current* season: deducted from
   * budget at season-end settlement, lowers transfer valuation noise, and
   * sharpens the user's potential fog-of-war (see potentialFog.ts). Only
   * changeable at the offseason boundary (it's set from nextScoutingSpend
   * there) — never mid-season — so a player can't crank scouting up to peek
   * at sharper info and turn it back down before paying.
   */
  scoutingSpend: number;
  /**
   * The scouting spend the user is setting for the *upcoming* season, editable
   * only during the offseason phase; becomes scoutingSpend at the next
   * offseason rollover. Kept equal to scoutingSpend for AI teams (they never
   * edit it) and for the user outside the offseason editing window.
   */
  nextScoutingSpend: number;
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
   * The formation this club lines up in (see FORMATIONS in
   * src/core/lineup/formations.js). The user picks theirs on the Roster page;
   * every AI team stays at the "4-3-3" default. Drives which 11 slots the XI
   * fills, so it feeds the real match sim, not just the pitch display.
   */
  formation: FormationId;
  /**
   * User-chosen starting XI (11 pids), or null to auto-select via selectXI.
   * Only ever set for the user's own team; AI teams always auto-select.
   */
  starters: number[] | null;
  /**
   * Pids the user has explicitly listed for transfer — a lower bar than
   * AI_MARKET_MIN_SURPLUS and priority within INBOUND_OFFERS_MAX for
   * inboundOfferCandidates (src/core/transfers/inboundOffers.ts), signaling
   * real willingness to sell rather than guaranteeing a buyer. Only ever set
   * for the user's own team; AI clubs never list (they already shop/sell via
   * the AI↔AI market's own evaluation).
   */
  transferListed: number[];
  /**
   * Scouting fog-of-war: pid → the season the player was first seen on this
   * club's senior roster, so the user's potential estimate for him sharpens
   * with tenure (see src/core/scouting/potentialFog.ts). Only ever populated
   * for the user's own team — AI clubs don't have a fogged view — so it stays
   * an empty object for every AI team.
   */
  scoutingObserved: Record<number, number>;
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
    const budget = chargeSeasonStart(0, wageBill(t.roster, salaryMap), tierOf(competitions, t.compId), HYPE_INITIAL);
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
      nextScoutingSpend: clampScoutingSpend(SCOUTING_SPEND_DEFAULT, budget),
      academyBase: t.academyBase,
      compId: t.compId,
      divisionConvergence: null,
      formation: "4-3-3",
      starters: null,
      transferListed: [],
      scoutingObserved: {},
    };
  });
}

/**
 * Point every AI club at the formation that fields its strongest XI (via
 * chooseBestFormation on its current roster). The user's own club is skipped —
 * they pick their formation manually — so this is safe to re-run each offseason
 * without ever overwriting a user choice. Called at league creation and once
 * per offseason on the settled rosters.
 */
export function assignAIFormations(
  teams: StoredTeam[],
  players: Player[],
  userTid: number,
): StoredTeam[] {
  const byPid = new Map(players.map((p) => [p.pid, p]));
  return teams.map((t) => {
    if (t.tid === userTid) return t;
    const roster = t.roster
      .map((pid) => byPid.get(pid))
      .filter((p): p is Player => p !== undefined);
    return { ...t, formation: chooseBestFormation(roster) };
  });
}
