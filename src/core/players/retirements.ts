import type { Player, Position } from "./types.js";
import { ageOf } from "./progression.js";
import { ovrDuringSeason } from "../awards.js";
import { RETIREMENT_NOTABLE_LIMIT } from "../constants.js";

/**
 * One retiree, snapshotted at the moment he retires.
 *
 * This is a *copy*, not a reference, and it has to be: retirement deletes the
 * player from `league.players` outright (simOffseason step 3), so by the time
 * any UI renders him there is nothing left to look up. Everything the Season
 * Preview draws therefore lives here — including his name and nationality,
 * which would otherwise render as "Player 4821" like his surviving transfer
 * rows do.
 */
export interface RetiredPlayer {
  pid: number;
  name: string;
  nationality: string;
  pos: Position;
  /** Age during the season he just finished (the one he retires at the end of). */
  age: number;
  /** The rating he *played* his last season at, not the one he'd have carried into a season he never plays. */
  ovr: number;
  /** Club he was on *last season*, or null if nobody had him under contract. */
  tid: number | null;
  /** Seasons in which he made at least one league appearance. */
  seasonsPlayed: number;
  /** League career totals (cup and international appearances are not included). */
  appearances: number;
  goals: number;
  assists: number;
  /** International caps, 0 if he was never called up. */
  caps: number;
}

/**
 * Who retired in one offseason: a headline count plus the handful of names
 * worth showing.
 *
 * Deliberately not the full list. Thousands of unsigned players leave the game
 * every offseason once the unrostered rate applies at any age, and storing all
 * of them would put an unbounded list in every season-history entry and an
 * unbounded table on the page — the two failure modes that produced the
 * `/transfers` freeze and the 88 MB save. `total` keeps the true number
 * honest while `notable` stays capped.
 */
export interface RetirementSummary {
  /** Everyone who retired, including the unsigned players nobody would recognise. */
  total: number;
  /** How many of them a club actually had on its books last season. */
  rostered: number;
  /** The best of them by ovr, capped at RETIREMENT_NOTABLE_LIMIT; the user's own are always here. */
  notable: RetiredPlayer[];
}

/** Best first, pid as a stable tiebreak so the list can't reorder between renders. */
function byOvr(a: RetiredPlayer, b: RetiredPlayer): number {
  return b.ovr - a.ovr || a.pid - b.pid;
}

function snapshot(player: Player, season: number, tid: number | null): RetiredPlayer {
  const played = player.stats.filter((s) => s.appearances > 0);
  return {
    pid: player.pid,
    name: player.name,
    nationality: player.nationality,
    pos: player.pos,
    age: ageOf(player, season),
    // Retirement rolls at offseason step 3, *after* progression has already
    // applied this player's final decline, so `player.ovr` is the rating he
    // would have carried into a season he never plays. What he was actually
    // worth is the rating he played his last season at — the same number the
    // awards judge him on (falls back to `ovr` when there's no snapshot).
    ovr: ovrDuringSeason(player, season),
    tid,
    seasonsPlayed: played.length,
    appearances: played.reduce((sum, s) => sum + s.appearances, 0),
    goals: played.reduce((sum, s) => sum + s.goals, 0),
    assists: played.reduce((sum, s) => sum + s.assists, 0),
    caps: player.intl?.caps ?? 0,
  };
}

/**
 * Build the season's retirement record from the players who just retired.
 *
 * `tidLastSeason` must be read from the **pre-step-1** rosters, the same
 * snapshot retirement itself reads: by step 3 every expired contract has
 * already been released, so a live lookup would label a club legend of fifteen
 * years as a free agent on his way out. Absent from the map = genuinely
 * unsigned last season.
 *
 * The user's own retirees are never dropped from `notable` (his 34-year-old
 * captain hanging up his boots is the one entry he actually needs to see),
 * which is the same guarantee the window-transfer list makes about his own
 * deals. They still sort by ovr among the rest rather than being pinned to the
 * top, so the table reads as a quality ranking either way.
 */
export function summarizeRetirements(
  retirees: Player[],
  season: number,
  tidLastSeason: Map<number, number>,
  userTid: number,
  limit = RETIREMENT_NOTABLE_LIMIT,
): RetirementSummary {
  const rows = retirees.map((p) => snapshot(p, season, tidLastSeason.get(p.pid) ?? null));
  const mine = rows.filter((r) => r.tid === userTid).sort(byOvr);
  const theirs = rows
    .filter((r) => r.tid !== userTid)
    .sort(byOvr)
    .slice(0, Math.max(0, limit - mine.length));
  return {
    total: rows.length,
    rostered: rows.filter((r) => r.tid !== null).length,
    // Slice mine too: a user who somehow retires more than the cap in one
    // offseason still gets a bounded table, just entirely his own players.
    notable: [...mine.slice(0, limit), ...theirs].sort(byOvr),
  };
}

/**
 * pid -> farewell snapshot, across every season on record.
 *
 * The farewell list is written for the Season Preview, but it is also the only
 * *permanent copy of a name* the save keeps for a player nothing else kept.
 * Retirement deletes him from `league.players`; the retiree archive catches him
 * only if his career clears `isArchiveWorthy` and survives the
 * `RETIREE_ARCHIVE_LIMIT` prune, which on a long save most careers do not —
 * measured on a real season-101 save, the archive's prune bar had risen to peak
 * ovr 79 and 78% of every historical pid reference in the save resolved to
 * nobody.
 *
 * These rows resolve a slice of that back, for free and retroactively: they are
 * already in every save, already persisted, and were never consulted. Read-only
 * and derived, so there is no schema change and nothing to migrate — an old
 * save gets the names back the moment it is loaded.
 *
 * Bounded by construction: `RETIREMENT_NOTABLE_LIMIT` rows per offseason, so a
 * century of play indexes ~1,500 entries.
 *
 * **A farewell row describes his final season, not any earlier one.** `ovr` and
 * `tid` are what he retired at, so a caller showing an award he won a decade
 * before must not present them as that season's — take the name, country and
 * position, and leave the rest to a source that knows.
 */
export function farewellIndex(
  history: { retirements?: RetirementSummary }[],
): Map<number, RetiredPlayer> {
  const map = new Map<number, RetiredPlayer>();
  for (const h of history) {
    for (const r of h.retirements?.notable ?? []) map.set(r.pid, r);
  }
  return map;
}
