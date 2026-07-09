import type { StandingsRow } from "../standings.js";
import { HYPE_MAX, HYPE_MIN, HYPE_SMOOTHING, NUM_TEAMS } from "../constants.js";
import { clamp } from "../util.js";

/**
 * Season-end hype target: blends points-per-game (form) with final rank
 * (prestige), each mapped to 0-100, so a mid-table team with a great points
 * total and a top-of-the-table team with a mediocre one both land somewhere
 * sensible rather than only rank or only points mattering.
 */
function hypeTarget(row: StandingsRow, rank: number): number {
  const maxPoints = row.played * 3;
  const formScore = maxPoints > 0 ? (row.points / maxPoints) * 100 : 50;
  const rankScore = ((NUM_TEAMS - rank) / (NUM_TEAMS - 1)) * 100;
  return (formScore + rankScore) / 2;
}

/**
 * Move a club's hype a fraction of the way toward this season's performance
 * target. `rank` is 1-indexed final domestic standing.
 */
export function updateHype(currentHype: number, row: StandingsRow, rank: number): number {
  const target = hypeTarget(row, rank);
  const next = currentHype + HYPE_SMOOTHING * (target - currentHype);
  return clamp(next, HYPE_MIN, HYPE_MAX);
}
