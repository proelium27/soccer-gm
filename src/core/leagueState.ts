import type { Player } from "./players/types.js";
import type { PlayedMatch } from "./standings.js";
import type { StoredTeam } from "./teams/clubs.js";
import type { ScheduleGame } from "./schedule.js";
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
}

export function createLeagueState(userTid: number, rng: () => number): LeagueStore {
  const league = generateLeague(rng);
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
  };
}
