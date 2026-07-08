import type { Composites } from "../../engine/composites.js";
import type { Player } from "../players/types.js";
import type { League } from "./generate.js";
import { selectXI } from "../lineup/selectXI.js";
import { FORMATIONS } from "../lineup/formations.js";
import { rollupComposites } from "../composites.js";
import { normalizeLeague } from "./normalize.js";

/**
 * Full pipeline: for each team, pick a default 4-3-3 XI, roll up raw composites,
 * then z-normalize across the league. The result is what the engine consumes.
 */
export function leagueComposites(league: League): Composites[] {
  const byPid = new Map<number, Player>(league.players.map((p) => [p.pid, p]));
  const raw = league.teams.map((t) => {
    const roster = t.roster.map((pid) => byPid.get(pid)!);
    const xi = selectXI(roster, FORMATIONS["4-3-3"]);
    return rollupComposites(xi, t.name);
  });
  return normalizeLeague(raw);
}
