import type { Player, Position, SeasonStats } from "./players/types.js";
import { FORMATIONS } from "./lineup/formations.js";
import {
  AWARD_MIN_APPEARANCES, AWARD_OVR_BASELINE, AWARD_OVR_WEIGHT,
  POTY_GOAL_WEIGHT, POTY_ASSIST_WEIGHT,
  TOTS_GOAL_WEIGHT, TOTS_ASSIST_WEIGHT, TOTS_TACKLE_WEIGHT, TOTS_INTERCEPTION_WEIGHT,
  TOTS_SAVE_WEIGHT, TOTS_GOALS_AGAINST_PENALTY,
} from "./constants.js";

export type PositionGroup = "GK" | "DEF" | "MID" | "FWD";

/**
 * Which weight column an award scores a player under. The groups exist to price
 * end product by how hard it is to come by at that position — a defender's goal
 * is worth more than a striker's precisely because he gets so few.
 *
 * **AM is grouped with the forwards, not the midfielders (2026-08-14).** It
 * looks wrong next to the position's name and is right by the engine's own
 * numbers: an attacking midfielder is an attacker here. `SHOT_WEIGHTS.AM` is
 * 1.5 (against W's 2 and CM's 1) and `ASSIST_WEIGHTS.AM` is 3, the highest on
 * the pitch, so his output lands on the winger's side of the line rather than
 * the midfielder's. Measured over 8 seasons of a 240-club world, per player
 * season with 19+ appearances: AM 6.3 goals + 5.8 assists, W 7.9 + 5.6,
 * CM 4.3 + 5.4. AM and W are near enough the same player; AM and CM are not.
 *
 * Grouped as a midfielder he was paid MID rates (0.10/goal, 0.07/assist) for
 * winger production, a 25%/40% premium over the W beside him doing the same
 * job, which inflated attacking midfielders throughout the shortlists. Over
 * those same 8 seasons the correction moves the Ballon d'Or top ten from
 * 27 AM / 29 ST slots to 17 AM / 34 ST.
 *
 * Note what this does *not* fix: it changed none of the 8 winners. Those are
 * decided by the ovr terms (`AWARD_OVR_WEIGHT` + `WORLD_AWARD_OVR_WEIGHT`,
 * 0.20/point together), and elite ovr simply persists longer at AM than at ST
 * — a player who reaches 80 holds it for 3.1 seasons as an AM against 1.2 as a
 * striker, so the 80+ population is AM-heavy no matter how end product is
 * priced. That lives in `OVR_WEIGHTS` (ST is 35% physical/height, AM 8%), not
 * here, and moving it would retune every rating in every save.
 */
export function positionGroup(pos: Position): PositionGroup {
  switch (pos) {
    case "GK": return "GK";
    case "CB": case "FB": return "DEF";
    case "DM": case "CM": return "MID";
    case "AM": case "W": case "ST": return "FWD";
  }
}

/** One completed season's individual/team honors, stored on SeasonHistoryEntry. */
export interface SeasonAwards {
  playerOfSeasonPid: number | null;
  goldenBootPid: number | null;
  /** 11 pids (or null if no eligible player existed), index-aligned with FORMATIONS["4-3-3"]. */
  teamOfSeason: (number | null)[];
}

export function statsFor(p: Player, season: number): SeasonStats | undefined {
  return p.stats.find((s) => s.season === season);
}

/**
 * The ovr a player actually played `season` with — NOT p.ovr, which is
 * present-day and can be many seasons stale by the time this is called (see
 * migrate.ts's historical-award backfill, which recomputes awards for
 * arbitrary past seasons from today's player pool). progressPlayer tags each
 * p.hist entry with the season that just ended, but the ratings/ovr in that
 * entry are the *post-growth* values for the season being entered — so the
 * ovr a player carried into `season` is the hist entry tagged `season - 1`.
 * Falls back to the player's current ovr only when no such snapshot exists
 * (a save's very first season, before any progression has run yet — at that
 * point p.ovr *is* the season-1 ovr — or pre-hist legacy data).
 */
export function ovrDuringSeason(p: Player, season: number): number {
  const snapshot = p.hist.find((h) => h.season === season - 1);
  return snapshot?.ovr ?? p.ovr;
}

function ovrBonus(p: Player, season: number): number {
  return (ovrDuringSeason(p, season) - AWARD_OVR_BASELINE) * AWARD_OVR_WEIGHT;
}

