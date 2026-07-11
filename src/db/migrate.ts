import type { LeagueStore } from "../core/leagueState.js";
import type { StoredTeam } from "../core/teams/clubs.js";
import type { Player, SeasonStats } from "../core/players/types.js";
import type { PlayerMatchLine } from "../engine/attribution.js";
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

/** A season-stats entry as it may exist in a save written before Match Rating. */
type SeasonStatsAnyVersion = Omit<SeasonStats, "minutesPlayed" | "ratingSum" | "avgRating"> &
  Partial<Pick<SeasonStats, "minutesPlayed" | "ratingSum" | "avgRating">>;

/** A box-score line as it may exist in a save written before Match Rating. */
type PlayerMatchLineAnyVersion = Omit<PlayerMatchLine, "minutesPlayed" | "rating"> &
  Partial<Pick<PlayerMatchLine, "minutesPlayed" | "rating">>;

function migrateLine(line: PlayerMatchLineAnyVersion): PlayerMatchLine {
  return { ...line, minutesPlayed: line.minutesPlayed ?? 0, rating: line.rating ?? 6.0 };
}

function migratePlayer(p: Player): Player {
  return {
    ...p,
    stats: (p.stats as SeasonStatsAnyVersion[]).map((s) => ({
      ...s,
      minutesPlayed: s.minutesPlayed ?? 0,
      ratingSum: s.ratingSum ?? 0,
      avgRating: s.avgRating ?? 0,
    })),
  };
}

/**
 * Backfill fields added to the schema since a league was saved. Every league
 * coming out of IndexedDB or a JSON import passes through here, so the rest
 * of the app can rely on the LeagueStore type telling the truth.
 *
 * Pre-M6 saves lack the finance fields on teams and the transfer-market
 * lists on the league; they get launch defaults. Pre-Match-Rating saves lack
 * minutes/rating on season stats and historical box scores — those can't be
 * reconstructed after the fact (no clock data survives), so they default to
 * 0 minutes / a neutral 6.0 rating rather than being left undefined.
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
    players: league.players.map(migratePlayer),
    played: league.played.map((m) => ({
      ...m,
      boxScore: {
        ...m.boxScore,
        home: (m.boxScore.home as PlayerMatchLineAnyVersion[]).map(migrateLine),
        away: (m.boxScore.away as PlayerMatchLineAnyVersion[]).map(migrateLine),
      },
    })),
    negotiations: anyVersion.negotiations ?? [],
    transfers: anyVersion.transfers ?? [],
  };
}
