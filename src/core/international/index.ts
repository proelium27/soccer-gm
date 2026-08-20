import type { InternationalState } from "./types.js";

export type {
  InternationalState, IntlStage, IntlCareer, IntlSeasonLine, IntlTournament, IntlTournamentSummary,
  IntlQualifyingCampaign, IntlQualifyingSummary, IntlGroup, IntlGroupMatch, IntlGroupTable,
  IntlKnockoutResult, IntlPowerSnapshot, NationSquad, IntlConfederationCup,
} from "./types.js";
export { emptyIntlCareer } from "./types.js";
export { groupTable, groupTableSummary, rankAcrossGroups, type GroupRow } from "./groups.js";
export {
  confederationOf, CONFEDERATIONS, CONFEDERATION_OF,
  CONFEDERATION_CUPS, confederationCupSpec, type ConfederationCupSpec,
} from "./confederations.js";
export {
  initConfederationCups, roundsRemaining, confederationCupGroupsPending, confederationCupKnockoutPending,
  summarizeConfederationCups, confederationCupChampions,
} from "./confederationCup.js";
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
    qualifying: null, tournament: null, confederationCups: [], history: [],
    qualifyingHistory: [], confederationCupHistory: [], powerRankings: [],
    stage: null, stageInjuries: [],
  };
}
