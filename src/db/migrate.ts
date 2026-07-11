import type { LeagueStore } from "../core/leagueState.js";
import type { StoredTeam } from "../core/teams/clubs.js";
import {
  BASE_SEASON_BUDGET, HYPE_INITIAL, SCOUTING_SPEND_MIN,
  LEAGUE_BASE, TEAM_STRENGTH_SPREAD, NUM_TEAMS,
} from "../core/constants.js";

/** A team as it may exist in a save written before M6 added the finance fields. */
type StoredTeamAnyVersion = Omit<StoredTeam, "budget" | "hype" | "scoutingSpend" | "academyBase" | "starters"> &
  Partial<Pick<StoredTeam, "budget" | "hype" | "scoutingSpend" | "academyBase" | "starters">>;

/**
 * Reconstruct the generation-time strength target for a save written before
 * academyBase existed, using the same evenly-spaced formula generateLeague
 * uses (tid ordering encodes strength: strongest at tid 0).
 */
function fallbackAcademyBase(tid: number): number {
  const frac = tid / (NUM_TEAMS - 1);
  const target = TEAM_STRENGTH_SPREAD - frac * (2 * TEAM_STRENGTH_SPREAD);
  return LEAGUE_BASE + target;
}

/** A league as it may exist in a save written before M6 added the transfer market. */
type LeagueStoreAnyVersion = Omit<LeagueStore, "negotiations" | "transfers"> &
  Partial<Pick<LeagueStore, "negotiations" | "transfers">>;

/**
 * Backfill fields added to the schema since a league was saved. Every league
 * coming out of IndexedDB or a JSON import passes through here, so the rest
 * of the app can rely on the LeagueStore type telling the truth.
 *
 * Pre-M6 saves lack the finance fields on teams and the transfer-market
 * lists on the league; they get launch defaults.
 */
export function migrateLeague(league: LeagueStore): LeagueStore {
  const anyVersion = league as LeagueStoreAnyVersion;
  return {
    ...league,
    teams: (league.teams as StoredTeamAnyVersion[]).map((t) => ({
      ...t,
      budget: t.budget ?? BASE_SEASON_BUDGET,
      hype: t.hype ?? HYPE_INITIAL,
      scoutingSpend: t.scoutingSpend ?? SCOUTING_SPEND_MIN,
      academyBase: t.academyBase ?? fallbackAcademyBase(t.tid),
      starters: t.starters ?? null,
    })),
    negotiations: anyVersion.negotiations ?? [],
    transfers: anyVersion.transfers ?? [],
  };
}
