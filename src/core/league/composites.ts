import type { Composites } from "../../engine/composites.js";
import type { Player } from "../players/types.js";
import type { MatchPlayer } from "../../engine/attribution.js";
import type { League } from "./generate.js";
import { selectXI } from "../lineup/selectXI.js";
import { FORMATIONS } from "../lineup/formations.js";
import { rollupComposites } from "../composites.js";
import { normalizeLeague } from "./normalize.js";
import { toMatchPlayers } from "./matchPlayers.js";

export interface TeamMatchData {
  composites: Composites;
  xi: MatchPlayer[];
}

/**
 * Full pipeline: for each team, pick a default 4-3-3 XI, roll up raw composites,
 * then z-normalize across the league. Returns both composites and XIs for attribution.
 */
export function leagueMatchData(league: League): TeamMatchData[] {
  const byPid = new Map<number, Player>(league.players.map((p) => [p.pid, p]));
  const xis: Player[][] = [];
  const raw = league.teams.map((t) => {
    const roster = t.roster.map((pid) => byPid.get(pid)!);
    const xi = selectXI(roster, FORMATIONS["4-3-3"]);
    xis.push(xi);
    return rollupComposites(xi, t.name);
  });
  const normalized = normalizeLeague(raw);
  return normalized.map((c, i) => ({
    composites: c,
    xi: toMatchPlayers(xis[i]),
  }));
}

export function leagueComposites(league: League): Composites[] {
  return leagueMatchData(league).map((d) => d.composites);
}
