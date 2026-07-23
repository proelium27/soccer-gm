import type { Player } from "../players/types.js";
import type { IntlTournament, IntlTournamentSummary, NationSquad } from "./types.js";
import type { CareerDelta } from "./simIntl.js";
import { buildSquads, nationMatchData } from "./squads.js";
import { buildGroup, potDraw } from "./groups.js";
import { playGroups, seedBracket, playKnockout, emptyCareerDelta, TOURNAMENT_GROUP_STREAM } from "./simIntl.js";
import { mulberry32, hashInts } from "../../engine/rng.js";
import { INTL_TOURNAMENT_NAME, INTL_FIELD_SIZE, INTL_GROUPS } from "../constants.js";

/** rng-stream tag for the tournament draw, distinct from every match stream. */
const DRAW_STREAM = 830;

/**
 * Assemble the tournament field from a qualifying campaign's list of qualifiers.
 *
 * Squads are named fresh from the *current* player pool rather than reused from
 * qualifying: a season of club football has passed in between, so ratings have
 * moved, players have retired, and injuries are different. A nation that
 * qualified but can no longer field a squad (its pool collapsed through
 * retirement) forfeits its place to the best nation that can, so the field is
 * always full.
 */
export function assembleField(qualified: string[], players: Player[]): NationSquad[] {
  const available = buildSquads(players); // strongest first
  const byNation = new Map(available.map((s) => [s.nation, s]));

  const field: NationSquad[] = [];
  for (const nation of qualified) {
    const squad = byNation.get(nation);
    if (squad) field.push(squad);
  }
  // Backfill any forfeited place with the strongest nation not already in.
  if (field.length < INTL_FIELD_SIZE) {
    const inField = new Set(field.map((s) => s.nation));
    for (const squad of available) {
      if (field.length >= INTL_FIELD_SIZE) break;
      if (!inField.has(squad.nation)) field.push(squad);
    }
  }
  return field
    .slice(0, INTL_FIELD_SIZE)
    .sort((a, b) => b.rating - a.rating || a.nation.localeCompare(b.nation));
}

/**
 * Play a whole tournament in one pass: pot draw into INTL_GROUPS groups, a
 * single round-robin in each, then the knockout its top finishers seed. Returns
 * the finished tournament plus the international appearances it generated.
 * Null when the field can't be filled (see assembleField).
 */
export function runTournament(
  qualified: string[],
  players: Player[],
  season: number,
  lid: number,
): { tournament: IntlTournament; delta: CareerDelta } | null {
  const squads = assembleField(qualified, players);
  if (squads.length < INTL_FIELD_SIZE) return null;

  const nations = squads.map((s) => s.nation);
  const seeded = squads.map((_, nid) => nid); // already strongest-first
  const drawRng = mulberry32(hashInts(lid, season, DRAW_STREAM, 30));
  const drawn = potDraw(seeded, INTL_GROUPS, drawRng);
  const groups = drawn.map((nids, i) => buildGroup(i, nids, null));

  const delta = emptyCareerDelta();
  const matchData = nationMatchData(squads, players);
  const played = playGroups(groups, matchData, lid, season, TOURNAMENT_GROUP_STREAM, true, delta);

  const bracket = seedBracket(played);
  const { ties, championNid } = playKnockout(bracket, matchData, lid, season, delta);

  return {
    tournament: {
      season,
      name: INTL_TOURNAMENT_NAME,
      nations,
      squads,
      groups: played,
      bracket,
      ties,
      championNid,
    },
    delta,
  };
}

/** The final tie, i.e. the last round played. Null if the knockout never completed. */
export function finalTie(tournament: IntlTournament) {
  if (tournament.ties.length === 0) return null;
  const lastRound = Math.max(...tournament.ties.map((t) => t.round));
  return tournament.ties.find((t) => t.round === lastRound) ?? null;
}

/** Goals scored by each player across a tournament's kept box scores. */
export function tournamentGoals(tournament: IntlTournament): Map<number, number> {
  const goals = new Map<number, number>();
  const add = (pid: number, n: number): void => {
    if (n > 0) goals.set(pid, (goals.get(pid) ?? 0) + n);
  };
  for (const group of tournament.groups) {
    for (const m of group.matches) {
      if (!m.boxScore) continue;
      for (const line of [...m.boxScore.home, ...m.boxScore.away]) add(line.pid, line.goals);
    }
  }
  for (const tie of tournament.ties) {
    for (const line of [...tie.boxScore.home, ...tie.boxScore.away]) add(line.pid, line.goals);
  }
  return goals;
}

/**
 * Collapse a finished tournament into the small record kept forever (see
 * IntlTournamentSummary for why the full thing isn't). Returns null if the
 * tournament never produced a champion.
 */
export function summarize(tournament: IntlTournament, players: Player[]): IntlTournamentSummary | null {
  const final = finalTie(tournament);
  if (final === null || tournament.championNid === null) return null;

  const championNid = tournament.championNid;
  const runnerUpNid = final.winner === final.home ? final.away : final.home;
  const championIsHome = final.home === championNid;

  const goals = tournamentGoals(tournament);
  const byPid = new Map(players.map((p) => [p.pid, p]));
  let topScorer: IntlTournamentSummary["topScorer"] = null;
  for (const [pid, n] of [...goals.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])) {
    const player = byPid.get(pid);
    if (!player) continue;
    topScorer = { pid, nation: player.nationality, goals: n };
    break;
  }

  return {
    season: tournament.season,
    name: tournament.name,
    champion: tournament.nations[championNid],
    runnerUp: tournament.nations[runnerUpNid],
    finalScore: {
      champion: championIsHome ? final.homeGoals : final.awayGoals,
      runnerUp: championIsHome ? final.awayGoals : final.homeGoals,
      pens: final.wentToPens
        ? {
          champion: championIsHome ? final.homePens : final.awayPens,
          runnerUp: championIsHome ? final.awayPens : final.homePens,
        }
        : null,
    },
    topScorer,
    field: tournament.nations,
  };
}
