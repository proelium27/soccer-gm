import type { CompletedTransfer } from "../core/transfers/negotiation.js";
import type { NewsEvent } from "../core/newsEvents.js";
import { WINTER_WINDOW_OPEN_MATCHDAY } from "../core/calendar.js";

export type FeedItem =
  | { kind: "transfer"; order: number; data: CompletedTransfer }
  | { kind: "news"; order: number; data: NewsEvent };

/**
 * Merges one season's transfers and accomplishments into a single
 * chronological timeline. Transfers have no matchday of their own, so they're
 * placed at an approximate point in the calendar by window: summer business
 * before matchday 1, winter business around the window's opening matchday.
 * Ties (same order key) keep transfers before accomplishments.
 */
export function buildSeasonTimeline(
  transfers: CompletedTransfer[],
  newsEvents: NewsEvent[],
): FeedItem[] {
  const items: FeedItem[] = [
    ...transfers.map((t): FeedItem => ({
      kind: "transfer",
      order: t.window === "summer" ? 0 : WINTER_WINDOW_OPEN_MATCHDAY,
      data: t,
    })),
    ...newsEvents.map((e): FeedItem => ({ kind: "news", order: e.matchday, data: e })),
  ];

  return items.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    if (a.kind !== b.kind) return a.kind === "transfer" ? -1 : 1;
    return 0;
  });
}
