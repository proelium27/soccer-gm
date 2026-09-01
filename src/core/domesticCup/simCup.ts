import type { Competition } from "../competitions.js";
import type { TeamMatchData } from "../league/composites.js";
import type { CupTie } from "../cup/types.js";
import type { DomesticCupState } from "./types.js";
import { mulberry32, hashInts } from "../../engine/rng.js";
import { resolveCupTie } from "../cup/simCup.js";
import {
  pendingRound, advanceDomesticCup, domesticPrizeForRound, roundsFromFinal,
  DOMESTIC_TIE_STREAM,
} from "./cup.js";
import { DOMESTIC_CUP_PRIZE_RUNNER_UP, DOMESTIC_CUP_GLAMOUR_TIE_BONUS } from "../constants.js";

/**
 * Play the round of `cup` that is due, then advance the cup (draw the next
 * round from the winners, or crown the champion).
 *
 * Every tie is single-leg: 90', extra time if level, shootout if still level —
 * the same resolveCupTie the Continental Cup's final uses, so a domestic tie and
 * a European one are resolved by identical code.
 *
 * Runs on its own seeded stream keyed by (lid, season, competition, round), never
 * the shared league rng, so adding a domestic cup cannot shift a single league
 * scoreline. Prizes come back already multiplied by each club's `financeScale`
 * (see DOMESTIC_CUP_PRIZE_BY_ROUNDS_FROM_FINAL for why that scaling matters).
 */
export function playDomesticRound(
  cup: DomesticCupState,
  competitions: Competition[],
  matchData: Map<number, TeamMatchData>,
  lid: number,
  financeScaleOf: (tid: number) => number,
  tierOf: (tid: number) => number,
): { cup: DomesticCupState; ties: CupTie[]; prizes: Map<number, number> } {
  const round = pendingRound(cup);
  if (!round) return { cup, ties: [], prizes: new Map() };

  const tier1 = competitions.find((c) => c.country === cup.country && c.tier === 1);
  const compId = tier1?.id ?? competitions.find((c) => c.country === cup.country)?.id ?? 0;
  const rng = mulberry32(hashInts(lid, cup.season, compId, round.round, DOMESTIC_TIE_STREAM));

  const ties: CupTie[] = [];
  for (const { home, away } of round.pairings) {
    const hd = matchData.get(home);
    const ad = matchData.get(away);
    if (hd && ad) {
      ties.push(resolveCupTie(rng, home, away, hd, ad, round.round, round.matchday));
      continue;
    }
    // A club with no match data can't be fielded — only reachable if a club
    // vanished between the draw and the tie. Award a walkover rather than
    // dropping the tie: every pairing must produce exactly one winner, or the
    // next round is drawn from an odd number of survivors and one is lost.
    // The home side goes through unless it is the one that can't be fielded,
    // so the outcome is defined even in the (unreachable) neither-side case.
    const winner = hd || !ad ? home : away;
    ties.push({
      round: round.round, matchday: round.matchday, home, away,
      homeGoals: winner === home ? 1 : 0,
      awayGoals: winner === away ? 1 : 0,
      wentToExtraTime: false, wentToPens: false, homePens: 0, awayPens: 0,
      winner, boxScore: null,
    });
  }

  const prizes = new Map<number, number>();
  const credit = (tid: number, amount: number): void => {
    if (amount <= 0) return;
    prizes.set(tid, (prizes.get(tid) ?? 0) + amount * financeScaleOf(tid));
  };
  const winPrize = domesticPrizeForRound(cup, round.round);
  for (const tie of ties) {
    credit(tie.winner, winPrize);
    // Glamour-tie gate receipts: the smaller club is paid for meeting a club
    // from the division above, win or lose, because that is what a cup run is
    // really worth to it. See DOMESTIC_CUP_GLAMOUR_TIE_BONUS for why only the
    // smaller side is paid and why this is credited off the result.
    const homeTier = tierOf(tie.home);
    const awayTier = tierOf(tie.away);
    if (homeTier !== awayTier) {
      credit(homeTier > awayTier ? tie.home : tie.away, DOMESTIC_CUP_GLAMOUR_TIE_BONUS);
    }
    // The final's loser is the only beaten side that gets paid, matching the
    // Continental Cup's runner-up cheque.
    if (roundsFromFinal(cup, round.round) === 0) {
      credit(tie.winner === tie.home ? tie.away : tie.home, DOMESTIC_CUP_PRIZE_RUNNER_UP);
    }
  }

  return { cup: advanceDomesticCup(cup, competitions, ties), ties, prizes };
}
