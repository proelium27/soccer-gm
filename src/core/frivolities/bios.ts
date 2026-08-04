import type { LeagueStore } from "../leagueState.js";
import { allCareers, type CareerRow } from "./careers.js";
import type { Player, Position } from "../players/types.js";

/** How many rows each bio list shows. */
export const BIO_LIST_LIMIT = 20;

/** A player reduced to what the bio lists render, so the UI needs no pool lookup. */
export interface BioRow {
  pid: number;
  name: string;
  nationality: string;
  pos: Position;
  tid: number | null;
  age: number;
  heightCm: number;
  ovr: number;
}

/** Where one country's players are, and how good they are. */
export interface NationalityRow {
  nationality: string;
  count: number;
  /** Mean ovr across every player from this country currently in the world. */
  avgOvr: number;
  /** How many are on a senior roster rather than unsigned or in an academy. */
  rostered: number;
  /** The country's best player right now. */
  best: BioRow | null;
}

/** A repeated name and how many players currently share it. */
export interface NameCount {
  name: string;
  count: number;
}

/**
 * A player who only ever appeared for one club.
 *
 * Lives with the player lists rather than the club ones: it's a fact about a
 * career, and it's shown on the Player Bios tab.
 */
export interface OneClubMan {
  career: CareerRow;
  tid: number;
}

export interface PlayerBios {
  tallest: BioRow[];
  shortest: BioRow[];
  oldest: BioRow[];
  youngest: BioRow[];
  /** Every country with at least one player, most players first. */
  nationalities: NationalityRow[];
  longestNames: BioRow[];
  /** Most common first names among current players. */
  commonFirstNames: NameCount[];
  /** Most common surnames among current players. */
  commonSurnames: NameCount[];
  /**
   * Longest single-club careers, most appearances first. Unlike the lists above
   * this one spans retirees as well as the living, since a one-club career is
   * an all-time claim rather than a fact about the current world.
   */
  oneClubMen: OneClubMan[];
  /** How many players these lists were drawn from. */
  poolSize: number;
}

/**
 * Split a name into first and last for the "how many Rodrigos are there"
 * counts. Everything after the first space is the surname, so multi-part
 * surnames stay whole rather than being counted as separate people.
 */
function splitName(name: string): { first: string; last: string } {
  const at = name.indexOf(" ");
  return at < 0
    ? { first: name, last: "" }
    : { first: name.slice(0, at), last: name.slice(at + 1) };
}

function tally(values: string[], limit: number): NameCount[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .filter((r) => r.count > 1)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/**
 * The bio superlatives, over the players **currently in the world**.
 *
 * Deliberately not merged with the retiree archive the way the record lists
 * are: "who is the tallest player" is a question about the league you're
 * managing right now, and answering it with a defender who retired eleven
 * seasons ago would be a worse answer, not a more complete one. The all-time
 * questions live in the record book instead.
 *
 * Academy players are included — they're real players at the club, and
 * excluding them would make the youngest-players list nonsense.
 */
export function computePlayerBios(league: LeagueStore, limit = BIO_LIST_LIMIT): PlayerBios {
  const tidByPid = new Map<number, number>();
  const rosteredPids = new Set<number>();
  for (const t of league.teams) {
    for (const pid of t.roster) { tidByPid.set(pid, t.tid); rosteredPids.add(pid); }
    for (const pid of t.academyRoster) tidByPid.set(pid, t.tid);
  }

  const row = (p: Player): BioRow => ({
    pid: p.pid,
    name: p.name,
    nationality: p.nationality,
    pos: p.pos,
    tid: tidByPid.get(p.pid) ?? null,
    age: league.season - p.born,
    heightCm: p.heightCm,
    ovr: p.ovr,
  });
  const rows = league.players.map(row);

  // pid as a stable tiebreak throughout: heights and ages tie constantly across
  // thousands of players, and without it the tables reshuffle on every render.
  const by = (pick: (r: BioRow) => number, dir: 1 | -1) =>
    [...rows].sort((a, b) => dir * (pick(b) - pick(a)) || a.pid - b.pid).slice(0, limit);

  // --- Nationalities ------------------------------------------------------
  const byCountry = new Map<string, BioRow[]>();
  for (const r of rows) {
    const list = byCountry.get(r.nationality);
    if (list) list.push(r); else byCountry.set(r.nationality, [r]);
  }
  const nationalities: NationalityRow[] = [...byCountry.entries()]
    .map(([nationality, list]) => ({
      nationality,
      count: list.length,
      avgOvr: list.reduce((sum, r) => sum + r.ovr, 0) / list.length,
      rostered: list.filter((r) => rosteredPids.has(r.pid)).length,
      best: list.reduce<BioRow | null>(
        (best, r) => (!best || r.ovr > best.ovr || (r.ovr === best.ovr && r.pid < best.pid) ? r : best),
        null,
      ),
    }))
    .sort((a, b) => b.count - a.count || a.nationality.localeCompare(b.nationality));

  const names = rows.map((r) => splitName(r.name));

  return {
    tallest: by((r) => r.heightCm, 1),
    shortest: by((r) => r.heightCm, -1),
    oldest: by((r) => r.age, 1),
    youngest: by((r) => r.age, -1),
    nationalities,
    longestNames: by((r) => r.name.length, 1),
    commonFirstNames: tally(names.map((n) => n.first), limit),
    commonSurnames: tally(names.map((n) => n.last), limit),
    oneClubMen: allCareers(league)
      .filter((c) => c.clubs.length === 1)
      .sort((a, b) => b.totals.appearances - a.totals.appearances || a.pid - b.pid)
      .slice(0, limit)
      .map((career) => ({ career, tid: career.clubs[0] })),
    poolSize: rows.length,
  };
}
