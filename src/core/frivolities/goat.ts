import type { LeagueStore } from "../leagueState.js";
import { RATING_BASELINE } from "../../engine/matchRating.js";
import {
  GOAT_OVR_BASELINE, GOAT_PEAK_WEIGHT, GOAT_PRIME_WEIGHT, GOAT_LONGEVITY_WEIGHT,
  GOAT_RATING_WEIGHT, GOAT_RATING_FULL_SAMPLE, GOAT_BALLON_DOR_WEIGHT, GOAT_WORLD_XI_WEIGHT,
  GOAT_POTY_WEIGHT, GOAT_GOLDEN_BOOT_WEIGHT, GOAT_TOTS_WEIGHT, GOAT_LEAGUE_TITLE_WEIGHT,
  GOAT_CUP_TITLE_WEIGHT, GOAT_WORLD_CUP_WEIGHT, GOAT_CAP_WEIGHT, GOAT_GOAL_WEIGHT,
  GOAT_ASSIST_WEIGHT,
  GOAT_TEAM_LEAGUE_TITLE_WEIGHT, GOAT_TEAM_CUP_TITLE_WEIGHT, GOAT_TEAM_SECOND_TIER_TITLE_WEIGHT,
  GOAT_TEAM_TOP_FINISH_WEIGHT, GOAT_TEAM_TOP_FINISH_POSITION, GOAT_TEAM_SEASON_WEIGHT,
  GOAT_TEAM_PPG_BASELINE, GOAT_TEAM_PPG_WEIGHT, GOAT_TEAM_SECOND_TIER_SCALE,
} from "../constants.js";
import { allCareers, type CareerRow } from "./careers.js";

/** How many rows the GOAT boards show. */
export const GOAT_LIST_LIMIT = 50;

/** Every honour the player formula counts, per player. */
export interface PlayerHonours {
  ballonDOr: number;
  worldXI: number;
  playerOfSeason: number;
  goldenBoot: number;
  teamOfSeason: number;
  leagueTitles: number;
  cupTitles: number;
  worldCups: number;
}

function emptyHonours(): PlayerHonours {
  return {
    ballonDOr: 0, worldXI: 0, playerOfSeason: 0, goldenBoot: 0,
    teamOfSeason: 0, leagueTitles: 0, cupTitles: 0, worldCups: 0,
  };
}

/**
 * Count every player's honours in one pass over `seasonHistory` and `cupHistory`.
 *
 * Works identically for active players and archived retirees, which is the
 * whole point: awards are stored on the season-history entry by pid and never
 * change, and club-per-season comes off `CareerRow.seasons`, which both sources
 * populate the same way. Nothing here reads the live player pool, so a retiree
 * keeps every trophy he ever won.
 *
 * One pass over history rather than a lookup per player — a 100-season save
 * with thousands of careers would otherwise be a quadratic scan on every render.
 */
export function computeHonours(
  league: LeagueStore,
  careers: readonly CareerRow[],
): Map<number, PlayerHonours> {
  const out = new Map<number, PlayerHonours>();
  const honoursFor = (pid: number): PlayerHonours => {
    let h = out.get(pid);
    if (!h) { h = emptyHonours(); out.set(pid, h); }
    return h;
  };

  for (const h of league.seasonHistory) {
    const winner = h.world?.ballonDOr?.[0]?.pid;
    if (winner != null) honoursFor(winner).ballonDOr += 1;
    for (const pid of h.world?.worldTeamOfYear ?? []) {
      if (pid != null) honoursFor(pid).worldXI += 1;
    }
    for (const awards of Object.values(h.awards ?? {})) {
      if (awards.playerOfSeasonPid != null) honoursFor(awards.playerOfSeasonPid).playerOfSeason += 1;
      if (awards.goldenBootPid != null) honoursFor(awards.goldenBootPid).goldenBoot += 1;
      for (const pid of awards.teamOfSeason ?? []) {
        if (pid != null) honoursFor(pid).teamOfSeason += 1;
      }
    }
  }

  // Team trophies are credited to whoever was at the club that season, so they
  // need the club-per-season line rather than the award lists.
  const championsBySeason = new Map<number, Set<number>>();
  for (const h of league.seasonHistory) {
    championsBySeason.set(h.season, new Set(Object.values(h.championTidByCompId ?? {})));
  }
  const cupChampionBySeason = new Map<number, number>();
  for (const cup of league.cupHistory ?? []) {
    if (cup.championTid != null) cupChampionBySeason.set(cup.season, cup.championTid);
  }

  for (const career of careers) {
    const h = honoursFor(career.pid);
    for (const s of career.seasons) {
      if (championsBySeason.get(s.season)?.has(s.tid)) h.leagueTitles += 1;
      if (cupChampionBySeason.get(s.season) === s.tid) h.cupTitles += 1;
    }
    h.worldCups = career.intlTitles;
  }

  return out;
}

