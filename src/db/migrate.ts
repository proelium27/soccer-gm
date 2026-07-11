import type { LeagueStore } from "../core/leagueState.js";
import { CLUBS, type StoredTeam } from "../core/teams/clubs.js";
import { BASE_SEASON_BUDGET, HYPE_INITIAL, SCOUTING_SPEND_MIN } from "../core/constants.js";

/** A team as it may exist in a save written before M6 added the finance fields. */
type StoredTeamAnyVersion = Omit<StoredTeam, "budget" | "hype" | "scoutingSpend"> &
  Partial<Pick<StoredTeam, "budget" | "hype" | "scoutingSpend">>;

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
 *
 * Club identities (name/abbrev/colors) are static and keyed by tid, so they
 * are re-stamped from CLUBS on every load — saves written before the switch
 * to real Premier League clubs pick up the new identities automatically.
 */
export function migrateLeague(league: LeagueStore): LeagueStore {
  const anyVersion = league as LeagueStoreAnyVersion;
  return {
    ...league,
    teams: (league.teams as StoredTeamAnyVersion[]).map((t) => ({
      ...t,
      name: CLUBS[t.tid]?.name ?? t.name,
      abbrev: CLUBS[t.tid]?.abbrev ?? t.abbrev,
      colors: CLUBS[t.tid]?.colors ?? t.colors,
      budget: t.budget ?? BASE_SEASON_BUDGET,
      hype: t.hype ?? HYPE_INITIAL,
      scoutingSpend: t.scoutingSpend ?? SCOUTING_SPEND_MIN,
    })),
    negotiations: anyVersion.negotiations ?? [],
    transfers: anyVersion.transfers ?? [],
  };
}
