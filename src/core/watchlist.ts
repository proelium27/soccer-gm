import type { LeagueStore } from "./leagueState.js";
import type { Player } from "./players/types.js";
import { scoutedValue } from "./transfers/negotiation.js";
import { freeAgentSigningWindow } from "./transfers/window.js";
import { saleGateFor } from "./transfers/recommendations.js";
import { difficultyProfile } from "./constants.js";

/**
 * One watched player, resolved against the world as it stands right now.
 *
 * Nothing here is stored — the save keeps a list of pids and this rebuilds the
 * rest on every read, so a shortlist written three seasons ago still shows
 * today's club, today's rating and today's asking price rather than a snapshot
 * of the day he was starred.
 */
export interface WatchlistEntry {
  player: Player;
  /** The club he's at now, or null when he's a free agent. */
  tid: number | null;
  /** He's in that club's academy rather than its senior squad. */
  academy: boolean;
  /** True when he's already yours, in either squad. */
  own: boolean;
  /**
   * Our scouts' estimate of his transfer value — the same figure, from the same
   * seeded draw, that the Transfers page quotes for him. Shown for everyone,
   * including free agents (who cost no fee, but whose value still says what
   * you're getting) and your own players.
   */
  value: number;
  /**
   * Why a bid wouldn't be entertained, or null when one would — the same gates
   * `makeTransferOffer` enforces, through the same helper the transfer search
   * uses, so the two surfaces can't come to different answers about one player.
   *
   * Null rather than a reason for a free agent (there is no club to refuse) and
   * for your own players (`own` covers that, and the gates are written from the
   * buyer's side).
   */
  notForSaleReason: string | null;
}

/** Is this player on the watchlist? */
export function isWatched(league: Pick<LeagueStore, "watchlist">, pid: number): boolean {
  return league.watchlist.includes(pid);
}

/**
 * Star or unstar a player. Works on **anyone in the world** — unlike
 * `transferListed` or `moreMinutes`, which are instructions to your own club
 * and so are refused for anyone else's player, this is a note to yourself.
 *
 * Returns the league unchanged when the flag already reads that way, so the
 * caller's mutate is a no-op and nothing is written to disk.
 */
export function setWatched(league: LeagueStore, pid: number, watched: boolean): LeagueStore {
  const has = league.watchlist.includes(pid);
  if (watched === has) return league;
  return {
    ...league,
    watchlist: watched
      ? [...league.watchlist, pid]
      : league.watchlist.filter((p) => p !== pid),
  };
}

/** Flip a player's star. */
export function toggleWatched(league: LeagueStore, pid: number): LeagueStore {
  return setWatched(league, pid, !isWatched(league, pid));
}

/**
 * The watchlist, resolved.
 *
 * **A pid that no longer names anyone is dropped rather than rendered as a
 * blank row.** The stored list is scrubbed when a watched player retires or is
 * culled from the free-agent pool, so this should never fire — but the two
 * places that own that scrub are a long way from this one, and a shortlist that
 * quietly grows a row nobody can click is worse than one that forgets a player.
 *
 * Order is the order they were starred in. The page sorts on top of that.
 */
export function watchlistEntries(league: LeagueStore): WatchlistEntry[] {
  if (league.watchlist.length === 0) return [];

  const user = league.teams.find((t) => t.tid === league.meta.userTid);
  const playerMap = new Map(league.players.map((p) => [p.pid, p]));

  // Where everyone sits, built once: the alternative is a scan of every club's
  // two rosters per watched player.
  const clubOf = new Map<number, { tid: number; academy: boolean }>();
  for (const team of league.teams) {
    for (const pid of team.roster) clubOf.set(pid, { tid: team.tid, academy: false });
    for (const pid of team.academyRoster) clubOf.set(pid, { tid: team.tid, academy: true });
  }

  // A value estimate wants a (season, window) identity even when both windows
  // are shut, which is exactly what this returns — the same reason signing a
  // free agent uses it. A stable identity within a window is what stops the
  // quoted figure jittering from one render to the next.
  const { season, window } = freeAgentSigningWindow(league);
  const priceScale = difficultyProfile(league.difficulty).buyPriceScale;
  const spend = user?.scoutingSpend ?? 0;

  const gate = user ? saleGateFor(league, user, playerMap) : null;
  const teamByTid = new Map(league.teams.map((t) => [t.tid, t]));

  const entries: WatchlistEntry[] = [];
  for (const pid of league.watchlist) {
    const player = playerMap.get(pid);
    if (!player) continue;
    const at = clubOf.get(pid) ?? null;
    const own = at !== null && at.tid === league.meta.userTid;
    const seller = at && !own && !at.academy ? teamByTid.get(at.tid) : undefined;
    entries.push({
      player,
      tid: at ? at.tid : null,
      academy: at?.academy ?? false,
      own,
      value: scoutedValue(league.lid, season, window, player, spend, priceScale),
      notForSaleReason: gate && seller ? gate(player, seller) : null,
    });
  }
  return entries;
}
