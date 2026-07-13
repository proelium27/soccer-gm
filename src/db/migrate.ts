import type { LeagueStore } from "../core/leagueState.js";
import { CLUBS, type StoredTeam } from "../core/teams/clubs.js";
import type { Player, SeasonStats } from "../core/players/types.js";
import type { PlayerMatchLine } from "../engine/attribution.js";
import {
  HYPE_INITIAL, SCOUTING_SPEND_MIN,
  LEAGUE_BASE, TEAM_STRENGTH_SPREAD, NUM_TEAMS,
} from "../core/constants.js";
import { chargeSeasonStart, wageBill } from "../core/finance/budget.js";

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
type LeagueStoreAnyVersion =
  Omit<LeagueStore, "negotiations" | "inboundOffers" | "transfers" | "winterMarketRunSeason" | "seasonHistory"> &
  Partial<Pick<LeagueStore, "negotiations" | "inboundOffers" | "transfers" | "winterMarketRunSeason" | "seasonHistory">>;

/** A season-stats entry as it may exist in a save written before Match Rating. */
type SeasonStatsAnyVersion = Omit<SeasonStats, "minutesPlayed" | "ratingSum" | "avgRating" | "interceptions"> &
  Partial<Pick<SeasonStats, "minutesPlayed" | "ratingSum" | "avgRating" | "interceptions">>;

/** A season-history entry as it may exist in a save written before Team Stat Leaders history. */
type SeasonHistoryEntryAnyVersion = Omit<LeagueStore["seasonHistory"][number], "teamStats"> &
  Partial<Pick<LeagueStore["seasonHistory"][number], "teamStats">>;

/** A box-score line as it may exist in a save written before Match Rating. */
type PlayerMatchLineAnyVersion = Omit<PlayerMatchLine, "minutesPlayed" | "rating" | "interceptions"> &
  Partial<Pick<PlayerMatchLine, "minutesPlayed" | "rating" | "interceptions">>;

/** A played match as it may exist in a save written before M3 added box scores. */
type PlayedMatchAnyVersion = {
  boxScore?: {
    home: PlayerMatchLineAnyVersion[];
    away: PlayerMatchLineAnyVersion[];
    events?: PlayedMatch["boxScore"]["events"];
  };
};

type PlayedMatch = LeagueStore["played"][number];

function migrateLine(line: PlayerMatchLineAnyVersion): PlayerMatchLine {
  return {
    ...line,
    minutesPlayed: line.minutesPlayed ?? 0,
    rating: line.rating ?? 6.0,
    interceptions: line.interceptions ?? 0,
  };
}

function migratePlayer(p: Player): Player {
  return {
    ...p,
    stats: (p.stats as SeasonStatsAnyVersion[]).map((s) => ({
      ...s,
      minutesPlayed: s.minutesPlayed ?? 0,
      ratingSum: s.ratingSum ?? 0,
      avgRating: s.avgRating ?? 0,
      interceptions: s.interceptions ?? 0,
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
 *
 * Club identities (name/abbrev/colors) are user-customizable per save, so
 * they are only backfilled from CLUBS when a stored team lacks them — never
 * re-stamped, or a rename made in the Customize Teams editor (or a save from
 * the real-club-names era) would be silently reverted on the next load.
 */
export function migrateLeague(league: LeagueStore): LeagueStore {
  const anyVersion = league as LeagueStoreAnyVersion;
  // Pre-M6 backfill only: seed the budget the way a season start would —
  // base allocation in, the save's current wage bill out.
  const salaryMap = new Map(league.players.map((p) => [p.pid, p.contract.salary]));
  return {
    ...league,
    teams: (league.teams as StoredTeamAnyVersion[]).map((t) => ({
      ...t,
      name: t.name ?? CLUBS[t.tid]?.name,
      abbrev: t.abbrev ?? CLUBS[t.tid]?.abbrev,
      colors: t.colors ?? CLUBS[t.tid]?.colors,
      budget: t.budget ?? chargeSeasonStart(0, wageBill(t.roster, salaryMap)),
      hype: t.hype ?? HYPE_INITIAL,
      scoutingSpend: t.scoutingSpend ?? SCOUTING_SPEND_MIN,
      academyBase: t.academyBase ?? fallbackAcademyBase(t.tid),
      starters: t.starters ?? null,
    })),
    players: league.players.map(migratePlayer),
    played: league.played.map((m) => {
      const boxScore = (m as PlayedMatchAnyVersion).boxScore;
      return {
        ...m,
        // Pre-M3 saves have played matches with no boxScore at all; an empty
        // one degrades to "No events recorded" instead of failing to load.
        boxScore: boxScore
          ? {
              events: boxScore.events ?? [],
              home: boxScore.home.map(migrateLine),
              away: boxScore.away.map(migrateLine),
            }
          : { home: [], away: [], events: [] },
      };
    }),
    negotiations: anyVersion.negotiations ?? [],
    inboundOffers: anyVersion.inboundOffers ?? [],
    transfers: anyVersion.transfers ?? [],
    winterMarketRunSeason: anyVersion.winterMarketRunSeason ?? null,
    // Older saves have no record of past seasons' final tables; they simply
    // start accumulating history from this point forward. Saves from before
    // Team Stat Leaders history has team totals per completed season either:
    // their per-match box scores were already cleared at that rollover, so
    // there's nothing to backfill from — those seasons just show no team
    // stats rather than reconstructing false zeros.
    seasonHistory: ((anyVersion.seasonHistory ?? []) as SeasonHistoryEntryAnyVersion[]).map((h) => ({
      ...h,
      teamStats: h.teamStats ?? [],
    })),
  };
}
