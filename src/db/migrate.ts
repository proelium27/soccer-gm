import type { LeagueStore } from "../core/leagueState.js";
import type { StoredTeam } from "../core/teams/clubs.js";
import { BASE_SEASON_BUDGET, HYPE_INITIAL, SCOUTING_SPEND_MIN } from "../core/constants.js";

/** A team as it may exist in a save written before M6 added the finance fields. */
type StoredTeamAnyVersion = Omit<StoredTeam, "budget" | "hype" | "scoutingSpend"> &
  Partial<Pick<StoredTeam, "budget" | "hype" | "scoutingSpend">>;

/**
 * Backfill fields added to the schema since a league was saved. Every league
 * coming out of IndexedDB or a JSON import passes through here, so the rest
 * of the app can rely on the LeagueStore type telling the truth.
 *
 * Pre-M6 saves lack the finance fields on teams; they get launch defaults.
 */
export function migrateLeague(league: LeagueStore): LeagueStore {
  return {
    ...league,
    teams: (league.teams as StoredTeamAnyVersion[]).map((t) => ({
      ...t,
      budget: t.budget ?? BASE_SEASON_BUDGET,
      hype: t.hype ?? HYPE_INITIAL,
      scoutingSpend: t.scoutingSpend ?? SCOUTING_SPEND_MIN,
    })),
  };
}