/**
 * One player's GOAT case, broken into parts so the UI can show *why* he ranks.
 *
 * Every field is a whole number and `score` is exactly the sum of the other
 * six, so a reader can always reconcile the breakdown with the total.
 */
export interface PlayerGoatRow {
  career: CareerRow;
  honours: PlayerHonours;
  score: number;
  /** How good he was at his best. */
  peak: number;
  /** How long he stayed near that level. */
  prime: number;
  /** Longevity and sustained match rating. */
  longevity: number;
  /** Individual awards. */
  awards: number;
  /** Team trophies, club and international. */
  trophies: number;
  /** Goals, assists and international caps. */
  production: number;
}

/**
 * Score one career.
 *
 * See the `GOAT_*` block in constants.ts for what each weight is trying to say
 * and, importantly, for the positional bias this first draft carries.
 */
export function scorePlayer(career: CareerRow, honours: PlayerHonours): PlayerGoatRow {
  const peak = GOAT_PEAK_WEIGHT * Math.max(0, career.peakOvr - GOAT_OVR_BASELINE);

  // Area under his career rating curve, above the "good starter" line. A long
  // stretch near the top out-earns a single spike, which is the difference the
  // formula most wants to capture.
  const prime = GOAT_PRIME_WEIGHT * career.seasons.reduce(
    (sum, s) => sum + Math.max(0, s.ovr - GOAT_OVR_BASELINE), 0,
  );

  // Damped until he has a real sample, so a handful of good games can't buy a
  // sustained-quality score.
  const sample = Math.min(1, career.totals.appearances / GOAT_RATING_FULL_SAMPLE);
  const longevity = GOAT_LONGEVITY_WEIGHT * career.seasonsPlayed
    + GOAT_RATING_WEIGHT * Math.max(0, career.totals.avgRating - RATING_BASELINE) * sample;

  const awards = GOAT_BALLON_DOR_WEIGHT * honours.ballonDOr
    + GOAT_WORLD_XI_WEIGHT * honours.worldXI
    + GOAT_POTY_WEIGHT * honours.playerOfSeason
    + GOAT_GOLDEN_BOOT_WEIGHT * honours.goldenBoot
    + GOAT_TOTS_WEIGHT * honours.teamOfSeason;

  const trophies = GOAT_LEAGUE_TITLE_WEIGHT * honours.leagueTitles
    + GOAT_CUP_TITLE_WEIGHT * honours.cupTitles
    + GOAT_WORLD_CUP_WEIGHT * honours.worldCups;

  const production = GOAT_GOAL_WEIGHT * career.totals.goals
    + GOAT_ASSIST_WEIGHT * career.totals.assists
    + GOAT_CAP_WEIGHT * career.caps;

  // Every part is rounded to a whole number and the score is their sum, rather
  // than the parts being rounded only for display. Sub-integer precision is
  // meaningless on a taste score, and keeping it caused two visible defects:
  // the displayed parts didn't add up to the displayed total, and sorting on
  // the exact score could put a row showing 116 above one showing 117.
  const parts = {
    peak: Math.round(peak),
    prime: Math.round(prime),
    longevity: Math.round(longevity),
    awards: Math.round(awards),
    trophies: Math.round(trophies),
    production: Math.round(production),
  };

  return {
    career,
    honours,
    ...parts,
    score: parts.peak + parts.prime + parts.longevity
      + parts.awards + parts.trophies + parts.production,
  };
}

/** The player GOAT board, best first. */
export function playerGoatRanking(
  league: LeagueStore,
  limit = GOAT_LIST_LIMIT,
): PlayerGoatRow[] {
  const careers = allCareers(league);
  const honours = computeHonours(league, careers);
  return careers
    .map((c) => scorePlayer(c, honours.get(c.pid) ?? emptyHonours()))
    .sort((a, b) => b.score - a.score || a.career.pid - b.career.pid)
    .slice(0, limit);
}

