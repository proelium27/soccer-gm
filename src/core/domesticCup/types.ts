import type { CupTie } from "../cup/types.js";
import type { CupPlayerLine } from "../cup/cupStats.js";

/**
 * One round of a domestic cup.
 *
 * A round exists as soon as it is *drawn*, with `pairings` filled and `ties`
 * empty; playing it fills `ties` (one per pairing, same order). Because the
 * draw is open, round r+1 only comes into being once round r has been played —
 * so `DomesticCupState.rounds` is the rounds so far, never the whole path.
 */
export interface DomesticCupRound {
  /** 0-based round index, counting from the cup's first round. */
  round: number;
  /** League matchday this round is played on (see DOMESTIC_CUP_MATCHDAYS). */
  matchday: number;
  /** The draw: home side first. Fixed once drawn. */
  pairings: { home: number; away: number }[];
  /** One completed tie per pairing, in the same order. Empty until played. */
  ties: CupTie[];
  /**
   * Clubs that sat this round out — only ever non-empty for a preliminary
   * round, where the field isn't a power of two and the higher-ranked clubs
   * enter later. Kept so the UI can say who had a bye rather than leaving them
   * unexplained until they appear in the next round.
   */
  byes: number[];
}

/**
 * One season of one country's domestic cup: a straight single-leg knockout
 * contested by BOTH the country's divisions, drawn open round by round.
 *
 * Single-leg throughout — level after 90' goes to extra time and then a
 * shootout (the same resolveCupTie the Continental Cup's final uses), so a tie
 * always produces a winner on the day and a round always fits one matchday.
 */
export interface DomesticCupState {
  /** The season this cup is played during. */
  season: number;
  country: string;
  /** Display name, e.g. "English Cup" (see COUNTRY_CUP_ADJECTIVE). */
  name: string;
  /** Every club that entered, strongest first by last season's finish. */
  teams: number[];
  /** Rounds drawn so far, oldest first. The last one is the round in progress. */
  rounds: DomesticCupRound[];
  /**
   * How many rounds this cup will have in total. Known up front from the field
   * size even though the draws aren't, so the UI can label a round by how far
   * it is from the final ("Quarter-final", not "Round 4") before it is drawn.
   */
  totalRounds: number;
  championTid: number | null;
  /**
   * Per-player totals for this cup, set when it is archived and null while it
   * is live — exactly like CupState.statLines, and for the same reason:
   * archiving folds every round's box scores into these lines and drops the box
   * scores, because save size is what freezes the game (see CLAUDE.md).
   */
  statLines: CupPlayerLine[] | null;
}
