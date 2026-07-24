import type { Player } from "../players/types.js";
import type {
  IntlTournament, IntlTournamentSummary, IntlQualifyingCampaign, IntlQualifyingSummary, NationSquad,
} from "./types.js";
import type { CareerDelta } from "./simIntl.js";
import { buildSquads, nationMatchData } from "./squads.js";
import { buildGroup, potDraw, groupTableSummary } from "./groups.js";
import {
  playGroups, seedBracket, playKnockoutRound,
  emptyCareerDelta, mergeCareerDelta, TOURNAMENT_GROUP_STREAM,
} from "./simIntl.js";
import type { CupTie } from "../cup/types.js";
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
 * Draw a tournament without playing a match: assemble the field from the
 * qualifiers, pot-draw them into INTL_GROUPS groups whose fixtures start
 * unplayed, and leave the bracket empty (it can only be seeded once the groups
 * are played). No player is touched and no shared-stream rng is drawn, so this
 * is safe to run the instant the offseason begins. Null when the field can't be
 * filled (see assembleField).
 */
export function initTournament(
  qualified: string[],
  players: Player[],
  season: number,
  lid: number,
): IntlTournament | null {
  const squads = assembleField(qualified, players);
  if (squads.length < INTL_FIELD_SIZE) return null;

  const nations = squads.map((s) => s.nation);
  const seeded = squads.map((_, nid) => nid); // already strongest-first
  const drawRng = mulberry32(hashInts(lid, season, DRAW_STREAM, 30));
  const drawn = potDraw(seeded, INTL_GROUPS, drawRng);
  const groups = drawn.map((nids, i) => buildGroup(i, nids, null));

  return { season, name: INTL_TOURNAMENT_NAME, nations, squads, groups, bracket: [], ties: [], championNid: null };
}

/**
 * Play a drawn tournament's group stage, then seed the knockout bracket from the
 * final tables. Returns the tournament with played groups and a filled bracket,
 * plus the group-stage appearances.
 */
export function playTournamentGroups(
  tournament: IntlTournament,
  players: Player[],
  lid: number,
): { tournament: IntlTournament; delta: CareerDelta; injured: number[] } {
  const delta = emptyCareerDelta();
  const injured = new Set<number>();
  const matchData = nationMatchData(tournament.squads, players);
  const played = playGroups(tournament.groups, matchData, lid, tournament.season, TOURNAMENT_GROUP_STREAM, true, delta, injured);
  const bracket = seedBracket(played);
  return { tournament: { ...tournament, groups: played, bracket }, delta, injured: [...injured] };
}

/**
 * The nids contesting the next knockout round: the seeded bracket if no round
 * has been played yet, otherwise the winners of the most recent round in the
 * order they were played (which is the pairing order for the round to come).
 */
function nextKnockoutRound(tournament: IntlTournament): { round: number; field: number[] } {
  if (tournament.ties.length === 0) return { round: 0, field: [...tournament.bracket] };
  const lastRound = Math.max(...tournament.ties.map((t) => t.round));
  const field = tournament.ties.filter((t) => t.round === lastRound).map((t) => t.winner);
  return { round: lastRound + 1, field };
}

/**
 * Play exactly the next knockout round (QF, then SF, then final) of a tournament
 * whose groups are already played. Each round owns its seed, so playing them one
 * at a time is byte-identical to playKnockout's one-pass loop. Sets championNid
 * when the round leaves a single nation standing.
 */
export function playTournamentRound(
  tournament: IntlTournament,
  players: Player[],
  lid: number,
): { tournament: IntlTournament; delta: CareerDelta; injured: number[] } {
  const delta = emptyCareerDelta();
  const injured = new Set<number>();
  const matchData = nationMatchData(tournament.squads, players);
  const { round, field } = nextKnockoutRound(tournament);
  const { ties, winners } = playKnockoutRound(field, matchData, lid, tournament.season, round, delta, injured);
  const nextTies: CupTie[] = [...tournament.ties, ...ties];
  const championNid = winners.length === 1 ? winners[0] : tournament.championNid;
  return { tournament: { ...tournament, ties: nextTies, championNid }, delta, injured: [...injured] };
}

/**
 * Play a whole tournament in one pass: pot draw, group stage, then the knockout.
 * The bulk path behind "Sim through the World Cup" and the equivalence baseline
 * for the staged path — it drives the very same stage functions the staged
 * offseason clicks through. Null when the field can't be filled (see
 * assembleField).
 */
export function runTournament(
  qualified: string[],
  players: Player[],
  season: number,
  lid: number,
): { tournament: IntlTournament; delta: CareerDelta; injured: number[] } | null {
  const drawn = initTournament(qualified, players, season, lid);
  if (!drawn) return null;

  const delta = emptyCareerDelta();
  const injured = new Set<number>();
  let stage = playTournamentGroups(drawn, players, lid);
  mergeCareerDelta(delta, stage.delta);
  for (const pid of stage.injured) injured.add(pid);
  let tournament = stage.tournament;
  while (tournament.championNid === null) {
    stage = playTournamentRound(tournament, players, lid);
    mergeCareerDelta(delta, stage.delta);
    for (const pid of stage.injured) injured.add(pid);
    // Defensive: a bracket that can never resolve (missing match data) would
    // otherwise spin forever — bail if a round advances nobody.
    if (stage.tournament.ties.length === tournament.ties.length) break;
    tournament = stage.tournament;
  }

  return { tournament, delta, injured: [...injured] };
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
    // Light archival: final group tables + every knockout scoreline, enough to
    // redraw the tournament and derive each nation's finish without its squads.
    groups: tournament.groups.map((g) => groupTableSummary(g, tournament.nations)),
    knockout: tournament.ties.map((t) => ({
      round: t.round,
      home: tournament.nations[t.home],
      away: tournament.nations[t.away],
      homeGoals: t.homeGoals,
      awayGoals: t.awayGoals,
      winner: tournament.nations[t.winner],
      pens: t.wentToPens ? { home: t.homePens, away: t.awayPens } : null,
    })),
  };
}

/**
 * Collapse a finished qualifying campaign into its Light archived form: final
 * group tables and the qualifiers, no per-match detail (the current campaign
 * keeps that in full until the next one replaces it).
 */
export function summarizeQualifying(campaign: IntlQualifyingCampaign): IntlQualifyingSummary {
  return {
    season: campaign.season,
    entered: campaign.nations.length,
    groups: campaign.groups.map((g) => groupTableSummary(g, campaign.nations)),
    qualified: campaign.qualified,
  };
}
