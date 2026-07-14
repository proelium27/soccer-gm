import type { Player, Position, SeasonStats } from "./players/types.js";
import { FORMATIONS } from "./lineup/formations.js";
import {
  AWARD_MIN_APPEARANCES, AWARD_OVR_BASELINE, AWARD_OVR_WEIGHT,
  POTY_GOAL_WEIGHT, POTY_ASSIST_WEIGHT,
  TOTS_GOAL_WEIGHT, TOTS_ASSIST_WEIGHT, TOTS_TACKLE_WEIGHT, TOTS_INTERCEPTION_WEIGHT,
  TOTS_SAVE_WEIGHT, TOTS_GOALS_AGAINST_PENALTY,
} from "./constants.js";

type PositionGroup = "GK" | "DEF" | "MID" | "FWD";

function positionGroup(pos: Position): PositionGroup {
  switch (pos) {
    case "GK": return "GK";
    case "CB": case "FB": return "DEF";
    case "DM": case "CM": case "AM": return "MID";
    case "W": case "ST": return "FWD";
  }
}

/** One completed season's individual/team honors, stored on SeasonHistoryEntry. */
export interface SeasonAwards {
  playerOfSeasonPid: number | null;
  goldenBootPid: number | null;
  /** 11 pids (or null if no eligible player existed), index-aligned with FORMATIONS["4-3-3"]. */
  teamOfSeason: (number | null)[];
}

function statsFor(p: Player, season: number): SeasonStats | undefined {
  return p.stats.find((s) => s.season === season);
}

function ovrBonus(p: Player): number {
  return (p.ovr - AWARD_OVR_BASELINE) * AWARD_OVR_WEIGHT;
}

function potyScore(p: Player, s: SeasonStats): number {
  const group = positionGroup(p.pos);
  return s.avgRating + s.goals * POTY_GOAL_WEIGHT[group] + s.assists * POTY_ASSIST_WEIGHT[group]
    + ovrBonus(p);
}

function totsScore(p: Player, s: SeasonStats): number {
  const group = positionGroup(p.pos);
  let score = s.avgRating;
  score += s.goals * TOTS_GOAL_WEIGHT[group];
  score += s.assists * TOTS_ASSIST_WEIGHT[group];
  score += s.tackles * TOTS_TACKLE_WEIGHT[group];
  score += s.interceptions * TOTS_INTERCEPTION_WEIGHT[group];
  if (group === "GK") score += s.saves * TOTS_SAVE_WEIGHT;
  score -= s.goalsAgainst * TOTS_GOALS_AGAINST_PENALTY[group];
  score += ovrBonus(p);
  return score;
}

function pickPlayerOfSeason(entries: { player: Player; stats: SeasonStats }[]): number | null {
  const qualified = entries.filter((e) => e.stats.appearances >= AWARD_MIN_APPEARANCES);
  const pool = qualified.length > 0 ? qualified : entries;
  if (pool.length === 0) return null;
  let best = pool[0];
  let bestScore = potyScore(best.player, best.stats);
  for (const e of pool.slice(1)) {
    const score = potyScore(e.player, e.stats);
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
      return (qualifies ? 1000 : 0) + totsScore(e.player, e.stats);
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
    playerOfSeasonPid: pickPlayerOfSeason(entries),
    goldenBootPid: pickGoldenBoot(entries),
    teamOfSeason: pickTeamOfSeason(entries, FORMATIONS["4-3-3"]),
  };
}
