import { simMatch } from "../engine/matchSim.js";
import type { Composites } from "../engine/composites.js";
import { generateLeague, type League } from "./league/generate.js";
import { leagueComposites } from "./league/composites.js";
import { doubleRoundRobin } from "./schedule.js";
import { computeStandings, type StandingsRow, type PlayedMatch } from "./standings.js";

export interface SeasonResult {
  league: League;
  comps: Composites[];
  matches: PlayedMatch[];
  table: StandingsRow[];
}

/**
 * Generate a league and sim one full double round-robin season, returning the
 * final table. Threads a single RNG stream through generation and every match,
 * so the whole season is deterministic for a given seed.
 */
export function simSeason(rng: () => number): SeasonResult {
  const league = generateLeague(rng);
  const comps = leagueComposites(league);
  const ids = league.teams.map((t) => t.tid);
  const matches: PlayedMatch[] = doubleRoundRobin(ids).map((f) => {
    const r = simMatch(rng, comps[f.home], comps[f.away]);
    return { home: f.home, away: f.away, homeGoals: r.home, awayGoals: r.away };
  });
  return { league, comps, matches, table: computeStandings(ids, matches) };
}
