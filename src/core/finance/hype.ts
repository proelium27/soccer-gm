import type { StandingsRow } from "../standings.js";
import { HYPE_MAX, HYPE_MIN, HYPE_SMOOTHING, NUM_TEAMS } from "../constants.js";
import { clamp } from "../util.js";

/**
 * Season-end hype target: blends points-per-game (form) with final rank
 * (prestige), each mapped to 0-100, so a mid-table team with a great points
 * total and a top-of-the-table team with a mediocre one both land somewhere
 * sensible rather than only rank or only points mattering.
 */
function hypeTarget(row: StandingsRow, rank: number, leagueSize: number): number {
  const maxPoints = row.played * 3;
  const formScore = maxPoints > 0 ? (row.points / maxPoints) * 100 : 50;
  // Scaled against the club's OWN division size: finishing 8th of 8 is bottom
  // and has to score like it, not like 8th of 20.
  const rankScore = leagueSize > 1 ? ((leagueSize - rank) / (leagueSize - 1)) * 100 : 50;
  return (formScore + rankScore) / 2;
}

/**
 * Move a club's hype a fraction of the way toward this season's performance
 * target. `rank` is 1-indexed final domestic standing.
 */
export function updateHype(
  currentHype: number,
  row: StandingsRow,
  rank: number,
  /** Clubs in this club's own division. Defaults to the shipped size. */
  leagueSize: number = NUM_TEAMS,
): number {
  const target = hypeTarget(row, rank, leagueSize);
  const next = currentHype + HYPE_SMOOTHING * (target - currentHype);
  return clamp(next, HYPE_MIN, HYPE_MAX);
}