export function potyScore(p: Player, s: SeasonStats, season: number): number {
  const group = positionGroup(p.pos);
  return s.avgRating + s.goals * POTY_GOAL_WEIGHT[group] + s.assists * POTY_ASSIST_WEIGHT[group]
    + ovrBonus(p, season);
}

export function totsScore(p: Player, s: SeasonStats, season: number): number {
  const group = positionGroup(p.pos);
  let score = s.avgRating;
  score += s.goals * TOTS_GOAL_WEIGHT[group];
  score += s.assists * TOTS_ASSIST_WEIGHT[group];
  score += s.tackles * TOTS_TACKLE_WEIGHT[group];
  score += s.interceptions * TOTS_INTERCEPTION_WEIGHT[group];
  if (group === "GK") score += s.saves * TOTS_SAVE_WEIGHT;
  score -= s.goalsAgainst * TOTS_GOALS_AGAINST_PENALTY[group];
  score += ovrBonus(p, season);
  return score;
}

function pickPlayerOfSeason(
  entries: { player: Player; stats: SeasonStats }[],
  season: number,
): number | null {
  const qualified = entries.filter((e) => e.stats.appearances >= AWARD_MIN_APPEARANCES);
  const pool = qualified.length > 0 ? qualified : entries;
  if (pool.length === 0) return null;
  let best = pool[0];
  let bestScore = potyScore(best.player, best.stats, season);
  for (const e of pool.slice(1)) {
    const score = potyScore(e.player, e.stats, season);
    const bestGA = best.stats.goals + best.stats.assists;
    const ga = e.stats.goals + e.stats.assists;
    if (
      score > bestScore ||
      (score === bestScore && (ga > bestGA || (ga === bestGA && e.player.pid < best.player.pid)))
    ) {
      best = e;
      bestScore = score;
    }
  }
  return best.player.pid;
}

function pickGoldenBoot(entries: { player: Player; stats: SeasonStats }[]): number | null {
  const scorers = entries.filter((e) => e.stats.goals > 0);
  if (scorers.length === 0) return null;
  let best = scorers[0];
  for (const e of scorers.slice(1)) {
    if (
      e.stats.goals > best.stats.goals ||
      (e.stats.goals === best.stats.goals &&
        (e.stats.appearances < best.stats.appearances ||
          (e.stats.appearances === best.stats.appearances &&
            (e.stats.assists > best.stats.assists ||
              (e.stats.assists === best.stats.assists && e.player.pid < best.player.pid)))))
    ) {
      best = e;
    }
  }
  return best.player.pid;
}

function pickTeamOfSeason(
  entries: { player: Player; stats: SeasonStats }[],
  formation: Position[],
  season: number,
): (number | null)[] {
  const used = new Set<number>();
  return formation.map((slotPos) => {
    const candidates = entries.filter(
      (e) => e.player.pos === slotPos && e.stats.appearances > 0 && !used.has(e.player.pid),
    );
    if (candidates.length === 0) return null;
    let best = candidates[0];
    let bestScore = scoreForSlot(best);
    for (const c of candidates.slice(1)) {
      const score = scoreForSlot(c);
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
    used.add(best.player.pid);
    return best.player.pid;

    function scoreForSlot(e: { player: Player; stats: SeasonStats }): number {
      const qualifies = e.stats.appearances >= AWARD_MIN_APPEARANCES;
      // Qualified players always outrank unqualified ones; within each group,
      // rank by totsScore. Keeps every slot filled even when a thin position
      // has no one over the appearances bar.
      return (qualifies ? 1000 : 0) + totsScore(e.player, e.stats, season);
    }
  });
}

/**
 * Compute a completed season's awards from the players who have a
 * SeasonStats entry for that season. Player.stats is append-only and never
 * pruned, so this can be run for any past season, not just the one that
 * just ended — used both by simOffseason (fresh) and migrateLeague
 * (backfilling old saves that predate this feature).
 */
export function computeSeasonAwards(players: Player[], season: number): SeasonAwards {
  const entries: { player: Player; stats: SeasonStats }[] = [];
  for (const player of players) {
    const stats = statsFor(player, season);
    if (stats && stats.appearances > 0) entries.push({ player, stats });
  }

  return {
    playerOfSeasonPid: pickPlayerOfSeason(entries, season),
    goldenBootPid: pickGoldenBoot(entries),
    teamOfSeason: pickTeamOfSeason(entries, FORMATIONS["4-3-3"], season),
  };
}
