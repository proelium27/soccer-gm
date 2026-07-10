import type { LeagueStore } from "../leagueState.js";
import {
  SUMMER_WINDOW_CLOSE_MATCHDAY,
  TRANSFER_DEADLINE_MATCHDAY,
  WINTER_WINDOW_OPEN_MATCHDAY,
} from "../calendar.js";

export type TransferWindowKind = "summer" | "winter";

export type TransferWindowState =
  | {
      open: true;
      window: TransferWindowKind;
      /** The window shuts once this matchday has been played. */
      closesAfterMatchday: number;
    }
  | { open: false; window: null; closesAfterMatchday: null };

const CLOSED: TransferWindowState = { open: false, window: null, closesAfterMatchday: null };

/** The next unplayed matchday, or null once the season is fully simmed. */
export function nextMatchday(league: Pick<LeagueStore, "schedule">): number | null {
  if (league.schedule.length === 0) return null;
  return Math.min(...league.schedule.map((g) => g.matchday));
}

/**
 * Two transfer windows per season (docs/finance-design.md): a long summer
 * window spanning the whole offseason phase plus August (matchdays 1-4), and
 * a winter window from mid-December (matchday 18) through deadline day
 * (matchday 22, the "Sim to Transfer Deadline" landing spot).
 */
export function transferWindowState(
  league: Pick<LeagueStore, "phase" | "schedule">,
): TransferWindowState {
  if (league.phase === "offseason") {
    return { open: true, window: "summer", closesAfterMatchday: SUMMER_WINDOW_CLOSE_MATCHDAY };
  }
  const md = nextMatchday(league);
  if (md === null) return CLOSED;
  if (md <= SUMMER_WINDOW_CLOSE_MATCHDAY) {
    return { open: true, window: "summer", closesAfterMatchday: SUMMER_WINDOW_CLOSE_MATCHDAY };
  }
  if (md >= WINTER_WINDOW_OPEN_MATCHDAY && md <= TRANSFER_DEADLINE_MATCHDAY) {
    return { open: true, window: "winter", closesAfterMatchday: TRANSFER_DEADLINE_MATCHDAY };
  }
  return CLOSED;
}
