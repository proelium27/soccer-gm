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
