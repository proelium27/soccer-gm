import type { Player } from "../players/types.js";
import type { InternationalState, IntlCareer, NationSquad } from "./types.js";
import type { CareerDelta } from "./simIntl.js";
import { emptyIntlCareer } from "./types.js";
import { emptyCareerDelta } from "./simIntl.js";
import { initQualifying, playQualifying } from "./qualifying.js";
import {
  initTournament, playTournamentGroups, playTournamentRound, summarize, summarizeQualifying,
} from "./tournament.js";
import { buildPowerSnapshot } from "./squads.js";
import { isQualifyingSeason } from "../constants.js";

/**
 * Staged international football.
 *
 * International tournaments are played inside the offseason, but rather than
 * resolving in one silent step they are broken into stages the user clicks
 * through — group stage, then each knockout round — so a World Cup can be
 * *watched*. To make that possible the campaign is *drawn* the moment the
 * offseason begins (fixtures exist, unplayed) and then *played* one stage at a
 * time, each stage persisted, with the offseason's "Advance" withheld until the
 * campaign reaches "done" (see InternationalState.stage).
 *
 * Every stage runs on its own seeded rng stream (see simIntl.ts) keyed off the
 * round, so playing a click at a time is byte-identical to the bulk
 * "sim through" path — `runQualifying`/`runTournament` drive these very same
 * stage functions. Nothing here draws from the league's shared rng, so staged
 * international football cannot shift a single club result.
 *
 * Because the whole campaign now happens *before* the offseason's progression
 * and retirement steps run, a player who ends the season injured still misses
 * the tournament and a player about to retire gets one last campaign — the
 * squads read the ratings the club season actually finished with.
 */

/** True while a drawn campaign still has stages left to play (so Advance waits). */
export function isIntlStagePending(state: InternationalState): boolean {
  return state.stage != null && state.stage !== "done";
}

/**
 * Write a campaign's appearances onto the players who earned them, plus the
 * squad-level counters (a tournament named in, a tournament won). Returns a new
 * array; players with no international involvement are returned untouched, so
 * the common case allocates nothing new. Applied per stage — caps/goals/assists
 * accumulate from each stage's match delta, while the one-off `tournaments` and
 * `titles` counters are credited once at the final (pass the squads then).
 */
export function applyCareerDelta(
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
 * Draw this offseason's international campaign, if there is one, and mark the
 * first stage to play. Runs at the instant the club season ends (see
 * simThrough), on the ratings and injuries it finished with. Player-free and
 * shared-rng-free.
 *
 * On the two-year cadence: an odd season's offseason draws a qualifying
 * campaign; the following even one draws the tournament its qualifiers fill.
 * `stage` is left null when there is nothing to play — an even year with no
 * qualifiers on file yet, or a world too small to field INTL_FIELD_SIZE nations
 * — in which case the offseason simply advances as normal.
 */
export function initInternationalCampaign(
  state: InternationalState,
  players: Player[],
  endingSeason: number,
  lid: number,
): InternationalState {
  // A power-ranking snapshot of every eligible nation, taken now on the
  // just-finished club season's squads (only kept if a campaign is actually
  // drawn below).
  const withSnapshot = (drawn: InternationalState): InternationalState => ({
    ...drawn,
    powerRankings: [...state.powerRankings, buildPowerSnapshot(players, endingSeason)],
  });

  if (isQualifyingSeason(endingSeason)) {
    const campaign = initQualifying(players, endingSeason);
    if (!campaign) return { ...state, stage: null };
    return withSnapshot({ ...state, qualifying: campaign, stage: "qualifying" });
  }

  const qualified = state.qualifying?.qualified;
  if (!qualified || qualified.length === 0) return { ...state, stage: null };
  const tournament = initTournament(qualified, players, endingSeason, lid);
  if (!tournament) return { ...state, stage: null };
  return withSnapshot({ ...state, tournament, stage: "groups" });
}

/**
 * Play exactly one stage of the drawn campaign, advancing `stage`. A no-op when
 * nothing is pending. Returns the new international state and the players with
 * this stage's appearances folded in.
 */
export function playIntlStage(
  state: InternationalState,
  players: Player[],
  lid: number,
): { international: InternationalState; players: Player[] } {
  switch (state.stage) {
    case "qualifying": {
      if (!state.qualifying) return { international: { ...state, stage: "done" }, players };
      const { campaign, delta } = playQualifying(state.qualifying, players, lid);
      return {
        international: {
          ...state,
          qualifying: campaign,
          qualifyingHistory: [...state.qualifyingHistory, summarizeQualifying(campaign)],
          stage: "done",
        },
        players: applyCareerDelta(players, delta, null, null),
      };
    }
    case "groups": {
      if (!state.tournament) return { international: { ...state, stage: "done" }, players };
      const { tournament, delta } = playTournamentGroups(state.tournament, players, lid);
      return {
        international: { ...state, tournament, stage: "qf" },
        players: applyCareerDelta(players, delta, null, null),
      };
    }
    case "qf":
    case "sf":
    case "final": {
      if (!state.tournament) return { international: { ...state, stage: "done" }, players };
      const { tournament, delta } = playTournamentRound(state.tournament, players, lid);
      // caps/goals/assists from this round's matches.
      let updated = applyCareerDelta(players, delta, null, null);

      if (tournament.championNid !== null) {
        // Final done: credit everyone a tournament played and the winners a
        // title, then collapse the tournament into the permanent history record.
        const championSquad = tournament.squads[tournament.championNid] ?? null;
        updated = applyCareerDelta(updated, emptyCareerDelta(), tournament.squads, championSquad);
        const summary = summarize(tournament, updated);
        return {
          international: {
            ...state,
            tournament,
            history: summary ? [...state.history, summary] : state.history,
            stage: "done",
          },
          players: updated,
        };
      }

      return {
        international: { ...state, tournament, stage: state.stage === "qf" ? "sf" : "final" },
        players: updated,
      };
    }
    default: // null or "done" — nothing left to play
      return { international: state, players };
  }
}

/**
 * Play every remaining stage of the drawn campaign in one go — the "sim through
 * qualifying" / "sim through the World Cup" shortcut. Identical in outcome to
 * clicking each stage, since the stages share their seeded streams.
 */
export function simThroughInternational(
  state: InternationalState,
  players: Player[],
  lid: number,
): { international: InternationalState; players: Player[] } {
  let international = state;
  let current = players;
  // At most four stages (tournament: groups, qf, sf, final); the guard just
  // stops a degenerate un-resolvable bracket from looping forever.
  for (let guard = 0; isIntlStagePending(international) && guard < 8; guard++) {
    const result = playIntlStage(international, current, lid);
    international = result.international;
    current = result.players;
  }
  return { international, players: current };
}
