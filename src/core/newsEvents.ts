import type { Player } from "./players/types.js";
import type { PlayedMatch } from "./standings.js";
import { NEWS_STANDOUT_RATING_FLOOR, NEWS_GOAL_MILESTONE_STEP } from "./constants.js";

export type NewsEventType =
  | "hattrick"
  | "standoutRating"
  | "goalMilestoneSeason"
  | "goalMilestoneCareer";

/**
 * A player accomplishment surfaced on the News Feed, interleaved there with
 * transfers. Unlike per-match box scores (wiped every offseason), these are
 * detected once at match-sim time and persisted forever — see simThrough.ts.
 */
export interface NewsEvent {
  type: NewsEventType;
  pid: number;
  tid: number;
  season: number;
  matchday: number;
  /**
   * Interpreted per `type`: hattrick = goals scored this match;
   * standoutRating = rating × 10 (integer); goalMilestoneSeason /
   * goalMilestoneCareer = the milestone crossed (10, 20, 30...).
   */
  detail: number;
}

/** Each player's season-to-date and all-time (career) goal totals, as of a point in time. */
export function playerGoalTotals(
  players: Player[],
  season: number,
): Map<number, { season: number; career: number }> {
  const map = new Map<number, { season: number; career: number }>();
  for (const p of players) {
    const career = p.stats.reduce((sum, s) => sum + s.goals, 0);
    const seasonGoals = p.stats.find((s) => s.season === season)?.goals ?? 0;
    map.set(p.pid, { season: seasonGoals, career });
  }
  return map;
}

interface AttributedLine {
  pid: number;
  tid: number;
  goals: number;
  rating: number;
}

function attributedLines(mdResults: PlayedMatch[]): AttributedLine[] {
  const out: AttributedLine[] = [];
  for (const m of mdResults) {
    for (const line of m.boxScore.home) {
      out.push({ pid: line.pid, tid: m.home, goals: line.goals, rating: line.rating });
    }
    for (const line of m.boxScore.away) {
      out.push({ pid: line.pid, tid: m.away, goals: line.goals, rating: line.rating });
    }
  }
  return out;
}

/**
 * Detects hat-tricks, the matchday's standout rating, and goal-milestone
 * crossings from one matchday's completed matches. Pure — the caller
 * (simThrough.ts) supplies goal totals captured immediately before and after
 * this matchday's stats were folded into SeasonStats.
 */
export function detectMatchdayNewsEvents(
  mdResults: PlayedMatch[],
  season: number,
  matchday: number,
  goalTotalsBefore: Map<number, { season: number; career: number }>,
  goalTotalsAfter: Map<number, { season: number; career: number }>,
): NewsEvent[] {
  const lines = attributedLines(mdResults);
  const events: NewsEvent[] = [];

  for (const line of lines) {
    if (line.goals >= 3) {
      events.push({ type: "hattrick", pid: line.pid, tid: line.tid, season, matchday, detail: line.goals });
    }
  }

  let best: AttributedLine | null = null;
  for (const line of lines) {
    if (best === null || line.rating > best.rating) best = line;
  }
  if (best !== null && best.rating >= NEWS_STANDOUT_RATING_FLOOR) {
    events.push({
      type: "standoutRating", pid: best.pid, tid: best.tid, season, matchday,
      detail: Math.round(best.rating * 10),
    });
  }

  for (const line of lines) {
    if (line.goals <= 0) continue;
    const before = goalTotalsBefore.get(line.pid);
    const after = goalTotalsAfter.get(line.pid);
    if (!before || !after) continue;

    const seasonMilestone = Math.floor(after.season / NEWS_GOAL_MILESTONE_STEP);
    if (Math.floor(before.season / NEWS_GOAL_MILESTONE_STEP) < seasonMilestone) {
      events.push({
        type: "goalMilestoneSeason", pid: line.pid, tid: line.tid, season, matchday,
        detail: seasonMilestone * NEWS_GOAL_MILESTONE_STEP,
      });
    }

    const careerMilestone = Math.floor(after.career / NEWS_GOAL_MILESTONE_STEP);
    if (Math.floor(before.career / NEWS_GOAL_MILESTONE_STEP) < careerMilestone) {
      events.push({
        type: "goalMilestoneCareer", pid: line.pid, tid: line.tid, season, matchday,
        detail: careerMilestone * NEWS_GOAL_MILESTONE_STEP,
      });
    }
  }

  return events;
}
