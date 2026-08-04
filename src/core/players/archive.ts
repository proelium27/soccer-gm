import type { Player, Position } from "./types.js";
import { ageOf } from "./progression.js";
import { ovrDuringSeason } from "../awards.js";
import {
  RETIREE_ARCHIVE_MIN_PEAK_OVR, RETIREE_ARCHIVE_MIN_APPEARANCES, RETIREE_ARCHIVE_LIMIT,
} from "../constants.js";

/**
 * A retired player kept permanently, so the all-time frivolities leaderboards
 * still know he existed.
 *
 * Retirement deletes the player from `league.players` outright (simOffseason
 * step 3), which is why every field here is a flat *copy* rather than anything
 * that would need a later lookup. This is the same reason `RetiredPlayer` in
 * retirements.ts is a copy — but the two serve different jobs and are
 * deliberately not merged: that one is a per-season "who left this summer"
 * notice capped at RETIREMENT_NOTABLE_LIMIT and attached to one season-history
 * entry, this one is the permanent career record behind the all-time lists.
 *
 * **Honours are not stored here.** Every award a player ever won is already on
 * `seasonHistory[].awards` / `.world`, keyed by pid, so they stay derivable
 * forever (see core/clubHistory.ts for the same trick). Copying them in would
 * duplicate data
 * that never changes and grow every row for nothing.
 */
export interface ArchivedPlayer {
  pid: number;
  name: string;
  nationality: string;
  pos: Position;
  born: number;
  heightCm: number;
  /** The last season he played — the one he retires at the end of. */
  retiredSeason: number;
  /** Age during that final season. */
  retiredAge: number;
  /** First season he made a league appearance in. */
  firstSeason: number;
  /** Seasons in which he made at least one league appearance. */
  seasonsPlayed: number;
  /** Best ovr he ever carried, read off `hist` (his *played* ratings, not the post-decline value retirement leaves behind). */
  peakOvr: number;
  /** The season he was at `peakOvr` in. */
  peakSeason: number;
  /** The rating he played his final season at. */
  finalOvr: number;
  /** Distinct clubs he made league appearances for, first to last. */
  clubs: number[];
  // League career totals. Cup and international appearances are not included
  // (they live on separate stat lines), matching SeasonStats' own scope.
  appearances: number;
  goals: number;
  assists: number;
  minutesPlayed: number;
  saves: number;
  tackles: number;
  interceptions: number;
  /** Per-appearance career average match rating, 0 if he never played. */
  avgRating: number;
  /** International caps and goals, 0 if he was never called up. */
  caps: number;
  intlGoals: number;
  /**
   * His best individual season, kept because the single-season record lists
   * ("most goals in a season, all-time") can't be rebuilt from career totals
   * and the per-season stat lines are deleted with the player. Four numbers, so
   * cheap; goals and assists peak in different seasons often enough to be worth
   * tracking separately.
   */
  bestGoals: number;
  bestGoalsSeason: number;
  bestAssists: number;
  bestAssistsSeason: number;
}

/** Career league appearances across every season on the stat line. */
function careerAppearances(player: Player): number {
  return player.stats.reduce((sum, s) => sum + s.appearances, 0);
}

/**
 * Best ovr on the ratings history, with the season it happened in.
 *
 * `fallbackSeason` is the season to credit when the player has no snapshot
 * beating his current ovr — a player in his first season has no `hist` at all,
 * and his current rating *is* this season's. It must not default to
 * `player.born`: that's a season number too, so it renders as a real-looking
 * but wrong year rather than being obviously missing.
 */
function peakOf(player: Player, fallbackSeason: number): { ovr: number; season: number } {
  let best = { ovr: player.ovr, season: fallbackSeason };
  for (const h of player.hist) {
    if (h.ovr > best.ovr) best = { ovr: h.ovr, season: h.season };
  }
  return best;
}

/**
 * Is this retiree worth keeping forever?
 *
 * The gate exists because volume, not row width, is what kills the save: a
 * 240-club world retires hundreds of players every single offseason, the large
 * majority of them unsigned players who never made a senior appearance. Keeping
 * all of them is the exact shape of the bug that produced the 88 MB save (see
 * RETIREMENT_NOTABLE_LIMIT's note in constants.ts).
 *
 * Every list the archive feeds is a *leaderboard* — the top N of something — so
 * a player who was never near the top of anything costs save size and buys
 * nothing. He has to have actually played, and then either reached a genuine
 * top-flight standard or lasted long enough for the longevity lists to care.
 */
export function isArchiveWorthy(player: Player): boolean {
  const apps = careerAppearances(player);
  if (apps <= 0) return false;
  // Only the rating matters here, so the fallback season is irrelevant.
  return peakOf(player, 0).ovr >= RETIREE_ARCHIVE_MIN_PEAK_OVR
    || apps >= RETIREE_ARCHIVE_MIN_APPEARANCES;
}

