import type { PromotionPlayoff } from "./promotionPlayoff.js";
import { PLAYOFF_ROUND_FINAL } from "./promotionPlayoff.js";

/** One promotion playoff, reported as the news it is: who went up, and how. */
export interface PromotionNews {
  country: string;
  /** The division the winner is promoted into. */
  d1CompId: number;
  /** The division he came out of. */
  d2CompId: number;
  /** The club promoted. */
  tid: number;
  /** His tier-2 finishing position — the whole point of a playoff is that this needn't be first. */
  position: number;
  /** The beaten finalist. */
  runnerUpTid: number;
  /** The final's scoreline, winner first, with a shootout appended if it went there. */
  score: string;
}

/**
 * Every promotion playoff the save has a result for, bucketed by the season it
 * decided.
 *
 * **Derived, like the trophies in `trophyNews.ts` and the honours in
 * `awardNews.ts`, for the same reason**: the result is already recorded on the
 * season entry, so writing a news event for one would be a second copy that
 * could drift from the first. A dynasty already in progress reports every
 * playoff it has ever held the moment this ships.
 *
 * Takes a flat list rather than a league so both sources can be handed in
 * together — the set decided by the season that has just ended and is still
 * sitting on `LeagueStore.promotionPlayoffs`, and everything the season history
 * has archived. Without the first, the promotion that just happened would go
 * unreported until the user clicked Advance.
 */
export function promotionNewsBySeason(playoffs: PromotionPlayoff[]): Map<number, PromotionNews[]> {
  const out = new Map<number, PromotionNews[]>();
  for (const p of playoffs) {
    const decider = p.ties.find((t) => t.round === PLAYOFF_ROUND_FINAL);
    if (!decider || p.winnerTid === null) continue;
    const won = decider.winner === decider.home;
    const pens = decider.wentToPens
      ? ` (${won ? decider.homePens : decider.awayPens}-${won ? decider.awayPens : decider.homePens} on pens)`
      : "";
    const row: PromotionNews = {
      country: p.country,
      d1CompId: p.d1CompId,
      d2CompId: p.d2CompId,
      tid: p.winnerTid,
      position: p.positions[p.teams.indexOf(p.winnerTid)] ?? 0,
      runnerUpTid: won ? decider.away : decider.home,
      score: won
        ? `${decider.homeGoals}-${decider.awayGoals}${pens}`
        : `${decider.awayGoals}-${decider.homeGoals}${pens}`,
    };
    const bucket = out.get(p.season);
    if (bucket) bucket.push(row);
    else out.set(p.season, [row]);
  }
  return out;
}
