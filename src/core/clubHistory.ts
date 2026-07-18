import type { LeagueStore } from "./leagueState.js";
import type { StandingsRow } from "./standings.js";
import { tierOf } from "./competitions.js";

/** One completed season from a single club's perspective. */
export interface ClubSeasonRecord {
  season: number;
  /** Competition the club played in *that* season (from the season's compsByTid snapshot). */
  compId: number;
  tier: 1 | 2;
  /** 1-based finishing position within the club's competition that season. */
  position: number;
  teamsInComp: number;
  row: StandingsRow;
  /** Finished 1st in its competition that season. */
  champion: boolean;
  /** Moved up a tier for the *following* season (or, for the latest completed season, vs. the club's current tier). */
  promoted: boolean;
  /** Moved down a tier for the following season. */
  relegated: boolean;
  /** This club's Player of the Season winner that season, if any (0 or 1 pid). */
  playerOfSeasonPid: number | null;
  /** This club's Golden Boot winner that season, if any. */
  goldenBootPid: number | null;
  /** This club's players selected in the season's Team of the Season. */
  teamOfSeasonPids: number[];
}

/** An individual honour won by one of the club's players in a given season. */
export interface ClubIndividualHonour {
  season: number;
  compId: number;
  pid: number;
}

export interface ClubHistory {
  tid: number;
  seasonsPlayed: number;
  /** Seasons (ending-season numbers) the club won a tier-1 title, newest first. */
  leagueTitles: number[];
  /** Seasons the club won a tier-2 title, newest first. */
  secondTierTitles: number[];
  /** Seasons at the end of which the club was promoted, newest first. */
  promotions: number[];
  /** Seasons at the end of which the club was relegated, newest first. */
  relegations: number[];
  playerOfSeason: ClubIndividualHonour[];
  goldenBoots: ClubIndividualHonour[];
  teamOfSeasonSelections: ClubIndividualHonour[];
  /** All-time aggregate record across every completed season. */
  totals: { played: number; won: number; drawn: number; lost: number; gf: number; ga: number };
  /** Best (lowest-numbered) finishing position ever, preferring a tier-1 finish; null if no seasons. */
  bestFinish: { season: number; position: number; tier: 1 | 2 } | null;
  mostPoints: { season: number; points: number } | null;
  mostWins: { season: number; won: number } | null;
  /** Every completed season, newest first. */
  seasons: ClubSeasonRecord[];
}

/**
 * Reconstruct a single club's honours and season-by-season record purely from
 * the append-only `seasonHistory` (final tables + per-competition awards) plus
 * the live player pool for award attribution. No schema change: everything
 * here is derived, matching the read-only nature of `awards.ts`.
 */
export function computeClubHistory(league: LeagueStore, tid: number): ClubHistory {
  const { seasonHistory, competitions, players } = league;
  // Oldest → newest so we can look at the *following* season for promotion.
  const ordered = [...seasonHistory].sort((a, b) => a.season - b.season);

  // Season → this club's stat tid for each player, so an award pid can be
  // attributed to the club the player actually played for that season.
  const playerSeasonTid = new Map<string, number | undefined>();
  const seasonTidOf = (pid: number, season: number): number | undefined => {
    const key = `${pid}:${season}`;
    if (!playerSeasonTid.has(key)) {
      const p = players.find((pl) => pl.pid === pid);
      playerSeasonTid.set(key, p?.stats.find((s) => s.season === season)?.tid);
    }
    return playerSeasonTid.get(key);
  };

  const currentTeam = league.teams.find((t) => t.tid === tid);
  const currentTier = currentTeam ? tierOf(competitions, currentTeam.compId) : undefined;

  const records: ClubSeasonRecord[] = ordered.map((entry, i) => {
    const compId = entry.compsByTid[tid];
    const tier = tierOf(competitions, compId);
    // The stored table concatenates each competition's already-sorted rows, so
    // filtering to this club's competition preserves finishing order.
    const compRows = entry.table.filter((r) => entry.compsByTid[r.tid] === compId);
    const idx = compRows.findIndex((r) => r.tid === tid);
    const row = compRows[idx];
    const position = idx + 1;

    const nextTier =
      i + 1 < ordered.length
        ? tierOf(competitions, ordered[i + 1].compsByTid[tid])
        : currentTier;
    const promoted = nextTier !== undefined && nextTier < tier;
    const relegated = nextTier !== undefined && nextTier > tier;

    const awards = entry.awards[compId];
    const belongs = (pid: number | null): boolean =>
      pid !== null && seasonTidOf(pid, entry.season) === tid;

    const playerOfSeasonPid = awards && belongs(awards.playerOfSeasonPid) ? awards.playerOfSeasonPid : null;
    const goldenBootPid = awards && belongs(awards.goldenBootPid) ? awards.goldenBootPid : null;
    const teamOfSeasonPids = awards
      ? awards.teamOfSeason.filter((pid): pid is number => belongs(pid))
      : [];

    return {
      season: entry.season,
      compId,
      tier,
      position,
      teamsInComp: compRows.length,
      row,
      champion: position === 1,
      promoted,
      relegated,
      playerOfSeasonPid,
      goldenBootPid,
      teamOfSeasonPids,
    };
  });

  const totals = records.reduce(
    (acc, r) => ({
      played: acc.played + r.row.played,
      won: acc.won + r.row.won,
      drawn: acc.drawn + r.row.drawn,
      lost: acc.lost + r.row.lost,
      gf: acc.gf + r.row.gf,
      ga: acc.ga + r.row.ga,
    }),
    { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 },
  );

  // Best finish: a tier-1 finish always beats a tier-2 one; within a tier,
  // the lower position number wins; ties broken by the more recent season.
  let bestFinish: ClubHistory["bestFinish"] = null;
  for (const r of records) {
    if (
      bestFinish === null ||
      r.tier < bestFinish.tier ||
      (r.tier === bestFinish.tier && r.position < bestFinish.position)
    ) {
      bestFinish = { season: r.season, position: r.position, tier: r.tier };
    }
  }

  let mostPoints: ClubHistory["mostPoints"] = null;
  let mostWins: ClubHistory["mostWins"] = null;
  for (const r of records) {
    if (mostPoints === null || r.row.points > mostPoints.points) {
      mostPoints = { season: r.season, points: r.row.points };
    }
    if (mostWins === null || r.row.won > mostWins.won) {
      mostWins = { season: r.season, won: r.row.won };
    }
  }

  const newest = [...records].reverse();

  return {
    tid,
    seasonsPlayed: records.length,
    leagueTitles: newest.filter((r) => r.champion && r.tier === 1).map((r) => r.season),
    secondTierTitles: newest.filter((r) => r.champion && r.tier === 2).map((r) => r.season),
    promotions: newest.filter((r) => r.promoted).map((r) => r.season),
    relegations: newest.filter((r) => r.relegated).map((r) => r.season),
    playerOfSeason: newest
      .filter((r) => r.playerOfSeasonPid !== null)
      .map((r) => ({ season: r.season, compId: r.compId, pid: r.playerOfSeasonPid! })),
    goldenBoots: newest
      .filter((r) => r.goldenBootPid !== null)
      .map((r) => ({ season: r.season, compId: r.compId, pid: r.goldenBootPid! })),
    teamOfSeasonSelections: newest.flatMap((r) =>
      r.teamOfSeasonPids.map((pid) => ({ season: r.season, compId: r.compId, pid })),
    ),
    totals,
    bestFinish,
    mostPoints,
    mostWins,
    seasons: newest,
  };
}
