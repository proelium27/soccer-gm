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
 * A preliminary play-in round: the two weak-league (France/Portugal) champions
 * and the two weakest big-four qualifiers fight for the last two bracket places.
 * `teams` holds the four participants in tie order — (teams[0] vs teams[1])
 * feeds bracket slot `slots[0]`, (teams[2] vs teams[3]) feeds `slots[1]`, where
 * each slot is an index into CupState.teams. `ties` is empty until the round is
 * played (on CUP_PLAYIN_MATCHDAY), then holds the two completed ties whose
 * winners have been written into CupState.teams at `slots`.
 */
export interface CupPlayIn {
  teams: number[]; // 4 tids, tie order
  slots: number[]; // 2 CupState.teams indices the two winners fill
  matchday: number;
  ties: CupTie[]; // 2 once played
}

/**
 * One season's Continental Cup. `teams` is the 16 qualifiers in *bracket
 * order* — round-of-16 pairings are (teams[0] vs teams[1]), (teams[2] vs
 * teams[3]), … — so no seed math is needed at play time; later rounds pair up
 * the previous round's winners in the same order. When there's a play-in, two
 * of the 16 slots start as -1 and are filled by the play-in winners before R16.
 * `ties` accumulates every completed knockout tie (a full round is played
 * atomically). `seeds` records each club's seed for display.
 */
export interface CupState {
  /** The season this cup is played during (qualifiers came from season − 1's tables). */
  season: number;
  name: string;
  teams: number[]; // 16 tids, bracket order (-1 in a play-in slot until filled)
  /** tid → 1-based seed (1 = top seed), for display. */
  seeds: Record<number, number>;
  /** The preliminary play-in, or null when the world fields an exact 16-team bracket. */
  playIn: CupPlayIn | null;
  ties: CupTie[];
  championTid: number | null;
}
