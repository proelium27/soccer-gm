import type { LeagueStore } from "../core/leagueState.js";
import type { PlayedMatch } from "../core/standings.js";
import type { CupTie } from "../core/cup/types.js";

export type SimThrough = "game" | "month" | "deadline" | "season";

// UI -> Worker
export type WorkerCommand =
  | { type: "sim"; through: SimThrough; league: LeagueStore }
  | { type: "offseason"; league: LeagueStore };

// Worker -> UI
export type WorkerResponse =
  | { type: "simResult"; league: LeagueStore }
  | { type: "offseasonResult"; league: LeagueStore }
  | {
      type: "simProgress";
      matchday: number;
      matchdayIndex: number;
      totalMatchdays: number;
      results: PlayedMatch[];
      cupTies: CupTie[];
    };
