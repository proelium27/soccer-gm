import type { Player } from "../players/types.js";
import type { InternationalState, IntlCareer, IntlSeasonLine, NationSquad } from "./types.js";
import type { CareerDelta } from "./simIntl.js";
import { emptyIntlCareer } from "./types.js";
import { emptyCareerDelta } from "./simIntl.js";
import { initQualifying, playQualifyingRound } from "./qualifying.js";
import {
  initTournament, playTournamentGroups, playTournamentRound, summarize, summarizeQualifying,
} from "./tournament.js";
import { buildPowerSnapshot } from "./squads.js";
import {
  initContinental, playContinentalGroups, playContinentalKnockoutRound,
  continentalGroupsPending, continentalKnockoutPending, summarizeContinental,
} from "./continental.js";
import { qualifyingLeg, CONTINENTAL_QUALIFYING_LEG } from "../constants.js";

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
 * Fold one stage's appearances into a player's per-campaign lines: a qualifying
 * offseason contributes one line, a tournament offseason four stages that all
 * merge into the same one. Kept append-only and ordered oldest-first so the UI
 * can render it straight.
 */
function mergeSeasonLine(
  seasons: IntlSeasonLine[],
  season: number,
  kind: IntlSeasonLine["kind"],
  d: { caps: number; goals: number; assists: number },
): IntlSeasonLine[] {
  const i = seasons.findIndex((s) => s.season === season && s.kind === kind);
  if (i < 0) return [...seasons, { season, kind, ...d }];
  const existing = seasons[i];
  const merged = { ...existing, caps: existing.caps + d.caps, goals: existing.goals + d.goals, assists: existing.assists + d.assists };
  return seasons.map((s, j) => (j === i ? merged : s));
}

/**
 * Write a campaign's appearances onto the players who earned them, plus the
 * squad-level counters (a tournament named in, a tournament won). Returns a new
 * array; players with no international involvement are returned untouched, so
 * the common case allocates nothing new. Applied per stage — caps/goals/assists
 * accumulate from each stage's match delta, while the one-off `tournaments` and
 * `titles` counters are credited once at the final (pass the squads then).
 *
 * `season`/`kind` label the per-campaign line this stage's appearances land on.
 * Only players who actually featured get a line — the squads-only call at the
 * final carries an empty delta and must not stamp empty rows on 23 benchwarmers.
 */
export function applyCareerDelta(
  players: Player[],
  delta: CareerDelta,
  squads: NationSquad[] | null,
  championSquad: NationSquad | null,
  season: number,
  kind: IntlSeasonLine["kind"],
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
        // A continental championship is counted separately from a World Cup —
        // see IntlCareer for why the two must not share a counter.
        tournaments: current.tournaments + (isNamed && kind !== "continental" ? 1 : 0),
        titles: current.titles + (champions.has(p.pid) && kind !== "continental" ? 1 : 0),
        continentalTournaments: (current.continentalTournaments ?? 0)
          + (isNamed && kind === "continental" ? 1 : 0),
        continentalTitles: (current.continentalTitles ?? 0)
          + (champions.has(p.pid) && kind === "continental" ? 1 : 0),
        seasons: d
          ? mergeSeasonLine(current.seasons ?? [], season, kind, d)
          : current.seasons ?? [],
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
    // A freshly drawn campaign starts with no injuries pending carry-over.
    stageInjuries: [],
  });

  const leg = qualifyingLeg(endingSeason);

  // The continental championships share the cycle's middle qualifying
  // offseason. Drawn here alongside the qualifying leg, played after it. Null
  // in every other offseason, which is *not* the same as an empty array: the
  // last edition stays on the state so it can still be browsed, and is only
  // replaced when a new one is actually drawn.
  const drawnContinental = leg === CONTINENTAL_QUALIFYING_LEG
    ? initContinental(players, endingSeason, lid)
    : null;
  const continental = drawnContinental ?? state.continental;

  if (leg === 0) {
    // Start of a cycle: draw a fresh qualifying campaign (all legs, unplayed)
    // and stage its first leg. The campaign's season is this start season, which
    // seeds every leg — so the whole three-offseason campaign is deterministic.
    const campaign = initQualifying(players, endingSeason);
    if (!campaign) return { ...state, stage: null };
    return withSnapshot({ ...state, qualifying: campaign, stage: "qualifying" });
  }

  if (leg > 0) {
    // A later qualifying offseason of the same cycle: resume the in-progress
    // campaign for its next leg. Nothing to resume if it never started, or if it
    // somehow already finished — but the continental championships are their own
    // competition and still go ahead, so a save that joined the cycle late plays
    // them even with no qualifying campaign on file.
    const resumable = state.qualifying !== null && state.qualifying.qualified.length === 0;
    const hasContinental = drawnContinental !== null && drawnContinental.length > 0;
    if (!resumable && !hasContinental) return { ...state, continental, stage: null };
    return withSnapshot({
      ...state,
      continental,
      stage: resumable ? "qualifying" : "continental-groups",
    });
  }

  // Tournament offseason (every fourth season): draw the World Cup from the just
  // completed qualifying campaign.
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
 *
 * `season` is the club season whose offseason this is — it labels the per-season
 * international lines written onto each player who featured. It is passed in
 * rather than read off the campaign because a qualifying campaign spans three
 * offseasons: its own `season` is the cycle's start, not the offseason being
 * played here.
 */
