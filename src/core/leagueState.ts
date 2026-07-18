import type { Player } from "./players/types.js";
import type { PlayedMatch, SeasonHistoryEntry } from "./standings.js";
import type { StoredTeam } from "./teams/clubs.js";
import type { ScheduleGame } from "./schedule.js";
import type { CompletedTransfer, TransferNegotiation } from "./transfers/negotiation.js";
import type { InboundOffer } from "./transfers/inboundOffers.js";
import type { NewsEvent } from "./newsEvents.js";
import type { ActiveLoan, LoanListing, LoanRejection } from "./loans.js";
import type { Competition } from "./competitions.js";
import { generateWorld } from "./league/generate.js";
import { assignIdentities } from "./teams/clubs.js";
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
  /** Loans currently in effect (parent club still owns the contract, loanee club fields him and pays wages). */
  activeLoans: ActiveLoan[];
  /** The user's own senior-roster players listed for an outgoing loan, awaiting an AI club's offer. */
  loanListings: LoanListing[];
  /** Incoming loan offers the user has turned down this window (see loans.ts's loanOfferCandidates). */
  loanRejections: LoanRejection[];
}

export function createLeagueState(userTid: number, rng: () => number, seed = 0): LeagueStore {
  const league = generateWorld(rng, seed);
  const competitions = worldCompetitions();
  const teams = assignIdentities(league, competitions);
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
    activeLoans: [],
    loanListings: [],
    loanRejections: [],
  };
}
