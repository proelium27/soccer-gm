import type { Player } from "../players/types.js";
import type { LeagueTeam } from "../league/generate.js";
import type { TeamMatchData } from "../league/composites.js";
import type { NationSquad, IntlPowerSnapshot } from "./types.js";
import { leagueMatchData } from "../league/composites.js";
import { chooseBestFormation, FORMATIONS } from "../lineup/formations.js";
import { selectXI } from "../lineup/selectXI.js";
import { confederationOf } from "./confederations.js";
import { INTL_SQUAD_SIZE, INTL_MIN_POOL, INTL_MIN_KEEPERS } from "../constants.js";

/** Every player in the world grouped by nationality. */
export function nationPools(players: Player[]): Map<string, Player[]> {
  const pools = new Map<string, Player[]>();
  for (const p of players) {
    const pool = pools.get(p.nationality);
    if (pool) pool.push(p);
    else pools.set(p.nationality, [p]);
  }
  return pools;
}

/**
 * Whether a nation can enter qualifying: a deep enough player pool, at least
 * one goalkeeper in it, and a confederation to qualify through. See
 * INTL_MIN_POOL for why the keeper floor is a correctness requirement rather
 * than flavour.
 */
export function isEligibleNation(nation: string, pool: Player[]): boolean {
  if (confederationOf(nation) === null) return false;
  if (pool.length < INTL_MIN_POOL) return false;
  return pool.filter((p) => p.pos === "GK").length >= INTL_MIN_KEEPERS;
}

/** Ovr descending, pid ascending — a total order, so squad picks are deterministic. */
function byStrength(a: Player, b: Player): number {
  return b.ovr - a.ovr || a.pid - b.pid;
}

/**
 * Name a nation's squad: its best INTL_SQUAD_SIZE players, keeping up to three
 * goalkeepers and filling the rest with the best outfielders.
 *
 * Fit players are preferred over injured ones at every step, so a squad is only
 * topped up with someone carrying a knock when the nation has nobody fit left.
 * That matters because the match data drops injured players from the XI: a star
 * who ends the club season injured genuinely misses the tournament, but a thin
 * nation still gets to field eleven.
 */
export function selectSquad(pool: Player[]): NationSquad | null {
  const nation = pool[0]?.nationality;
  if (!nation) return null;

  const keepers = pool.filter((p) => p.pos === "GK");
  const outfield = pool.filter((p) => p.pos !== "GK");
  // Fit first, then injured — each block in strength order.
  const preferFit = (ps: Player[]): Player[] => [
    ...ps.filter((p) => !p.injury).sort(byStrength),
    ...ps.filter((p) => p.injury).sort(byStrength),
  ];

  const MAX_KEEPERS = 3;
  const namedKeepers = preferFit(keepers).slice(0, MAX_KEEPERS);
  if (namedKeepers.length === 0) return null;
  const namedOutfield = preferFit(outfield).slice(0, INTL_SQUAD_SIZE - namedKeepers.length);
  const squad = [...namedKeepers, ...namedOutfield];
  if (squad.length < 11) return null;

  const formation = chooseBestFormation(squad);
  const xi = selectXI(squad, FORMATIONS[formation]);
  const rating = xi.length ? xi.reduce((sum, p) => sum + p.ovr, 0) / xi.length : 0;

  return {
    nation,
    pids: squad.map((p) => p.pid),
    formation,
    rating,
  };
}

/**
 * Every nation that can enter a campaign, with its named squad, strongest
 * first. Ranking is by the strength of the eleven each nation would field, not
 * its raw pool size — a nation with six hundred squad players and a mediocre
 * best eleven is not a strong nation.
 */
export function buildSquads(players: Player[]): NationSquad[] {
  const squads: NationSquad[] = [];
  for (const [nation, pool] of nationPools(players)) {
    if (!isEligibleNation(nation, pool)) continue;
    const squad = selectSquad(pool);
    if (squad) squads.push(squad);
  }
  return squads.sort((a, b) => b.rating - a.rating || a.nation.localeCompare(b.nation));
}

/**
 * A national-team power ranking: every eligible nation, strongest first, by its
 * best-available-squad rating. Taken when a campaign is drawn so it reflects
 * end-of-season squads — the raw material for the Power Rankings tab.
 */
export function buildPowerSnapshot(players: Player[], season: number): IntlPowerSnapshot {
  return {
    season,
    ranks: buildSquads(players).map((s) => ({ nation: s.nation, rating: s.rating })),
  };
}

/**
 * Match data for a whole international field, pooled into ONE normalization
 * baseline.
 *
 * This pooling is load-bearing, exactly as it is for the Continental Cup:
 * composites are z-scored across whatever set they're computed over, so
 * normalizing each nation against its own players would flatten every nation
 * to the same strength and make the tournament a coin flip. Every nation in the
 * campaign goes into a single `leagueMatchData` call so the gap between a deep
 * football nation and a thin one survives into the match sim.
 *
 * `nid` (index into `squads`) stands in for `tid` throughout — the match layer
 * only ever treats it as an opaque number.
 */
export function nationMatchData(squads: NationSquad[], players: Player[]): Map<number, TeamMatchData> {
  const teams: LeagueTeam[] = squads.map((squad, nid) => ({
    tid: nid,
    name: squad.nation,
    roster: squad.pids,
    avgOvr: squad.rating,
    academyBase: 0,
    compId: 0,
    starters: null,
    formation: squad.formation,
  }));
  const data = leagueMatchData({ teams, players });
  return new Map(data.map((d, nid) => [nid, d]));
}
