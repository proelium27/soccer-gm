import type { InternationalState } from "./types.js";

export type {
  InternationalState, IntlStage, IntlCareer, IntlTournament, IntlTournamentSummary,
  IntlQualifyingCampaign, IntlGroup, IntlGroupMatch, NationSquad,
} from "./types.js";
export { emptyIntlCareer } from "./types.js";
export { groupTable, rankAcrossGroups, type GroupRow } from "./groups.js";
export { confederationOf, CONFEDERATIONS, CONFEDERATION_OF } from "./confederations.js";
export { buildSquads, selectSquad, isEligibleNation, nationPools } from "./squads.js";
export { finalTie, tournamentGoals, summarize } from "./tournament.js";
export {
  isIntlStagePending, initInternationalCampaign, playIntlStage, simThroughInternational,
  applyCareerDelta,
} from "./staging.js";

export function emptyInternationalState(): InternationalState {
  return { qualifying: null, tournament: null, history: [], stage: null };
}
