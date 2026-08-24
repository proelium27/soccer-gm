import type { Player } from "../players/types.js";
import type { IntlConfederationCup, IntlTournamentSummary, NationSquad } from "./types.js";
import type { CareerDelta } from "./simIntl.js";
import { buildSquads } from "./squads.js";
import { buildGroup, potDraw } from "./groups.js";
import { playTournamentGroups, playTournamentRound, roundsRemaining, summarize } from "./tournament.js";
import { emptyCareerDelta, mergeCareerDelta } from "./simIntl.js";
import {
  CONFEDERATION_CUPS, confederationOf, confederationIndex,
} from "./confederations.js";
import { formatFor } from "./format.js";
import { mulberry32, hashInts } from "../../engine/rng.js";
import { CONFEDERATION_CUP_MIN_NATIONS } from "../constants.js";

/**
 * Confederation cups — the Euro, Copa America, AFCON and their siblings.
 *
 * These are the World Cup's smaller relations, played in the offseason two
 * years either side of it (the cycle's middle qualifying season — see
 * isConfederationCupSeason), and they reuse the World Cup's machinery almost whole:
 * the same squad selection, the same pot draw, the same group and knockout
 * functions, the same Light archival. Three things are genuinely new.
 *
 * **There is no confederation cup qualifying.** A cup's field is simply the
 * strongest nations of its confederation at the moment it is drawn, which is
 * the same ranking the Power Rankings tab shows. Qualifying already occupies
 * three of every four offseasons and runs to roughly 280 fixtures a campaign;
 * a second one, per confederation, would triple that for a competition that
 * most of the world watches rather than plays.
 *
 * **The shape varies.** Europe fields two dozen eligible nations and South
 * America five, so the format is chosen per tournament (see format.ts) rather
 * than fixed the way the World Cup's is. A confederation that cannot reach the
 * smallest supported shape holds no cup at all, which on a default
 * world is exactly what happens to Asia, North America and Oceania — every
 * player is generated from a European league's nationality table, so those
 * confederations exist only as scattered imports. Their tournaments are defined
 * and dark, and light up on their own if a world ever supports them.
 *
 * **They are played side by side, aligned on their finals.** All the live
 * cups share one group-stage click and then one click per knockout
 * round, in which each tournament plays a round only if it has as many rounds
 * left as the longest-running one does. A five-nation Copa (one round: the
 * final) therefore sits out while a sixteen-nation Euro plays its quarters and
 * semis, and the two finals land on the same click. That is what makes the
 * stage read as one summer of international football rather than three queues,
 * and it keeps the click count identical to a World Cup's.
 *
 * Every tournament runs on its own seeded rng streams, keyed off its
 * confederation's index — never the league's shared rng, and never a stream
 * shared with another cup, which would make each one's results depend
 * on the order the others happened to be played in.
 */

/**
 * rng-stream tags. Each confederation takes one draw and one group tag, and a
 * block of knockout tags wide enough for every round it could play (the
 * knockout stream has the round index added to it, and the deepest supported
 * bracket is three rounds — the block is 10 wide for headroom).
 */
const CONFEDERATION_CUP_DRAW_STREAM = 900;
const CONFEDERATION_CUP_GROUP_STREAM = 920;
const CONFEDERATION_CUP_KNOCKOUT_STREAM = 940;

function drawStream(confederation: string): number {
  return CONFEDERATION_CUP_DRAW_STREAM + confederationIndex(confederation);
}

function groupStream(confederation: string): number {
  return CONFEDERATION_CUP_GROUP_STREAM + confederationIndex(confederation);
}

function knockoutStream(confederation: string): number {
  return CONFEDERATION_CUP_KNOCKOUT_STREAM + confederationIndex(confederation) * 10;
}

/** The stream options one cup passes to the shared tournament functions. */
function playOptions(t: IntlConfederationCup) {
  return {
    groupStream: groupStream(t.confederation),
    knockoutStream: knockoutStream(t.confederation),
    qualifyPerGroup: t.qualifyPerGroup,
  };
}

/**
 * Draw every confederation cup the world can support, without playing a
 * match. Squads are named from the current player pool, each confederation's
 * strongest nations take its places, and the field is pot-drawn into groups
 * whose fixtures start unplayed.
 *
 * Player-free and shared-rng-free, so this is safe to run the instant the
 * offseason begins — the same discipline initQualifying and initTournament
 * follow. Returns an empty array on a world where no confederation can field a
 * tournament, which is the signal to skip the confederation cup stages entirely.
 */
