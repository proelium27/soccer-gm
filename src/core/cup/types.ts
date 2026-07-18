import type { BoxScore } from "../../engine/attribution.js";

/**
 * One completed knockout tie. Scoreline is regulation + extra time; a shootout
 * only decides the winner and is recorded separately in homePens/awayPens
 * (shootout kicks are NOT counted as goals, matching real-football convention).
 */
export interface CupTie {
  /** 0 = Round of 16, 1 = Quarter-final, 2 = Semi-final, 3 = Final. */
  round: number;
  /** League matchday this tie was played on (see CUP_ROUND_MATCHDAYS). */
  matchday: number;
  home: number; // tid
  away: number; // tid
  homeGoals: number; // after extra time
  awayGoals: number;
  wentToExtraTime: boolean;
  wentToPens: boolean;
  homePens: number;
  awayPens: number;
  winner: number; // tid
  boxScore: BoxScore;
}

/**
 * One season's Continental Cup. `teams` is the 16 qualifiers in *bracket
 * order* — round-of-16 pairings are (teams[0] vs teams[1]), (teams[2] vs
 * teams[3]), … — so no seed math is needed at play time; later rounds pair up
 * the previous round's winners in the same order. `ties` accumulates every
 * completed tie (a full round is played atomically). `seeds` records each
 * club's 1–16 seed for display.
 */
export interface CupState {
  /** The season this cup is played during (qualifiers came from season − 1's tables). */
  season: number;
  name: string;
  teams: number[]; // 16 tids, bracket order
  /** tid → 1-based seed (1 = top seed), for display. */
  seeds: Record<number, number>;
  ties: CupTie[];
  championTid: number | null;
}
