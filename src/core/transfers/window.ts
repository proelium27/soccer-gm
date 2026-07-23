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
      /**
       * The window's stable identity: the season whose matchdays it closes
       * during. The summer window spans the offseason AND the following
       * August, so during the offseason this is `league.season + 1` — keying
       * negotiations, valuations, and transfer logs on this (never on
       * `league.season` directly) keeps them intact across the rollover.
       */
      season: number;
      /** The window shuts once this matchday has been played. */
      closesAfterMatchday: number;
    }
  | { open: false; window: null; season: null; closesAfterMatchday: null };

const CLOSED: TransferWindowState = {
  open: false, window: null, season: null, closesAfterMatchday: null,
};

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
  league: Pick<LeagueStore, "phase" | "schedule" | "season">,
): TransferWindowState {
  if (league.phase === "offseason") {
    return {
      open: true,
      window: "summer",
      season: league.season + 1,
      closesAfterMatchday: SUMMER_WINDOW_CLOSE_MATCHDAY,
    };
  }
  const md = nextMatchday(league);
  if (md === null) return CLOSED;
  if (md <= SUMMER_WINDOW_CLOSE_MATCHDAY) {
    return {
      open: true,
      window: "summer",
      season: league.season,
      closesAfterMatchday: SUMMER_WINDOW_CLOSE_MATCHDAY,
    };
  }
  if (md >= WINTER_WINDOW_OPEN_MATCHDAY && md <= TRANSFER_DEADLINE_MATCHDAY) {
    return {
      open: true,
      window: "winter",
      season: league.season,
      closesAfterMatchday: TRANSFER_DEADLINE_MATCHDAY,
    };
  }
  return CLOSED;
}

/**
 * The (season, window) identity to log a free-agent signing under. Unlike a
 * paid transfer, signing a free agent isn't gated by an open window, so this
 * returns a sensible identity even when both windows are shut: the open
 * window's identity if there is one (so an offseason signing keys to next
 * season, matching signFreeAgent's effectiveSeason), otherwise this season and
 * the most recently *closed* window. Attributing to the window just gone rather
 * than the one still ahead matters because the record's window is what places
 * it on the news-feed timeline and in the "this window" activity lists: an
 * October signing filed under winter would surface as January business weeks
 * after it happened. Keeping the record's season aligned to when the player
 * actually joins the XI is what lets teamForSeason attribute him correctly.
 */
export function freeAgentSigningWindow(
  league: Pick<LeagueStore, "phase" | "schedule" | "season">,
): { season: number; window: TransferWindowKind } {
  const ws = transferWindowState(league);
  if (ws.open) return { season: ws.season, window: ws.window };
  // Both shut: either mid-first-half (summer just closed) or after deadline day
  // / a fully simmed season (winter just closed).
  const md = nextMatchday(league);
  const window: TransferWindowKind =
    md === null || md > TRANSFER_DEADLINE_MATCHDAY ? "winter" : "summer";
  return { season: league.season, window };
}