export function initConfederationCups(
  players: Player[],
  season: number,
  lid: number,
): IntlConfederationCup[] {
  // One squad list for the whole world, strongest first, split by confederation.
  const squads = buildSquads(players);
  const byConfederation = new Map<string, NationSquad[]>();
  for (const squad of squads) {
    const conf = confederationOf(squad.nation);
    if (!conf) continue;
    const list = byConfederation.get(conf);
    if (list) list.push(squad);
    else byConfederation.set(conf, [squad]);
  }

  const out: IntlConfederationCup[] = [];
  // Iterate the spec table, not the map, so the tournaments come out in a fixed
  // order regardless of which nations happened to be eligible this season.
  for (const spec of CONFEDERATION_CUPS) {
    const available = byConfederation.get(spec.confederation) ?? [];
    if (available.length < CONFEDERATION_CUP_MIN_NATIONS) continue;
    const format = formatFor(available.length, spec.targetField);
    if (!format) continue;

    const field = available.slice(0, format.fieldSize); // already strongest first
    const seeded = field.map((_, nid) => nid);
    const drawRng = mulberry32(hashInts(lid, season, drawStream(spec.confederation), 30));
    const drawn = potDraw(seeded, format.groupCount, drawRng);
    // The group carries the confederation for display; unlike a qualifying
    // group it is not a route to anywhere, so nothing keys off it.
    const groups = drawn.map((nids, i) => buildGroup(i, nids, spec.confederation));

    out.push({
      season,
      name: spec.name,
      confederation: spec.confederation,
      qualifyPerGroup: format.qualifyPerGroup,
      nations: field.map((s) => s.nation),
      squads: field,
      groups,
      bracket: [],
      ties: [],
      championNid: null,
    });
  }
  return out;
}

/**
 * True while any drawn cup still has an unplayed group fixture — i.e.
 * there is a confederation cup group stage waiting to be played this offseason. Read
 * off the fixtures rather than a flag so it stays right across a save/reload
 * and for a save that joined the cycle midway.
 */
export function confederationCupGroupsPending(tournaments: IntlConfederationCup[]): boolean {
  return tournaments.some((t) => t.groups.some((g) => g.matches.some((m) => m.homeGoals < 0)));
}

/** True while any drawn cup still has a knockout round to play. */
export function confederationCupKnockoutPending(tournaments: IntlConfederationCup[]): boolean {
  return tournaments.some((t) => roundsRemaining(t) > 0);
}

/**
 * Play every cup's group stage (and seed each bracket). One stage
 * across all of them, since a group stage is a group stage whatever size the
 * tournament is.
 */
export function playConfederationCupGroups(
  tournaments: IntlConfederationCup[],
  players: Player[],
  lid: number,
): { tournaments: IntlConfederationCup[]; delta: CareerDelta; injured: number[] } {
  const delta = emptyCareerDelta();
  const injured = new Set<number>();
  const played = tournaments.map((t) => {
    const r = playTournamentGroups(t, players, lid, playOptions(t));
    mergeCareerDelta(delta, r.delta);
    for (const pid of r.injured) injured.add(pid);
    return { ...t, ...r.tournament };
  });
  return { tournaments: played, delta, injured: [...injured] };
}

/**
 * Play one knockout round in every cup that has as many rounds left as
 * the deepest one still running. Tournaments with fewer rounds remaining are
 * left untouched this stage and rejoin once the field has caught up with them,
 * so every final is played on the same click.
 */
export function playConfederationCupKnockoutRound(
  tournaments: IntlConfederationCup[],
  players: Player[],
  lid: number,
): { tournaments: IntlConfederationCup[]; delta: CareerDelta; injured: number[] } {
  const delta = emptyCareerDelta();
  const injured = new Set<number>();
  const deepest = Math.max(0, ...tournaments.map(roundsRemaining));
  if (deepest === 0) return { tournaments, delta, injured: [] };

  const played = tournaments.map((t) => {
    if (roundsRemaining(t) !== deepest) return t;
    const r = playTournamentRound(t, players, lid, playOptions(t));
    mergeCareerDelta(delta, r.delta);
    for (const pid of r.injured) injured.add(pid);
    return { ...t, ...r.tournament };
  });
  return { tournaments: played, delta, injured: [...injured] };
}

/**
 * Collapse finished cups into the permanent record — the same Light
 * summary a World Cup keeps, plus which confederation it was. Tournaments that
 * never produced a champion (a world too broken to resolve a bracket) are
 * dropped rather than archived half-finished.
 */
export function summarizeConfederationCups(
  tournaments: IntlConfederationCup[],
  players: Player[],
): IntlTournamentSummary[] {
  const out: IntlTournamentSummary[] = [];
  for (const t of tournaments) {
    const summary = summarize(t, players);
    if (summary) out.push({ ...summary, confederation: t.confederation });
  }
  return out;
}

/**
 * The nations that won a cup in the offseason after `season`. Read by
 * the worldwide awards, which pay a winner's medal to everyone who featured for
 * one of them (see WORLD_AWARD_CONFEDERATION_CUP_BONUS).
 */
export function confederationCupChampions(
  history: IntlTournamentSummary[],
  season: number,
): Set<string> {
  return new Set(history.filter((h) => h.season === season).map((h) => h.champion));
}
