import type { Player } from "./players/types.js";
import type { PlayedMatch, SeasonHistoryEntry } from "./standings.js";
import type { StoredTeam } from "./teams/clubs.js";
import type { ScheduleGame } from "./schedule.js";
import type { CompletedTransfer, TransferNegotiation } from "./transfers/negotiation.js";
import type { InboundOffer } from "./transfers/inboundOffers.js";
import type { NewsEvent } from "./newsEvents.js";
import type { Competition } from "./competitions.js";
import { generateTwoDivisionLeague } from "./league/generate.js";
import { assignIdentities } from "./teams/clubs.js";
import { generateSchedule } from "./schedule.js";
import { englandCompetitions } from "./competitions.js";

export type { StoredTeam } from "./teams/clubs.js";
export type { ScheduleGame } from "./schedule.js";

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
}

export function createLeagueState(userTid: number, rng: () => number, seed = 0): LeagueStore {
  const league = generateTwoDivisionLeague(rng, seed);
  const competitions = englandCompetitions();
  const teams = assignIdentities(league, competitions);
  const schedule = competitions.flatMap((comp) =>
    generateSchedule(teams.filter((t) => t.compId === comp.id).map((t) => t.tid)),
  );

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
  };
}
