import type { LeagueStore } from "../core/leagueState.js";
import { CLUBS, type StoredTeam } from "../core/teams/clubs.js";
import type { Player, SeasonStats, RatingsSnapshot } from "../core/players/types.js";
import type { PlayerMatchLine } from "../engine/attribution.js";
import type { TeamSeasonStats } from "../core/standings.js";
import { computeSeasonAwards, type SeasonAwards } from "../core/awards.js";
import {
  HYPE_INITIAL, SCOUTING_SPEND_DEFAULT,
  NUM_TEAMS,
} from "../core/constants.js";
import { chargeSeasonStart, wageBill, financeScale } from "../core/finance/budget.js";
import { englandCompetitions } from "../core/competitions.js";

/**
 * A team as it may exist in a save written before M6 added the finance
 * fields, or before the second division / competitions refactor: `compId`
 * didn't exist yet, only the old `division: 0 | 1` field.
 */
type StoredTeamAnyVersion =
  Omit<StoredTeam, "budget" | "hype" | "scoutingSpend" | "nextScoutingSpend" | "academyBase" | "starters" | "formation" | "academyRoster" | "compId" | "divisionConvergence" | "transferListed" | "moreMinutes" | "scoutingObserved"> &
  Partial<Pick<StoredTeam, "budget" | "hype" | "scoutingSpend" | "nextScoutingSpend" | "academyBase" | "starters" | "formation" | "academyRoster" | "compId" | "divisionConvergence" | "transferListed" | "moreMinutes" | "scoutingObserved">> &
  { division?: 0 | 1 };

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

/** A league as it may exist in a save written before M6 added the transfer market, or before the competitions refactor. */
type LeagueStoreAnyVersion =
  Omit<LeagueStore, "negotiations" | "inboundOffers" | "transfers" | "winterMarketRunSeason" | "seasonHistory" | "newsEvents" | "competitions" | "activeLoans" | "loanListings" | "loanRejections" | "cup" | "cupHistory" | "powerRankingHistory" | "godMode" | "international"> &
  Partial<Pick<LeagueStore, "negotiations" | "inboundOffers" | "transfers" | "winterMarketRunSeason" | "seasonHistory" | "newsEvents" | "competitions" | "activeLoans" | "loanListings" | "loanRejections" | "cup" | "cupHistory" | "powerRankingHistory" | "godMode" | "international">>;

/** A season-stats entry as it may exist in a save written before Match Rating / xG / xGA / per-season team tracking. */
type SeasonStatsAnyVersion =
  Omit<SeasonStats, "minutesPlayed" | "ratingSum" | "avgRating" | "interceptions" | "xg" | "goalsAgainst" | "xga" | "tid" | "passes" | "passesCompleted" | "crosses" | "foulsCommitted"> &
  Partial<Pick<SeasonStats, "minutesPlayed" | "ratingSum" | "avgRating" | "interceptions" | "xg" | "goalsAgainst" | "xga" | "tid" | "passes" | "passesCompleted" | "crosses" | "foulsCommitted">>;

/** A team-season-stats row as it may exist in a save written before xG / xGA. */
type TeamSeasonStatsAnyVersion = Omit<TeamSeasonStats, "xg" | "goalsAgainst" | "xga"> &
  Partial<Pick<TeamSeasonStats, "xg" | "goalsAgainst" | "xga">>;

/**
 * A season-history entry as it may exist in a save written before Team Stat
 * Leaders history / xG / awards / the second division / the competitions
 * refactor. `awards` has gone through three shapes over time: a single
 * SeasonAwards (pre-second-division), a [D1, D2] tuple (second division),
 * and a Record<compId, SeasonAwards> (post-competitions-refactor).
 */
type SeasonHistoryEntryAnyVersion =
  Omit<LeagueStore["seasonHistory"][number], "teamStats" | "awards" | "compsByTid" | "championTidByCompId"> &
  Partial<{
    teamStats: TeamSeasonStatsAnyVersion[];
    awards: SeasonAwards | [SeasonAwards, SeasonAwards] | Record<number, SeasonAwards>;
    compsByTid: Record<number, number>;
    divisionsByTid: Record<number, 0 | 1>;
    championTidByCompId: Record<number, number>;
    championTid: number;
  }>;

/** A box-score line as it may exist in a save written before Match Rating / xG / xGA. */
type PlayerMatchLineAnyVersion =
  Omit<PlayerMatchLine, "minutesPlayed" | "rating" | "interceptions" | "xg" | "goalsAgainst" | "xga" | "passes" | "passesCompleted" | "crosses" | "foulsCommitted"> &
  Partial<Pick<PlayerMatchLine, "minutesPlayed" | "rating" | "interceptions" | "xg" | "goalsAgainst" | "xga" | "passes" | "passesCompleted" | "crosses" | "foulsCommitted">>;

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
    passes: line.passes ?? 0,
    passesCompleted: line.passesCompleted ?? 0,
    crosses: line.crosses ?? 0,
    foulsCommitted: line.foulsCommitted ?? 0,
  };
}

