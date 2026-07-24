import type { InternationalState } from "./types.js";

export type {
  InternationalState, IntlStage, IntlCareer, IntlTournament, IntlTournamentSummary,
  IntlQualifyingCampaign, IntlQualifyingSummary, IntlGroup, IntlGroupMatch, IntlGroupTable,
  IntlKnockoutResult, IntlPowerSnapshot, NationSquad,
} from "./types.js";
export { emptyIntlCareer } from "./types.js";
export { groupTable, groupTableSummary, rankAcrossGroups, type GroupRow } from "./groups.js";
export { confederationOf, CONFEDERATIONS, CONFEDERATION_OF } from "./confederations.js";
export { buildSquads, selectSquad, isEligibleNation, nationPools, buildPowerSnapshot } from "./squads.js";
export { finalTie, tournamentGoals, summarize, summarizeQualifying } from "./tournament.js";
export { nationRecords, finishOf, type NationRecord } from "./nationHistory.js";
export {
  isIntlStagePending, initInternationalCampaign, playIntlStage, simThroughInternational,
  applyCareerDelta,
} from "./staging.js";

export function emptyInternationalState(): InternationalState {
  return {
    qualifying: null, tournament: null, history: [],
    qualifyingHistory: [], powerRankings: [], stage: null, stageInjuries: [],
  };
}
