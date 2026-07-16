import type { LeagueStore } from "../core/leagueState.js";
import { CLUBS, type StoredTeam } from "../core/teams/clubs.js";
import type { Player, SeasonStats } from "../core/players/types.js";
import type { PlayerMatchLine } from "../engine/attribution.js";
import type { TeamSeasonStats } from "../core/standings.js";
import { computeSeasonAwards, type SeasonAwards } from "../core/awards.js";
import { FORMATIONS } from "../core/lineup/formations.js";
import {
  HYPE_INITIAL, SCOUTING_SPEND_DEFAULT,
  NUM_TEAMS,
} from "../core/constants.js";
import { chargeSeasonStart, wageBill } from "../core/finance/budget.js";

/** A team as it may exist in a save written before M6 added the finance fields, or before the second division. */
type StoredTeamAnyVersion =
  Omit<StoredTeam, "budget" | "hype" | "scoutingSpend" | "academyBase" | "starters" | "academyRoster" | "division" | "divisionConvergence"> &
  Partial<Pick<StoredTeam, "budget" | "hype" | "scoutingSpend" | "academyBase" | "starters" | "academyRoster" | "division" | "divisionConvergence">>;

/**
 * Generation constants frozen at the values active when academyBase was
 * introduced as a field (the M6-era finance work) — NOT live imports from
 * constants.js. A save missing academyBase predates that field entirely, so
 * it was generated under whatever LEAGUE_BASE/TEAM_STRENGTH_SPREAD were in
 * effect at *that* time, not whatever they happen to be today. Importing the
 * live constants here meant every later generation retune (there have
 * already been two: 2026-07-10 and 2026-07-14) silently reshuffled old
 * saves' reconstructed academyBase out from under them on load, breaking the
 * "academyBase is fixed at generation, never touched again" invariant the M4
 * progression-inflation fix depends on. Pinning these avoids that for every
 * future retune; it's still only an approximation for saves old enough to
 * predate the 2026-07-10 rebalance too, which is a pre-existing, unavoidable
 * limitation (no generation-time version marker was ever stored).
 */
const FALLBACK_LEAGUE_BASE = 46;
const FALLBACK_TEAM_STRENGTH_SPREAD = 7;

/**
 * Reconstruct the generation-time strength target for a save written before
 * academyBase existed, using the same evenly-spaced formula generateLeague
 * uses (tid ordering encodes strength: strongest at tid 0).
 */
function fallbackAcademyBase(tid: number): number {
  const frac = tid / (NUM_TEAMS - 1);
  const target = FALLBACK_TEAM_STRENGTH_SPREAD - frac * (2 * FALLBACK_TEAM_STRENGTH_SPREAD);
  return FALLBACK_LEAGUE_BASE + target;
}

/** A league as it may exist in a save written before M6 added the transfer market. */
type LeagueStoreAnyVersion =
  Omit<LeagueStore, "negotiations" | "inboundOffers" | "transfers" | "winterMarketRunSeason" | "seasonHistory" | "newsEvents"> &
  Partial<Pick<LeagueStore, "negotiations" | "inboundOffers" | "transfers" | "winterMarketRunSeason" | "seasonHistory" | "newsEvents">>;

/** A season-stats entry as it may exist in a save written before Match Rating / xG / xGA. */
type SeasonStatsAnyVersion =
  Omit<SeasonStats, "minutesPlayed" | "ratingSum" | "avgRating" | "interceptions" | "xg" | "goalsAgainst" | "xga"> &
  Partial<Pick<SeasonStats, "minutesPlayed" | "ratingSum" | "avgRating" | "interceptions" | "xg" | "goalsAgainst" | "xga">>;

/** A team-season-stats row as it may exist in a save written before xG / xGA. */
type TeamSeasonStatsAnyVersion = Omit<TeamSeasonStats, "xg" | "goalsAgainst" | "xga"> &
  Partial<Pick<TeamSeasonStats, "xg" | "goalsAgainst" | "xga">>;

