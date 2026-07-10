import type { Player } from "./players/types.js";
import type { PlayedMatch } from "./standings.js";
import type { StoredTeam } from "./teams/clubs.js";
import type { ScheduleGame } from "./schedule.js";
import type { CompletedTransfer, TransferNegotiation } from "./transfers/negotiation.js";
import { generateLeague } from "./league/generate.js";
import { assignIdentities } from "./teams/clubs.js";
import { generateSchedule } from "./schedule.js";

export type { StoredTeam } from "./teams/clubs.js";
export type { ScheduleGame } from "./schedule.js";

export interface LeagueStore {
  lid: number;
  meta: {
    name: string;
    created: number;
    userTid: number;
  };
  teams: StoredTeam[];
  players: Player[];
  season: number;
  phase: "regular" | "offseason";
  schedule: ScheduleGame[];
  played: PlayedMatch[];
  /** User↔club transfer talks for the current window (pruned when a new window's talks start). */
  negotiations: TransferNegotiation[];
  /** Completed transfers, all seasons (newest last). */
  transfers: CompletedTransfer[];
}

export function createLeagueState(userTid: number, rng: () => number, seed = 0): LeagueStore {
  const league = generateLeague(rng, seed);
  const teams = assignIdentities(league);
  const teamIds = teams.map((t) => t.tid);
  const schedule = generateSchedule(teamIds);

  return {
    lid: 0,
    meta: {
      name: "My League",
      created: Date.now(),
      userTid,
    },
    teams,
    players: league.players,
    season: 1,
    phase: "regular",
    schedule,
    played: [],
    negotiations: [],
    transfers: [],
  };
}
