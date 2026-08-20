import type { Player } from "./players/types.js";
import type { PlayedMatch, SeasonHistoryEntry } from "./standings.js";
import type { StoredTeam } from "./teams/clubs.js";
import type { ScheduleGame } from "./schedule.js";
import type { CompletedTransfer, TransferNegotiation } from "./transfers/negotiation.js";
import type { InboundOffer } from "./transfers/inboundOffers.js";
import type { NewsEvent } from "./newsEvents.js";
import type { ArchivedPlayer } from "./players/archive.js";
import type { PowerRankingSnapshot } from "./teams/powerRanking.js";
import type { ActiveLoan, LoanListing, LoanRejection } from "./loans.js";
import type { Competition } from "./competitions.js";
import type { CupState } from "./cup/types.js";
import type { DomesticCupState } from "./domesticCup/types.js";
import { buildDomesticCups } from "./domesticCup/cup.js";
import type { InternationalState } from "./international/types.js";
import { emptyInternationalState } from "./international/index.js";
import { generateWorld } from "./league/generate.js";
import { assignIdentities, assignAIFormations } from "./teams/clubs.js";
import { generateSchedule } from "./schedule.js";
import { worldCompetitions } from "./competitions.js";
import { reconcileScoutingObserved } from "./scouting/potentialFog.js";
import { DEFAULT_DIFFICULTY, type Difficulty } from "./constants.js";

export type { StoredTeam } from "./teams/clubs.js";
export type { ScheduleGame } from "./schedule.js";

/** One competition's worth of fixtures per competition, concatenated — shared by createLeagueState and any test/tooling code that assembles a LeagueStore from a League + competitions table by hand. */
export function buildCompetitionSchedule(
  teams: Pick<StoredTeam, "tid" | "compId">[],
  competitions: Competition[],
): ScheduleGame[] {
  return competitions.flatMap((comp) =>
    generateSchedule(teams.filter((t) => t.compId === comp.id).map((t) => t.tid)),
  );
}

export interface LeagueStore {
  lid: number;
  meta: {
    name: string;
    created: number;
    userTid: number;
  };
  /** The leagues in this save's world, one entry per division per country (see competitions.ts). */
  competitions: Competition[];
  teams: StoredTeam[];
  players: Player[];
  season: number;
  phase: "regular" | "offseason";
  schedule: ScheduleGame[];
  played: PlayedMatch[];
  /** User↔club transfer talks for the current window (pruned when a new window's talks start). */
  negotiations: TransferNegotiation[];
  /** AI clubs' offers for the user's own players, current window (see transfers/inboundOffers.ts). */
  inboundOffers: InboundOffer[];
  /** Completed transfers, all seasons (newest last). */
  transfers: CompletedTransfer[];
  /**
   * The season whose winter AI transfer market has already run, so it fires
   * exactly once per season no matter how the user batches matchdays. null =
   * hasn't run this season (reset every offseason rollover). The summer
   * market runs inside simOffseason and needs no such flag.
   */
  winterMarketRunSeason: number | null;
  /** Final league table for every completed season, oldest first. */
  seasonHistory: SeasonHistoryEntry[];
  /** Player accomplishments (hat-tricks, standout ratings, goal milestones), all seasons, oldest first. */
  newsEvents: NewsEvent[];
  /**
   * Permanent career records for retirees good enough to stay on the all-time
   * lists (`/frivolities`). Retirement deletes the player from `players`
   * outright, so without this a legend vanishes the season he hangs up.
   *
   * Quality-gated and hard-capped — see players/archive.ts and the
   * `RETIREE_ARCHIVE_*` block in constants.ts — because a 240-club world retires
   * hundreds of players every offseason and an ungated list is exactly the bug
   * that produced the 88 MB save. Old saves backfill to empty and fill from
   * their next offseason on: the players already deleted left no trace to
   * reconstruct.
   */
  retiredPlayers: ArchivedPlayer[];
  /**
   * Power-rankings snapshots taken at fixed points during every season (every
   * POWER_SNAPSHOT_INTERVAL matchdays plus the finale — see simThrough),
   * oldest first. Persisted because past rankings can't be recomputed: rosters
   * change mid-season and `played` is wiped at every offseason rollover.
   */
  powerRankingHistory: PowerRankingSnapshot[];
  /** Loans currently in effect (parent club still owns the contract, loanee club fields him and pays wages). */
  activeLoans: ActiveLoan[];
  /** The user's own senior-roster players listed for an outgoing loan, awaiting an AI club's offer. */
  loanListings: LoanListing[];
  /** Incoming loan offers the user has turned down this window (see loans.ts's loanOfferCandidates). */
  loanRejections: LoanRejection[];
  /**
   * The Continental Cup being played during the current season, or null when
   * none runs (season 1 always — no prior-season table to qualify from — and
   * any world that can't field a full 16-team bracket). Seeded each offseason
   * from the just-finished tier-1 tables; see core/cup.
   */
  cup: CupState | null;
  /** Every completed Continental Cup, oldest first (archived at offseason rollover). */
  cupHistory: CupState[];
  /**
   * The Continental Shield being played during the current season, or null when
   * none runs (season 1, a world too small to field one, or a save from before
   * the Shield existed — those pick one up at their next offseason).
   *
   * Held as its own field rather than folded into a list of cups: `cup` has
   * some thirty readers across the sim and the UI, and a list would turn every
   * one of them into a lookup. The two share everything structural — see
   * CUP_FORMATS for the handful of numbers that differ.
   */
  shield: CupState | null;
  /** Every completed Continental Shield, oldest first (archived at offseason rollover). */
  shieldHistory: CupState[];
  /**
   * This season's domestic cups, one per country — a straight knockout across
   * both of a country's divisions, drawn open round by round. Unlike the
   * Continental Cup these run from season 1 (nothing has to qualify), so the
   * list is only empty on a world too small to field one. See core/domesticCup.
   */
  domesticCups: DomesticCupState[];
  /** Every completed domestic cup, oldest first (archived at offseason rollover). */
  domesticCupHistory: DomesticCupState[];
  /**
   * National-team football, played entirely inside the offseason on a two-year
   * cycle (odd seasons qualify, even seasons play the tournament). Starts empty
   * on a new save and fills from the first offseason onward; see
   * src/core/international.
   */
  international: InternationalState;
  /**
   * God Mode sandbox toggle for this save. When true, guardrail-free editing
   * is unlocked (see src/core/godMode.ts) and potential is shown un-fogged
   * everywhere. Purely a save-scoped switch; migrated to false for old saves.
   */
  godMode: boolean;
  /**
   * How hard this save is (see the DIFFICULTIES block in constants.ts).
   * Chosen on the New League screen and fixed for the save's lifetime — every
   * lever it drives is user-club-only, so the world economy is identical on all
   * four levels. Migrated to "normal" for old saves, which is exactly the
   * shipped tuning, so no dynasty in progress changes behaviour.
   */
  difficulty: Difficulty;
  /**
   * Monotonic pid allocator: the next pid a generated player will take.
   *
   * **Must never go backwards.** This used to be derived as
   * `max(players.pid) + 1` at each use, which is only safe while players are
   * never removed — and they are: retirement deletes them (simOffseason step 3)
   * and so does the free-agent cull. If the highest-pid player is removed, a
   * derived allocator hands his pid to a brand-new player, who then silently
   * inherits his transfer history, news events and cup box-score lines (pids
   * are the only link). Storing the cursor makes reuse impossible.
   *
   * Backfilled for old saves as `max(pid) + 1` (see migrate.ts), which is
   * exactly what the derived version would have returned, so no save changes
   * behavior on upgrade.
   */
  nextPid: number;
  /**
   * Seasons the AI managed the user's club, because they jumped forward past
   * them (see core/autopilot.ts). Oldest first, normally empty.
   *
   * Stored rather than derived because nothing else in the save records it: a
   * jumped season looks like any other season afterwards, and "I didn't pick
   * that squad" is the one piece of context the club's own history can't
   * reconstruct. Migrated to `[]`, which is what every dynasty played by hand
   * means anyway.
   */
  aiManagedSeasons: number[];
}

