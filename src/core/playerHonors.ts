import type { Player } from "./players/types.js";
import type { SeasonHistoryEntry } from "./standings.js";

/** A player's career honours, each a list of the seasons he won it. */
export interface PlayerHonors {
  ballonDOr: number[];
  worldTeamOfYear: number[];
  playerOfSeason: number[];
  goldenBoot: number[];
  teamOfSeason: number[];
  /** Seasons his club won its league *while he was in the squad*. */
  leagueTitles: number[];
  hasAny: boolean;
}

/**
 * Which club a player was in the squad of during `season`, or undefined if
 * there's no record of him being on a senior roster at all that season.
 *
 * `SeasonStats` is the only per-season roster evidence the game keeps:
 * `accumulateStats` (simThrough.ts) opens a row for *every* player on either
 * club's roster on each matchday, so a squad member gets one even if he never
 * appears (verified on a simmed season: no roster player was missing a row, and
 * several had zero appearances). Its `tid` is the club he was on as of his most
 * recent matchday that season, which is also how `clubHistory.ts` attributes an
 * award to the club a player actually played for.
 *
 * Deliberately NOT reconstructed from transfer history (`teamForSeason` in
 * PlayerProfile): that walk has to guess at seasons before a player's first
 * recorded move, and its fallback is his present-day club — which would hand
 * every new arrival the club's entire back catalogue of titles, including ones
 * won before he was generated.
 */
function squadTidForSeason(player: Player, season: number): number | undefined {
  return player.stats.find((s) => s.season === season)?.tid;
}

/**
 * Derive a player's career honours from the completed seasons in
 * `seasonHistory`. Pure and re-runnable — nothing here is persisted.
 *
 * Individual awards (Ballon d'Or / World XI / POTY / Golden Boot / Team of the
 * Season) are stored by pid so they need no attribution. A league title is a
 * *team* honour, and is only credited for a season the player was actually in
 * the champion's squad.
 *
 * Mid-season transfers keep the existing whole-season attribution (see the
 * "mid-season transfer stat attribution" note in CLAUDE.md): a winter arrival
 * at the champions is credited, a winter departure is not.
 */
export function computePlayerHonors(
  player: Player,
  seasonHistory: SeasonHistoryEntry[],
): PlayerHonors {
  const ballonDOr: number[] = [];
  const worldTeamOfYear: number[] = [];
  const playerOfSeason: number[] = [];
  const goldenBoot: number[] = [];
  const teamOfSeason: number[] = [];
  const leagueTitles: number[] = [];

  for (const entry of seasonHistory) {
    for (const compAwards of Object.values(entry.awards)) {
      if (compAwards.playerOfSeasonPid === player.pid) playerOfSeason.push(entry.season);
      if (compAwards.goldenBootPid === player.pid) goldenBoot.push(entry.season);
      if (compAwards.teamOfSeason.includes(player.pid)) teamOfSeason.push(entry.season);
    }
    // Optional-chained because a save written before worldwide awards only gets
    // `world` once migrateLeague has run over it.
    if (entry.world?.ballonDOr[0]?.pid === player.pid) ballonDOr.push(entry.season);
    if (entry.world?.worldTeamOfYear.includes(player.pid)) worldTeamOfYear.push(entry.season);

    const squadTid = squadTidForSeason(player, entry.season);
    if (squadTid !== undefined && Object.values(entry.championTidByCompId).includes(squadTid)) {
      leagueTitles.push(entry.season);
    }
  }

  return {
    ballonDOr,
    worldTeamOfYear,
    playerOfSeason,
    goldenBoot,
    teamOfSeason,
    leagueTitles,
    hasAny:
      ballonDOr.length > 0 ||
      worldTeamOfYear.length > 0 ||
      playerOfSeason.length > 0 ||
      goldenBoot.length > 0 ||
      teamOfSeason.length > 0 ||
      leagueTitles.length > 0,
  };
}