/**
 * `fallbackTid` is the player's *current* club — the best guess available for
 * a save old enough to predate per-season team tracking, since no historical
 * roster-membership data survives to reconstruct which club he was actually
 * on in a past season (same irreconstructable-history situation as the
 * minutes/rating defaults below).
 */
function migratePlayer(p: Player, fallbackTid: number): Player {
  return {
    ...p,
    stats: (p.stats as SeasonStatsAnyVersion[]).map((s) => ({
      ...s,
      tid: s.tid ?? fallbackTid,
      minutesPlayed: s.minutesPlayed ?? 0,
      ratingSum: s.ratingSum ?? 0,
      avgRating: s.avgRating ?? 0,
      interceptions: s.interceptions ?? 0,
      xg: s.xg ?? 0,
      goalsAgainst: s.goalsAgainst ?? 0,
      xga: s.xga ?? 0,
      passes: s.passes ?? 0,
      passesCompleted: s.passesCompleted ?? 0,
      crosses: s.crosses ?? 0,
      foulsCommitted: s.foulsCommitted ?? 0,
    })),
    // Pre-academy-tracking saves have no per-season academy flag on their
    // rating snapshots; there's no way to reconstruct which past seasons a
    // player spent in the academy, so they default to senior (false) and only
    // future seasons record the real value.
    hist: (p.hist as (RatingsSnapshot & { academy?: boolean })[]).map((h) => ({
      ...h,
      academy: h.academy ?? false,
    })),
    // faSignedSeason (the free-agent transfer hold) is intentionally left
    // absent on pre-feature saves: there's no way to know which past free-agent
    // signings would still be inside their hold, and "absent" is the correct
    // default — it means "not held," so nobody is retroactively locked. Only
    // free agents signed after this feature shipped carry the field.
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
  // Pre-competitions-refactor saves have no competitions table at all — they
  // were always England-only, so the 2-entry table backfills mechanically
  // (their legacy `division` values 0/1 are already valid compIds).
  const competitions = anyVersion.competitions ?? englandCompetitions();
  // Pre-M6 backfill only: seed the budget the way a season start would —
  // base allocation in, the save's current wage bill out.
  const salaryMap = new Map(league.players.map((p) => [p.pid, p.contract.salary]));
  const tidByPid = new Map<number, number>();
  for (const t of league.teams) {
    for (const pid of t.roster) tidByPid.set(pid, t.tid);
    for (const pid of t.academyRoster ?? []) tidByPid.set(pid, t.tid);
  }
  const migratedPlayers = league.players.map((p) => migratePlayer(p, tidByPid.get(p.pid) ?? -1));
  return {
    ...league,
    competitions,
    teams: (league.teams as StoredTeamAnyVersion[]).map((t) => {
      const compId = t.compId ?? t.division ?? 0;
      return {
        ...t,
        name: t.name ?? CLUBS[t.tid]?.name,
        abbrev: t.abbrev ?? CLUBS[t.tid]?.abbrev,
        colors: t.colors ?? CLUBS[t.tid]?.colors,
        budget: t.budget ?? chargeSeasonStart(0, wageBill(t.roster, salaryMap), financeScale(competitions, compId), t.hype ?? HYPE_INITIAL),
        hype: t.hype ?? HYPE_INITIAL,
        scoutingSpend: t.scoutingSpend ?? SCOUTING_SPEND_DEFAULT,
        // nextScoutingSpend (added with the season-lock, 2026-07-18): old saves
        // seed it from the current spend, so nothing changes until the user
        // adjusts it in an offseason window.
        nextScoutingSpend: t.nextScoutingSpend ?? t.scoutingSpend ?? SCOUTING_SPEND_DEFAULT,
        academyBase: t.academyBase ?? fallbackAcademyBase(t.tid),
        starters: t.starters ?? null,
        // Formation (added 2026-07-19). Old saves default to 4-3-3, the shape
        // every team fielded before formations were selectable.
        formation: t.formation ?? "4-3-3",
        academyRoster: t.academyRoster ?? [],
        compId,
        divisionConvergence: t.divisionConvergence ?? null,
        transferListed: t.transferListed ?? [],
        // "Give more minutes" flags (added 2026-07-22). Old saves start with none
        // flagged — subs behave exactly as before until the user flags someone.
        moreMinutes: t.moreMinutes ?? [],
        // Fog-of-war observation map (added 2026-07-18). Old saves get an
        // empty map: the user's existing senior roster reads as tenure 0
        // (fully fogged) and then clears over the next few seasons as the
        // offseason reconcile stamps first-observed seasons — same as a
        // fresh save's initial squad, an accepted one-time re-fog on load.
        scoutingObserved: t.scoutingObserved ?? {},
      };
    }),
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
      // that season was Division 1 (compId 0). Post-second-division,
      // pre-competitions-refactor saves already have the right shape under
      // the old field name.
      const compsByTid: Record<number, number> = h.compsByTid
        ?? h.divisionsByTid
        ?? Object.fromEntries(league.teams.map((t) => [t.tid, 0]));
      // Player.stats is append-only and never pruned, so unlike teamStats
      // above, past seasons' awards CAN be reconstructed after the fact.
      // Detect which of the three historical shapes this entry has: a
      // Record already (post-refactor, nothing to do), a [D1, D2] tuple
      // (second-division era), or a single SeasonAwards object
      // (pre-second-division, single competition), or missing entirely.
      const rawAwards = h.awards;
      const awards: Record<number, SeasonAwards> = Array.isArray(rawAwards)
        ? { 0: rawAwards[0], 1: rawAwards[1] }
        : rawAwards && "playerOfSeasonPid" in rawAwards
          ? { 0: rawAwards }
          : rawAwards
            ? rawAwards
            : { 0: computeSeasonAwards(migratedPlayers, h.season) };
      const championTidByCompId: Record<number, number> = h.championTidByCompId
        ?? (h.championTid !== undefined ? { 0: h.championTid } : { 0: h.table[0]?.tid ?? 0 });
      return {
        ...h,
        teamStats: (h.teamStats ?? []).map((t) => ({
          ...t, xg: t.xg ?? 0, goalsAgainst: t.goalsAgainst ?? 0, xga: t.xga ?? 0,
        })),
        awards,
        compsByTid,
        championTidByCompId,
      };
    }),
    newsEvents: anyVersion.newsEvents ?? [],
    activeLoans: anyVersion.activeLoans ?? [],
    loanListings: anyVersion.loanListings ?? [],
    loanRejections: anyVersion.loanRejections ?? [],
    // Pre-cup saves have no Continental Cup; they start with none and get one
    // seeded at their next offseason from that season's final tables (so an
    // existing save picks the cup up from the following season onward). Backfill
    // the optional stage fields so old cups typecheck and their format is read
    // correctly: a cup with no `leaguePhase` is a legacy straight bracket (its
    // retained code finishes it), and `playIn`/`playoff` default to null. An
    // in-progress legacy cup keeps finishing under the old format; the next
    // offseason builds a Swiss cup.
    // `twoLegged` defaults false so any cup already in progress finishes under
    // the old single-leg knockout rules; the next offseason builds a two-legged
    // one. (Archived cups in cupHistory are done, so the flag is cosmetic there.)
    cup: anyVersion.cup
      ? { ...anyVersion.cup, leaguePhase: anyVersion.cup.leaguePhase ?? null, playoff: anyVersion.cup.playoff ?? null, playIn: anyVersion.cup.playIn ?? null, twoLegged: anyVersion.cup.twoLegged ?? false, koLegs: anyVersion.cup.koLegs ?? null }
      : null,
    cupHistory: (anyVersion.cupHistory ?? []).map((c) => ({
      ...c, leaguePhase: c.leaguePhase ?? null, playoff: c.playoff ?? null, playIn: c.playIn ?? null, twoLegged: c.twoLegged ?? false, koLegs: c.koLegs ?? null,
    })),
    // Pre-feature saves start with no power-rankings history; snapshots can't
    // be reconstructed retroactively (past rosters/matches are gone), so they
    // simply accrue from the next simmed matchdays onward.
    powerRankingHistory: anyVersion.powerRankingHistory ?? [],
    // Pre-feature saves have no international football. They start with an
    // empty state and join the two-year cycle at their next *odd* season's
    // offseason (an even one has no qualifying campaign on file to play a
    // tournament from), so at worst a save waits one extra season for its
    // first World Cup. Saves from before staged play get `stage: null` (no
    // campaign pending), so their next offseason draws and stages one fresh.
    // See core/international.
    international: anyVersion.international
      ? {
          ...anyVersion.international,
          stage: anyVersion.international.stage ?? null,
          // Light archival added later: past qualifying + power-ranking history
          // start empty and fill from the next campaign on; old tournament
          // summaries predate stored group tables / knockout scorelines, so
          // backfill those to empty (their champion/field still render).
          qualifyingHistory: anyVersion.international.qualifyingHistory ?? [],
          powerRankings: anyVersion.international.powerRankings ?? [],
          history: (anyVersion.international.history ?? []).map((h) => ({
            ...h,
            groups: h.groups ?? [],
            knockout: h.knockout ?? [],
          })),
        }
      : {
          qualifying: null, tournament: null, history: [],
          qualifyingHistory: [], powerRankings: [], stage: null,
        },
    // God Mode sandbox editing defaults off for any save that predates it.
    godMode: anyVersion.godMode ?? false,
  };
}
