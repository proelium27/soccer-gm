import type { InternationalState } from "./types.js";

export type {
  InternationalState, IntlStage, IntlCareer, IntlSeasonLine, IntlTournament, IntlTournamentSummary,
  IntlQualifyingCampaign, IntlQualifyingSummary, IntlGroup, IntlGroupMatch, IntlGroupTable,
  IntlKnockoutResult, IntlPowerSnapshot, NationSquad, IntlContinentalTournament,
} from "./types.js";
export { emptyIntlCareer } from "./types.js";
export { groupTable, groupTableSummary, rankAcrossGroups, type GroupRow } from "./groups.js";
export {
  confederationOf, CONFEDERATIONS, CONFEDERATION_OF,
  CONTINENTAL_TOURNAMENTS, continentalSpec, type ContinentalTournamentSpec,
} from "./confederations.js";
export {
  initContinental, roundsRemaining, continentalGroupsPending, continentalKnockoutPending,
  summarizeContinental, continentalChampions,
} from "./continental.js";
export { formatFor, knockoutRounds, type TournamentFormat } from "./format.js";
export { buildSquads, selectSquad, isEligibleNation, nationPools, buildPowerSnapshot } from "./squads.js";
export { finalTie, tournamentGoals, summarize, summarizeQualifying } from "./tournament.js";
export { nationRecords, finishOf, type NationRecord } from "./nationHistory.js";
export {
  isIntlStagePending, initInternationalCampaign, playIntlStage, simThroughInternational,
  applyCareerDelta,
} from "./staging.js";

export function emptyInternationalState(): InternationalState {
  return {
    qualifying: null, tournament: null, continental: [], history: [],
    qualifyingHistory: [], continentalHistory: [], powerRankings: [],
    stage: null, stageInjuries: [],
  };
}
