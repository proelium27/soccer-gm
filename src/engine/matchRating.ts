import type { MatchPosition, PlayerMatchLine } from "./attribution.js";

type PositionGroup = "GK" | "DEF" | "MID" | "FWD";

function positionGroup(pos: MatchPosition): PositionGroup {
  switch (pos) {
    case "GK": return "GK";
    case "CB": case "FB": return "DEF";
    case "DM": case "CM": case "AM": return "MID";
    case "W": case "ST": return "FWD";
  }
}

// FotMob-style weighting matrix, position-by-stat. Columns we don't have data
// for (big chances created, pass accuracy, own goals, errors leading to a
// goal, and a separate penalty-save flag — PlayerMatchLine.saves is generic)
// are simply omitted rather than estimated.
const GOAL_WEIGHT: Record<PositionGroup, number> = { FWD: 1.0, MID: 1.2, DEF: 1.5, GK: 2.5 };
const ASSIST_WEIGHT: Record<PositionGroup, number> = { FWD: 0.6, MID: 0.8, DEF: 1.0, GK: 2.0 };
const SOT_WEIGHT: Record<PositionGroup, number> = { FWD: 0.15, MID: 0.15, DEF: 0.2, GK: 0 };
const TACKLE_WEIGHT: Record<PositionGroup, number> = { FWD: 0.05, MID: 0.15, DEF: 0.2, GK: 0 };
// Same magnitude as TACKLE_WEIGHT for now (no audit data yet to justify a different
// value per the design doc) — aliased rather than a separate literal so a future
// retune of one requires deliberately forking this line, not an accidental drift.
const INTERCEPTION_WEIGHT: Record<PositionGroup, number> = TACKLE_WEIGHT;
const CLEAN_SHEET_BONUS: Record<PositionGroup, number> = { FWD: 0, MID: 0.2, DEF: 0.8, GK: 1.0 };
const GOAL_CONCEDED_PENALTY: Record<PositionGroup, number> = { FWD: 0, MID: 0.05, DEF: 0.15, GK: 0.25 };

const RATING_MIN = 0;
const RATING_MAX = 10;
export const RATING_BASELINE = 6.0;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * FotMob-style 1-10 match performance rating, built purely from box-score
 * stats and a per-position weighting matrix (no market-value/OVR input).
 * Full weights and rationale in CLAUDE.md's Match Rating section. A player's
 * swing away from the 6.0 baseline is damped by minutes played, so a brief
 * cameo can't produce as extreme a rating as a full 90.
 */
export function computeMatchRating(
  line: PlayerMatchLine,
  pos: MatchPosition,
  minutesPlayed: number,
  teamGoalsAgainst: number,
): number {
  const group = positionGroup(pos);
  let rating = RATING_BASELINE;

  rating += line.goals * GOAL_WEIGHT[group];
  rating += line.assists * ASSIST_WEIGHT[group];
  rating += line.shotsOnTarget * SOT_WEIGHT[group];
  rating += line.tackles * TACKLE_WEIGHT[group];
  rating += line.interceptions * INTERCEPTION_WEIGHT[group];
  if (group === "GK") rating += line.saves * 0.25;

  if (teamGoalsAgainst === 0 && minutesPlayed > 45) {
    rating += CLEAN_SHEET_BONUS[group];
  }
  rating -= teamGoalsAgainst * GOAL_CONCEDED_PENALTY[group];

  rating -= line.yellowCards * 0.3;
  rating -= line.redCards * 1.5;

  const minutesFrac = clamp(minutesPlayed / 90, 0, 1);
  rating = RATING_BASELINE + (rating - RATING_BASELINE) * (0.3 + 0.7 * minutesFrac);

  return clamp(Math.round(rating * 10) / 10, RATING_MIN, RATING_MAX);
}
