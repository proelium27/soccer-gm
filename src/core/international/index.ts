import type { Player } from "../players/types.js";
import type { InternationalState, IntlCareer, NationSquad } from "./types.js";
import type { CareerDelta } from "./simIntl.js";
import { emptyIntlCareer } from "./types.js";
import { runQualifying } from "./qualifying.js";
import { runTournament, summarize } from "./tournament.js";
import { isQualifyingSeason } from "../constants.js";

export type {
  InternationalState, IntlCareer, IntlTournament, IntlTournamentSummary,
  IntlQualifyingCampaign, IntlGroup, IntlGroupMatch, NationSquad,
} from "./types.js";
export { emptyIntlCareer } from "./types.js";
export { groupTable, rankAcrossGroups, type GroupRow } from "./groups.js";
export { confederationOf, CONFEDERATIONS, CONFEDERATION_OF } from "./confederations.js";
export { buildSquads, selectSquad, isEligibleNation, nationPools } from "./squads.js";
export { finalTie, tournamentGoals, summarize } from "./tournament.js";

export function emptyInternationalState(): InternationalState {
  return { qualifying: null, tournament: null, history: [] };
}

/**
 * Write a campaign's appearances onto the players who earned them, plus the
 * squad-level counters (a tournament named in, a tournament won). Returns a new
 * array; players with no international involvement are returned untouched, so
 * the common case allocates nothing new.
 */
function applyCareerDelta(
  players: Player[],
  delta: CareerDelta,
  squads: NationSquad[] | null,
  championSquad: NationSquad | null,
): Player[] {
  const named = new Set(squads?.flatMap((s) => s.pids) ?? []);
  const champions = new Set(championSquad?.pids ?? []);
  if (delta.size === 0 && named.size === 0) return players;

  return players.map((p) => {
    const d = delta.get(p.pid);
    const isNamed = named.has(p.pid);
    if (!d && !isNamed) return p;
    const current: IntlCareer = p.intl ?? emptyIntlCareer();
    return {
      ...p,
      intl: {
        caps: current.caps + (d?.caps ?? 0),
        goals: current.goals + (d?.goals ?? 0),
        assists: current.assists + (d?.assists ?? 0),
        tournaments: current.tournaments + (isNamed ? 1 : 0),
        titles: current.titles + (champions.has(p.pid) ? 1 : 0),
      },
    };
  });
}

/**
 * Advance international football by one offseason, on its two-year cycle: an
 * odd season's offseason plays a qualifying campaign, and the following even
 * season's offseason plays the tournament that campaign filled.
 *
 * Called from simOffseason *before* progression, so the matches are played on
 * the ratings and injuries the club season actually finished with — a
 * tournament belongs to the summer that just ended, not to the one about to
 * start. Every match runs on its own seeded rng stream (see simIntl.ts), so
 * nothing here perturbs the league's own deterministic match results.
 *
 * A save that adopts the feature partway through starts with no qualifying
 * campaign on file. If its next offseason is an even one there is nothing to
 * play, so it simply waits for the next odd offseason and picks the cycle up
 * from there.
 */
export function runInternationalOffseason(
  international: InternationalState | null,
  players: Player[],
  endingSeason: number,
  lid: number,
): { international: InternationalState; players: Player[] } {
  const state = international ?? emptyInternationalState();

  if (isQualifyingSeason(endingSeason)) {
    const result = runQualifying(players, endingSeason, lid);
    if (!result) return { international: state, players };
    return {
      international: { ...state, qualifying: result.campaign },
      players: applyCareerDelta(players, result.delta, null, null),
    };
  }

  const qualified = state.qualifying?.qualified;
  if (!qualified || qualified.length === 0) return { international: state, players };

  const result = runTournament(qualified, players, endingSeason, lid);
  if (!result) return { international: state, players };

  const { tournament, delta } = result;
  const championSquad =
    tournament.championNid === null ? null : tournament.squads[tournament.championNid] ?? null;
  const updated = applyCareerDelta(players, delta, tournament.squads, championSquad);
  const summary = summarize(tournament, updated);

  return {
    international: {
      qualifying: state.qualifying,
      tournament,
      history: summary ? [...state.history, summary] : state.history,
    },
    players: updated,
  };
}
