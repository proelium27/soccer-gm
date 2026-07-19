import type { Player } from "./players/types.js";
import type { PlayedMatch, SeasonHistoryEntry } from "./standings.js";
import type { StoredTeam } from "./teams/clubs.js";
import type { ScheduleGame } from "./schedule.js";
import type { CompletedTransfer, TransferNegotiation } from "./transfers/negotiation.js";
import type { InboundOffer } from "./transfers/inboundOffers.js";
import type { NewsEvent } from "./newsEvents.js";
import type { PowerRankingSnapshot } from "./teams/powerRanking.js";
import type { ActiveLoan, LoanListing, LoanRejection } from "./loans.js";
import type { Competition } from "./competitions.js";
import type { CupState } from "./cup/types.js";
import { generateWorld } from "./league/generate.js";
import { assignIdentities, assignAIFormations } from "./teams/clubs.js";
import { generateSchedule } from "./schedule.js";
import { worldCompetitions } from "./competitions.js";
import { reconcileScoutingObserved } from "./scouting/potentialFog.js";

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
}

export function createLeagueState(userTid: number, rng: () => number, seed = 0): LeagueStore {
  const league = generateWorld(rng, seed);
  const competitions = worldCompetitions();
  // Each AI club lines up in the formation that fields its strongest XI; the
  // user's club keeps the neutral 4-3-3 default and picks its own on the Roster page.
  const teams = assignAIFormations(assignIdentities(league, competitions), league.players, userTid);
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
    powerRankingHistory: [],
    activeLoans: [],
    loanListings: [],
    loanRejections: [],
    // No cup in season 1: it's seeded from the previous season's final tables,
    // and there is none yet. The first Continental Cup runs in season 2.
    cup: null,
    cupHistory: [],
  };
}
