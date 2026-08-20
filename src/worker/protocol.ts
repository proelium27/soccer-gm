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
  | { type: "intl"; mode: IntlMode; league: LeagueStore }
  /** Play `seasons` whole seasons with the AI running the user's club (core/autopilot.ts). */
  | { type: "jump"; seasons: number; league: LeagueStore };

// Worker -> UI
export type WorkerResponse =
  | { type: "simResult"; league: LeagueStore }
  | { type: "offseasonResult"; league: LeagueStore }
  | { type: "intlResult"; league: LeagueStore }
  | { type: "jumpResult"; league: LeagueStore }
  /**
   * Fired as each jumped season starts playing out. The whole jump is one
   * command rather than one per season precisely so the league is
   * structured-cloned across the worker boundary twice in total instead of
   * twice per season — at tens of megabytes that is the difference between a
   * progress bar and a slideshow.
   */
  | { type: "jumpProgress"; seasonsDone: number; totalSeasons: number; season: number }
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
