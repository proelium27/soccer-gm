import type { LeagueStore } from "../core/leagueState.js";
import type { SimThrough } from "../core/simThrough.js";
import type { PlayedMatch } from "../core/standings.js";
import type { CupTie } from "../core/cup/types.js";
import type { DomesticTieResult } from "../core/simThrough.js";

// Re-exported rather than redeclared: the two used to be separate unions and
// could drift apart silently, since the worker boundary erases types.
export type { SimThrough } from "../core/simThrough.js";

/** Play one staged international stage, or blast through every remaining one. */
export type IntlMode = "stage" | "through";

// UI -> Worker
export type WorkerCommand =
  | { type: "sim"; through: SimThrough; league: LeagueStore }
  | { type: "offseason"; league: LeagueStore }
  | { type: "intl"; mode: IntlMode; league: LeagueStore };

// Worker -> UI
export type WorkerResponse =
  | { type: "simResult"; league: LeagueStore }
  | { type: "offseasonResult"; league: LeagueStore }
  | { type: "intlResult"; league: LeagueStore }
  | {
      type: "simProgress";
      matchday: number;
      matchdayIndex: number;
      totalMatchdays: number;
      results: PlayedMatch[];
      cupTies: CupTie[];
      /** Domestic cup ties played on this matchday, each with its own cup/round labels. */
      domesticTies: DomesticTieResult[];
    };