export function playIntlStage(
  state: InternationalState,
  players: Player[],
  lid: number,
  season: number,
): { international: InternationalState; players: Player[] } {
  switch (state.stage) {
    case "qualifying": {
      if (!state.qualifying) return { international: { ...state, stage: "done" }, players };
      // Play this offseason's one leg. The campaign spans three offseasons, so
      // only archive its summary once the last leg locks in the 16 qualifiers.
      const { campaign, delta, injured } = playQualifyingRound(state.qualifying, players, lid);
      const finished = campaign.qualified.length > 0;
      return {
        international: {
          ...state,
          qualifying: campaign,
          qualifyingHistory: finished
            ? [...state.qualifyingHistory, summarizeQualifying(campaign)]
            : state.qualifyingHistory,
          stageInjuries: [...state.stageInjuries, ...injured],
          // The middle qualifying offseason of the cycle plays its leg and then
          // the continental championships; every other one is done here.
          stage: continentalGroupsPending(state.continental) ? "continental-groups" : "done",
        },
        players: applyCareerDelta(players, delta, null, null, season, "qualifying"),
      };
    }
    case "continental-groups": {
      const r = playContinentalGroups(state.continental, players, lid);
      return {
        international: {
          ...state,
          continental: r.tournaments,
          stageInjuries: [...state.stageInjuries, ...r.injured],
          stage: continentalKnockoutPending(r.tournaments) ? "continental-ko" : "done",
        },
        players: applyCareerDelta(players, r.delta, null, null, season, "continental"),
      };
    }
    case "continental-ko": {
      const r = playContinentalKnockoutRound(state.continental, players, lid);
      // Caps/goals/assists from whichever championships played a round.
      let updated = applyCareerDelta(players, r.delta, null, null, season, "continental");
      const stageInjuries = [...state.stageInjuries, ...r.injured];

      if (continentalKnockoutPending(r.tournaments)) {
        return {
          international: { ...state, continental: r.tournaments, stageInjuries, stage: "continental-ko" },
          players: updated,
        };
      }

      // Every final is played on the same stage (see continental.ts), so the
      // championships all finish together: credit each squad a tournament and
      // each winner a title, then archive the lot.
      for (const t of r.tournaments) {
        const championSquad = t.championNid !== null ? t.squads[t.championNid] ?? null : null;
        updated = applyCareerDelta(updated, emptyCareerDelta(), t.squads, championSquad, season, "continental");
      }
      return {
        international: {
          ...state,
          continental: r.tournaments,
          continentalHistory: [...state.continentalHistory, ...summarizeContinental(r.tournaments, updated)],
          stageInjuries,
          stage: "done",
        },
        players: updated,
      };
    }
    case "groups": {
      if (!state.tournament) return { international: { ...state, stage: "done" }, players };
      const { tournament, delta, injured } = playTournamentGroups(state.tournament, players, lid);
      return {
        international: { ...state, tournament, stageInjuries: [...state.stageInjuries, ...injured], stage: "qf" },
        players: applyCareerDelta(players, delta, null, null, season, "tournament"),
      };
    }
    case "qf":
    case "sf":
    case "final": {
      if (!state.tournament) return { international: { ...state, stage: "done" }, players };
      const { tournament, delta, injured } = playTournamentRound(state.tournament, players, lid);
      // caps/goals/assists from this round's matches.
      let updated = applyCareerDelta(players, delta, null, null, season, "tournament");

      const stageInjuries = [...state.stageInjuries, ...injured];

      if (tournament.championNid !== null) {
        // Final done: credit everyone a tournament played and the winners a
        // title, then collapse the tournament into the permanent history record.
        const championSquad = tournament.squads[tournament.championNid] ?? null;
        updated = applyCareerDelta(updated, emptyCareerDelta(), tournament.squads, championSquad, season, "tournament");
        const summary = summarize(tournament, updated);
        return {
          international: {
            ...state,
            tournament,
            history: summary ? [...state.history, summary] : state.history,
            stageInjuries,
            stage: "done",
          },
          players: updated,
        };
      }

      return {
        international: { ...state, tournament, stageInjuries, stage: state.stage === "qf" ? "sf" : "final" },
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
  season: number,
): { international: InternationalState; players: Player[] } {
  let international = state;
  let current = players;
  // At most five stages (a continental offseason: a qualifying leg, the
  // championships' groups, then a knockout round per click up to the finals);
  // the guard just stops a degenerate un-resolvable bracket from looping
  // forever.
  for (let guard = 0; isIntlStagePending(international) && guard < 12; guard++) {
    const result = playIntlStage(international, current, lid, season);
    international = result.international;
    current = result.players;
  }
  return { international, players: current };
}
