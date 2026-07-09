import type { LeagueStore } from "../core/leagueState.js";

export type SimThrough = "game" | "month" | "deadline" | "season";

// UI -> Worker
export type WorkerCommand =
  | { type: "sim"; through: SimThrough; league: LeagueStore }
  | { type: "offseason"; league: LeagueStore };

// Worker -> UI
export type WorkerResponse =
  | { type: "simResult"; league: LeagueStore }
  | { type: "offseasonResult"; league: LeagueStore };