/** One club's GOAT case, broken into parts. */
export interface TeamGoatRow {
  tid: number;
  score: number;
  leagueTitles: number;
  cupTitles: number;
  secondTierTitles: number;
  topFinishes: number;
  seasons: number;
  topFlightSeasons: number;
  /** Career points per game across every season played. */
  ppg: number;
  /** Trophies component. */
  trophies: number;
  /** Sustained-strength component (finishes, seasons, points per game). */
  consistency: number;
}

/**
 * The club GOAT board, best first.
 *
 * Derived entirely from `seasonHistory` and `cupHistory`, so it covers every
 * club the save has ever recorded a season for — including one currently in the
 * second tier, which is the point of ranking careers rather than current form.
 */
export function teamGoatRanking(league: LeagueStore, limit = GOAT_LIST_LIMIT): TeamGoatRow[] {
  const tierByCompId = new Map(league.competitions.map((c) => [c.id, c.tier]));
  const rows = new Map<number, TeamGoatRow>();
  const rowFor = (tid: number): TeamGoatRow => {
    let r = rows.get(tid);
    if (!r) {
      r = {
        tid, score: 0, leagueTitles: 0, cupTitles: 0, secondTierTitles: 0, topFinishes: 0,
        seasons: 0, topFlightSeasons: 0, ppg: 0, trophies: 0, consistency: 0,
      };
      rows.set(tid, r);
    }
    return r;
  };

  // Points and matches carried separately so career ppg is a true weighted mean
  // rather than an average of per-season averages.
  const points = new Map<number, number>();
  const played = new Map<number, number>();

  for (const h of league.seasonHistory) {
    const byComp = new Map<number, typeof h.table>();
    for (const row of h.table) {
      if (row.played <= 0) continue;
      const compId = h.compsByTid?.[row.tid] ?? 0;
      const list = byComp.get(compId);
      if (list) list.push(row); else byComp.set(compId, [row]);
    }

    for (const [compId, table] of byComp) {
      const tier = tierByCompId.get(compId) ?? 1;
      const sorted = [...table].sort(
        (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.tid - b.tid,
      );
      sorted.forEach((row, i) => {
        const r = rowFor(row.tid);
        const position = i + 1;
        r.seasons += 1;
        if (tier === 1) r.topFlightSeasons += 1;
        if (position === 1) {
          if (tier === 1) r.leagueTitles += 1; else r.secondTierTitles += 1;
        }
        // Contending seasons only count in the division that matters.
        if (tier === 1 && position <= GOAT_TEAM_TOP_FINISH_POSITION) r.topFinishes += 1;

        points.set(row.tid, (points.get(row.tid) ?? 0) + row.points);
        played.set(row.tid, (played.get(row.tid) ?? 0) + row.played);

        // Sustained strength, measured against a mid-table baseline so an
        // ordinary season adds nothing. Halved in the second tier: dominating a
        // division you shouldn't be in isn't a GOAT case.
        const seasonPpg = row.points / row.played;
        const scale = tier === 1 ? 1 : GOAT_TEAM_SECOND_TIER_SCALE;
        r.consistency += GOAT_TEAM_PPG_WEIGHT
          * Math.max(0, seasonPpg - GOAT_TEAM_PPG_BASELINE) * scale;
      });
    }
  }

  for (const cup of league.cupHistory ?? []) {
    if (cup.championTid != null) rowFor(cup.championTid).cupTitles += 1;
  }

  for (const r of rows.values()) {
    const p = played.get(r.tid) ?? 0;
    r.ppg = p > 0 ? (points.get(r.tid) ?? 0) / p : 0;
    r.trophies = Math.round(GOAT_TEAM_LEAGUE_TITLE_WEIGHT * r.leagueTitles
      + GOAT_TEAM_CUP_TITLE_WEIGHT * r.cupTitles
      + GOAT_TEAM_SECOND_TIER_TITLE_WEIGHT * r.secondTierTitles);
    // Same whole-number rule as the player score above.
    r.consistency = Math.round(r.consistency
      + GOAT_TEAM_TOP_FINISH_WEIGHT * r.topFinishes
      + GOAT_TEAM_SEASON_WEIGHT * r.topFlightSeasons);
    r.score = r.trophies + r.consistency;
  }

  return [...rows.values()]
    .sort((a, b) => b.score - a.score || a.tid - b.tid)
    .slice(0, limit);
}
