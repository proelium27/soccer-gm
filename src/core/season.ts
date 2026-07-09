import { simMatchDetailed } from "../engine/matchSim.js";
import type { Composites } from "../engine/composites.js";
import { generateLeague, type League } from "./league/generate.js";
import { leagueMatchData } from "./league/composites.js";
import { doubleRoundRobin } from "./schedule.js";
import { computeStandings, type StandingsRow, type PlayedMatch } from "./standings.js";

export interface SeasonResult {
  league: League;
  comps: Composites[];
  matches: PlayedMatch[];
  table: StandingsRow[];
}

export function simSeason(rng: () => number): SeasonResult {
  const league = generateLeague(rng);
  const matchData = leagueMatchData(league);
  const comps = matchData.map((d) => d.composites);
  const ids = league.teams.map((t) => t.tid);
  let matchdayCounter = 0;
  const matches: PlayedMatch[] = doubleRoundRobin(ids).map((f) => {
    matchdayCounter++;
    const hd = matchData[f.home];
    const ad = matchData[f.away];
    const r = simMatchDetailed(rng, hd.composites, ad.composites, hd.xi, ad.xi);
    return {
      home: f.home,
      away: f.away,
      homeGoals: r.home,
      awayGoals: r.away,
      possessionHome: r.possessionHome,
      matchday: matchdayCounter,
      boxScore: r.boxScore,
    };
  });
  return { league, comps, matches, table: computeStandings(ids, matches) };
}
