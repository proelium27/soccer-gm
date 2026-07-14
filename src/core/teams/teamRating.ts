import type { Player } from "../players/types.js";
import { resolveXI } from "../lineup/resolveXI.js";
import { FORMATIONS } from "../lineup/formations.js";
import {
  BENCH_SIZE,
  TEAM_RATING_STARTER_WEIGHT,
  TEAM_RATING_BENCH_BASE_WEIGHT,
  TEAM_RATING_BENCH_DECAY,
} from "../constants.js";

export interface TeamRating {
  ovr: number;
  pot: number;
}

/**
 * A club's OVR/POT: a depth-weighted average across its starting XI and
 * bench (see TEAM_RATING_* in constants.ts for why), not a plain mean of
 * the whole roster. Reuses resolveXI so a user's manual lineup choice is
 * reflected, and falls back to the auto-picked best XI otherwise (AI teams
 * always take this path, since only the user's team ever sets `starters`).
 */
export function computeTeamRating(
  roster: Player[],
  starters: number[] | null | undefined,
): TeamRating {
  if (roster.length === 0) return { ovr: 0, pot: 0 };

  const xi = resolveXI(roster, FORMATIONS["4-3-3"], starters);
  const xiPids = new Set(xi.map((p) => p.pid));
  const bench = roster
    .filter((p) => !xiPids.has(p.pid))
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, BENCH_SIZE);

  const weighted: [Player, number][] = [
    ...xi.map((p): [Player, number] => [p, TEAM_RATING_STARTER_WEIGHT]),
    ...bench.map((p, i): [Player, number] => [
      p,
      TEAM_RATING_BENCH_BASE_WEIGHT * TEAM_RATING_BENCH_DECAY ** i,
    ]),
  ];

  const totalWeight = weighted.reduce((sum, [, w]) => sum + w, 0);
  const ovr = weighted.reduce((sum, [p, w]) => sum + p.ovr * w, 0) / totalWeight;
  const pot = weighted.reduce((sum, [p, w]) => sum + p.potential * w, 0) / totalWeight;

  return { ovr: Math.round(ovr), pot: Math.round(pot) };
}