/**
 * Snapshot one retiring player into his permanent record.
 *
 * `season` is the season he just finished. Note `finalOvr` deliberately reads
 * `ovrDuringSeason` rather than `player.ovr`: retirement rolls *after*
 * progression has applied his final decline, so `player.ovr` is the rating he
 * would have carried into a season he never plays.
 */
export function archivePlayer(player: Player, season: number): ArchivedPlayer {
  const played = player.stats.filter((s) => s.appearances > 0);
  const sum = (pick: (s: (typeof played)[number]) => number) =>
    played.reduce((acc, s) => acc + pick(s), 0);
  const peak = peakOf(player, season);
  const minutes = sum((s) => s.minutesPlayed);

  // Distinct clubs in the order he played for them. SeasonStats.tid is the club
  // of his most recent appearance that season, so a mid-season move shows only
  // the destination — the same limitation Leaders has (see CLAUDE.md's open
  // design item on mid-season stat attribution).
  const clubs: number[] = [];
  for (const s of played) {
    if (s.tid >= 0 && !clubs.includes(s.tid)) clubs.push(s.tid);
  }

  return {
    pid: player.pid,
    name: player.name,
    nationality: player.nationality,
    pos: player.pos,
    born: player.born,
    heightCm: player.heightCm,
    retiredSeason: season,
    retiredAge: ageOf(player, season),
    firstSeason: played.length ? played[0].season : season,
    seasonsPlayed: played.length,
    peakOvr: peak.ovr,
    peakSeason: peak.season,
    finalOvr: ovrDuringSeason(player, season),
    clubs,
    appearances: sum((s) => s.appearances),
    goals: sum((s) => s.goals),
    assists: sum((s) => s.assists),
    minutesPlayed: minutes,
    saves: sum((s) => s.saves),
    tackles: sum((s) => s.tackles),
    interceptions: sum((s) => s.interceptions),
    // Each season's ratingSum is already the sum over that season's
    // appearances, so dividing the career totals gives a per-appearance mean
    // without weighting a 3-game cameo like a 38-game season.
    avgRating: sum((s) => s.appearances) > 0
      ? sum((s) => s.ratingSum) / sum((s) => s.appearances)
      : 0,
    caps: player.intl?.caps ?? 0,
    intlGoals: player.intl?.goals ?? 0,
    ...bestSeasons(played),
  };
}

/** His highest-scoring and highest-assisting single seasons, and when they were. */
function bestSeasons(played: { season: number; goals: number; assists: number }[]): Pick<
  ArchivedPlayer, "bestGoals" | "bestGoalsSeason" | "bestAssists" | "bestAssistsSeason"
> {
  let bestGoals = 0, bestGoalsSeason = 0, bestAssists = 0, bestAssistsSeason = 0;
  for (const s of played) {
    if (s.goals > bestGoals) { bestGoals = s.goals; bestGoalsSeason = s.season; }
    if (s.assists > bestAssists) { bestAssists = s.assists; bestAssistsSeason = s.season; }
  }
  return { bestGoals, bestGoalsSeason, bestAssists, bestAssistsSeason };
}

/**
 * How good a career was, for deciding who to drop when the archive is full.
 *
 * Peak rating carries it — the all-time lists are mostly "who was the best" —
 * with longevity as a smaller term so a long, solid career outranks a brief
 * one that touched the same ceiling for a single season.
 */
function careerScore(p: ArchivedPlayer): number {
  return p.peakOvr + Math.min(10, p.seasonsPlayed / 2);
}

/**
 * Fold this offseason's retirees into the permanent archive, keeping it bounded.
 *
 * The cap is a hard save-size guarantee: however long a dynasty runs, the
 * archive cannot exceed RETIREE_ARCHIVE_LIMIT rows. When it overflows, the
 * weakest careers are dropped rather than the oldest, so a 100-season save
 * keeps its legends from season 3 and loses the journeymen from season 97.
 *
 * Pure and order-stable — pid breaks ties — so it consumes no rng and can be
 * re-run on the same input for the same result.
 */
export function extendRetireeArchive(
  archive: ArchivedPlayer[],
  retirees: Player[],
  season: number,
  limit = RETIREE_ARCHIVE_LIMIT,
): ArchivedPlayer[] {
  const added = retirees.filter(isArchiveWorthy).map((p) => archivePlayer(p, season));
  const all = [...archive, ...added];
  if (all.length <= limit) return all;
  return all
    .slice()
    .sort((a, b) => careerScore(b) - careerScore(a) || a.pid - b.pid)
    .slice(0, limit);
}
