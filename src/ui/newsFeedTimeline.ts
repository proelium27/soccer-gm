import type { CompletedTransfer } from "../core/transfers/negotiation.js";
import { isFreeAgentTid } from "../core/transfers/negotiation.js";
import type { NewsEvent } from "../core/newsEvents.js";
import { newsEventScope, isNewsworthy } from "../core/newsEvents.js";
import { WINTER_WINDOW_OPEN_MATCHDAY } from "../core/calendar.js";
import { NEWS_WORLD_TRANSFER_FEE } from "../core/constants.js";

export type FeedItem =
  | { kind: "transfer"; order: number; data: CompletedTransfer }
  | { kind: "news"; order: number; data: NewsEvent };

/**
 * Who is reading, and where they play — everything the feed needs to sort the
 * world's activity into "yours", "your league's" and "everyone else's".
 *
 * `compOf` is per-season rather than a live team lookup because a club's
 * competition changes with promotion and relegation: filing an old season under
 * the club's *present* division misattributes it (the same reason
 * clubHistory.ts reads the season's own `compsByTid` snapshot). `userCompId`
 * is likewise the user's competition in that season, so a dynasty that spent
 * three years in the second division reads back as second-division news.
 */
export interface NewsAudience {
  userTid: number;
  /** The user's competition that season, or undefined if it can't be resolved. */
  userCompId: number | undefined;
  /** The competition a club played in that season, or undefined if unknown. */
  compOf: (tid: number) => number | undefined;
}

/**
 * Merges one season's transfers and accomplishments into a single
 * chronological timeline. Transfers have no matchday of their own, so they're
 * placed at an approximate point in the calendar by window: summer business
 * before matchday 1, winter business around the window's opening matchday.
 * Ties (same order key) keep transfers before accomplishments.
 *
 * ## What gets in
 *
 * The world is 16 competitions and 320 clubs, and reporting all of them equally
 * made the feed useless: measured at season 4 it ran to ~6,000 rows a season,
 * of which ~10% touched the user's own competition and ~0.1% their club, with a
 * median subject OVR of 61 — below an average starter. So relevance is tiered:
 *
 *   - the user's own club — everything, including loans and free signings,
 *     because their own business is never noise;
 *   - the user's competition — every accomplishment the detector kept, and
 *     every paid deal and loan;
 *   - anywhere else — only world-tier accomplishments (`newsEventScope`) and
 *     paid deals at or above `NEWS_WORLD_TRANSFER_FEE`.
 *
 * Two things are dropped outside the user's club at every tier: routine
 * free-agent churn (AI clubs refilling squads from the free pool, on the order
 * of a thousand signings a season) and loan returns, which are the paperwork
 * ending a move that was already reported when it happened.
 *
 * `isNewsworthy` re-applies the detector's current floor, which is what keeps
 * an existing save's legacy every-10 goal milestones out without a migration.
 */
export function buildSeasonTimeline(
  transfers: CompletedTransfer[],
  newsEvents: NewsEvent[],
  audience: NewsAudience,
): FeedItem[] {
  const { userTid, userCompId, compOf } = audience;

  // An unresolved competition is nobody's league rather than everybody's, so a
  // missing snapshot degrades to showing only world-tier news, never to
  // showing all 320 clubs' worth.
  const inUserComp = (tid: number): boolean =>
    userCompId !== undefined && compOf(tid) === userCompId;

  const shownTransfers = transfers.filter((t) => {
    if (t.fromTid === userTid || t.toTid === userTid) return true;
    if (t.loanReturn) return false;
    if (isFreeAgentTid(t.fromTid)) return false;
    if (inUserComp(t.fromTid) || inUserComp(t.toTid)) return true;
    return !t.loanSeasons && t.fee >= NEWS_WORLD_TRANSFER_FEE;
  });

  const shownEvents = newsEvents.filter((e) => {
    if (!isNewsworthy(e)) return false;
    if (e.tid === userTid || inUserComp(e.tid)) return true;
    return newsEventScope(e) === "world";
  });

  const items: FeedItem[] = [
    ...shownTransfers.map((t): FeedItem => ({
      kind: "transfer",
      order: t.window === "summer" ? 0 : WINTER_WINDOW_OPEN_MATCHDAY,
      data: t,
    })),
    ...shownEvents.map((e): FeedItem => ({ kind: "news", order: e.matchday, data: e })),
  ];

  return items.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    if (a.kind !== b.kind) return a.kind === "transfer" ? -1 : 1;
    return 0;
  });
}