/** A season-history entry as it may exist in a save written before Team Stat Leaders history / xG / awards / the second division. */
type SeasonHistoryEntryAnyVersion =
  Omit<LeagueStore["seasonHistory"][number], "teamStats" | "awards" | "divisionsByTid"> &
  Partial<{
    teamStats: TeamSeasonStatsAnyVersion[];
    awards: SeasonAwards | [SeasonAwards, SeasonAwards];
    divisionsByTid: Record<number, 0 | 1>;
  }>;

/** A box-score line as it may exist in a save written before Match Rating / xG / xGA. */
type PlayerMatchLineAnyVersion =
  Omit<PlayerMatchLine, "minutesPlayed" | "rating" | "interceptions" | "xg" | "goalsAgainst" | "xga"> &
  Partial<Pick<PlayerMatchLine, "minutesPlayed" | "rating" | "interceptions" | "xg" | "goalsAgainst" | "xga">>;

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
    xg: line.xg ?? 0,
    goalsAgainst: line.goalsAgainst ?? 0,
    xga: line.xga ?? 0,
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
      xg: s.xg ?? 0,
      goalsAgainst: s.goalsAgainst ?? 0,
      xga: s.xga ?? 0,
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
  const migratedPlayers = league.players.map(migratePlayer);
  return {
    ...league,
    teams: (league.teams as StoredTeamAnyVersion[]).map((t) => ({
      ...t,
      name: t.name ?? CLUBS[t.tid]?.name,
      abbrev: t.abbrev ?? CLUBS[t.tid]?.abbrev,
      colors: t.colors ?? CLUBS[t.tid]?.colors,
      budget: t.budget ?? chargeSeasonStart(0, wageBill(t.roster, salaryMap), t.division ?? 0),
      hype: t.hype ?? HYPE_INITIAL,
      scoutingSpend: t.scoutingSpend ?? SCOUTING_SPEND_DEFAULT,
      academyBase: t.academyBase ?? fallbackAcademyBase(t.tid),
      starters: t.starters ?? null,
      academyRoster: t.academyRoster ?? [],
      division: t.division ?? 0,
      divisionConvergence: t.divisionConvergence ?? null,
    })),
    players: migratedPlayers,
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
    seasonHistory: ((anyVersion.seasonHistory ?? []) as SeasonHistoryEntryAnyVersion[]).map((h) => {
      // Pre-second-division saves were always single-division: every team
      // that season was Division 1.
      const divisionsByTid: Record<number, 0 | 1> = h.divisionsByTid
        ?? Object.fromEntries(league.teams.map((t) => [t.tid, 0 as const]));
      const emptyAwards: SeasonAwards = {
        playerOfSeasonPid: null,
        goldenBootPid: null,
        teamOfSeason: FORMATIONS["4-3-3"].map(() => null),
      };
      // Player.stats is append-only and never pruned, so unlike teamStats
      // above, past seasons' awards CAN be reconstructed after the fact. A
      // pre-second-division save's single-object awards become Division 1's
      // half of the tuple; Division 2 never existed for that season, so it
      // gets an empty (no-eligible-player) placeholder rather than a guess.
      const legacyOrMissingAwards = h.awards;
      const awards: [SeasonAwards, SeasonAwards] = Array.isArray(legacyOrMissingAwards)
        ? legacyOrMissingAwards
        : [legacyOrMissingAwards ?? computeSeasonAwards(migratedPlayers, h.season), emptyAwards];
      return {
        ...h,
        teamStats: (h.teamStats ?? []).map((t) => ({
          ...t, xg: t.xg ?? 0, goalsAgainst: t.goalsAgainst ?? 0, xga: t.xga ?? 0,
        })),
        awards,
        divisionsByTid,
      };
    }),
    newsEvents: anyVersion.newsEvents ?? [],
  };
}