export function createLeagueState(
  userTid: number,
  rng: () => number,
  seed = 0,
  difficulty: Difficulty = DEFAULT_DIFFICULTY,
): LeagueStore {
  const league = generateWorld(rng, seed);
  const competitions = worldCompetitions();
  // Each AI club lines up in the formation that fields its strongest XI; the
  // user's club keeps the neutral 4-3-3 default and picks its own on the Roster page.
  const teams = assignAIFormations(
    assignIdentities(league, competitions, userTid, difficulty), league.players, userTid,
  );
  const schedule = buildCompetitionSchedule(teams, competitions);

  // Fog-of-war: stamp the user's initial senior roster as first-observed in
  // season 1 so their potential estimates clear over the first few seasons,
  // same as any later signing (see src/core/scouting/potentialFog.ts).
  const userTeam = teams.find((t) => t.tid === userTid);
  if (userTeam) {
    userTeam.scoutingObserved = reconcileScoutingObserved({}, userTeam.roster, 1);
  }

  return {
    lid: 0,
    meta: {
      name: "My League",
      created: Date.now(),
      userTid,
    },
    competitions,
    teams,
    players: league.players,
    season: 1,
    phase: "regular",
    schedule,
    played: [],
    negotiations: [],
    inboundOffers: [],
    transfers: [],
    winterMarketRunSeason: null,
    seasonHistory: [],
    newsEvents: [],
    retiredPlayers: [],
    powerRankingHistory: [],
    activeLoans: [],
    loanListings: [],
    loanRejections: [],
    // No cup in season 1: it's seeded from the previous season's final tables,
    // and there is none yet. The first Continental Cup runs in season 2.
    cup: null,
    cupHistory: [],
    // Same for the Shield — both are seeded together at the first offseason.
    shield: null,
    shieldHistory: [],
    // Domestic cups need no qualification, so unlike the Continental Cup they
    // run from season 1. Drawn with no tables to rank on, which the field
    // builder handles by falling back to tid order.
    domesticCups: buildDomesticCups(competitions, teams, new Map(), 1),
    domesticCupHistory: [],
    international: emptyInternationalState(),
    godMode: false,
    difficulty,
    // Same value the old derived `max(pid) + 1` produced at first use, so a
    // fresh world generates identically to before.
    nextPid: Math.max(0, ...league.players.map((p) => p.pid)) + 1,
    aiManagedSeasons: [],
  };
}
