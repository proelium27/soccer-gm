import type { LeagueStore } from "../leagueState.js";
import type { BallonDOrEntry } from "../worldAwards.js";
import { BALLON_DOR_SHORTLIST } from "../constants.js";
import { allCareers, type CareerRow } from "./careers.js";
import { computeHonours, type PlayerHonours } from "./goat.js";

/** How many rows each awards board shows. */
export const AWARD_LIST_LIMIT = 25;
/** How many rows the career honours board shows — the widest board, and the one worth browsing. */
export const AWARD_CAREER_LIMIT = 50;

/**
 * The individual honours a career board can be ranked by.
 *
 * Only awards given to *one player for one season* — league titles and cups are
 * team trophies and live on the GOAT and Trophy Cabinet boards instead. `total`
 * is the sum of the other five, which is the default ordering.
 */
export const AWARD_KEYS = [
  "total", "ballonDOr", "worldXI", "playerOfSeason", "goldenBoot", "teamOfSeason",
] as const;
export type AwardKey = typeof AWARD_KEYS[number];

/** The five individual awards, in the order the boards display them. */
const INDIVIDUAL_KEYS = [
  "ballonDOr", "worldXI", "playerOfSeason", "goldenBoot", "teamOfSeason",
] as const;

/** How many of each individual award something (a player, a club, a country) has collected. */
export interface AwardTally {
  ballonDOr: number;
  worldXI: number;
  playerOfSeason: number;
  goldenBoot: number;
  teamOfSeason: number;
  /** The five above, added up. */
  total: number;
}

function emptyTally(): AwardTally {
  return {
    ballonDOr: 0, worldXI: 0, playerOfSeason: 0, goldenBoot: 0, teamOfSeason: 0, total: 0,
  };
}

/**
 * How deep a player's Ballon d'Or record runs, not just how many he won.
 *
 * The whole top-`BALLON_DOR_SHORTLIST` ranking is persisted on every season
 * history entry, so a career of near-misses is on record just as firmly as a
 * career of wins — this is what makes it visible.
 */
export interface BallonDOrRecord {
  wins: number;
  runnerUp: number;
  third: number;
  /** Every shortlist appearance, wins included. */
  shortlists: number;
  /**
   * Award shares, the classic way of scoring a career of near-misses: a win is
   * worth 1.00 and last place on the shortlist 0.10, so four second places
   * outrank a single win.
   *
   * Scored against today's `BALLON_DOR_SHORTLIST`, so a save whose shortlist
   * length changed would rescale its old seasons. Nothing else depends on it.
   */
  shares: number;
  /** His best finish ever, or null if he has never made a shortlist. */
  bestRank: number | null;
  /** Most consecutive seasons won. */
  bestRun: number;
}

function emptyBallonDOr(): BallonDOrRecord {
  return { wins: 0, runnerUp: 0, third: 0, shortlists: 0, shares: 0, bestRank: null, bestRun: 0 };
}

/** One decorated career, with every individual honour it collected. */
export interface AwardCareerRow {
  career: CareerRow;
  /** Award counts plus the team trophies, straight off the shared honours pass. */
  honours: PlayerHonours;
  tally: AwardTally;
  ballon: BallonDOrRecord;
}

/**
 * One player's Ballon d'Or season, resolved enough to render on its own.
 *
 * Used by three boards that all ask a different question of the same rows: the
 * most dominant seasons ever, the season-by-season roll of honour, and the
 * youngest and oldest winners.
 */
export interface BallonDOrSeason {
  season: number;
  /** Where he finished that season, 1 for the winner. */
  rank: number;
  /** The stored entry: total score plus the four parts that made it. */
  entry: BallonDOrEntry;
  pid: number;
  /**
   * Placeholder ("Player 4821") when the save no longer knows him — sold years
   * ago, then retired below the archive's quality gate. The award still
   * happened, so the row renders rather than vanishing.
   */
  name: string;
  /** Empty for the same reason, so the UI can skip the flag rather than imply a country. */
  nationality: string;
  active: boolean;
  /** The club he finished that season at, off the stored entry. */
  tid: number;
  /** His age that season, or null when the save no longer knows when he was born. */
  age: number | null;
}

/** A club's or a country's haul of individual awards. */
export interface ClubAwardRow extends AwardTally { tid: number }
export interface NationAwardRow extends AwardTally { nationality: string }

/** One season's Ballon d'Or result, winner and runner-up. */
export interface RollOfHonourRow {
  season: number;
  winner: BallonDOrSeason;
  /** Null in the freak case of a season where only one player was eligible. */
  runnerUp: BallonDOrSeason | null;
}

export interface AwardTrivia {
  /**
   * Every career with at least one individual honour, most honours first.
   *
   * Deliberately **uncapped**: the UI re-ranks this list by whichever award is
   * selected, so trimming it here would silently limit a Golden Boot board to
   * the players who happen to be near the top of the *total* board.
   * `sortAwardRows` applies the display cap.
   */
  careers: AwardCareerRow[];
  /** Every career with at least one shortlist appearance, most shares first. */
  ballonDOr: AwardCareerRow[];
  /** Every Ballon d'Or shortlist entry ever recorded, highest score first. */
  dominantSeasons: BallonDOrSeason[];
  /** Every season's winner, newest first. */
  rollOfHonour: RollOfHonourRow[];
  youngestWinners: BallonDOrSeason[];
  oldestWinners: BallonDOrSeason[];
  clubs: ClubAwardRow[];
  nations: NationAwardRow[];
  /** Seasons of history this save has on record, so the UI can say so. */
  seasonsRecorded: number;
}

/** Award shares for one shortlist finish: 1.00 for the win, down to 0.10 for last place. */
function shareOf(rank: number): number {
  return Math.max(0, BALLON_DOR_SHORTLIST + 1 - rank) / BALLON_DOR_SHORTLIST;
}

function addToTally(t: AwardTally, key: typeof INDIVIDUAL_KEYS[number]): void {
  t[key] += 1;
  t.total += 1;
}

/**
 * Every awards board on one pass over history.
 *
 * Derived, never stored: awards are already recorded per season by pid
 * (`SeasonHistoryEntry.awards` / `.world`), which is exactly why they survive a
 * player's retirement. The one thing a pid can't survive is being forgotten
 * altogether — a retiree below the archive's quality gate — and those rows keep
 * their honours but render under a placeholder name.
 */
export function computeAwardTrivia(league: LeagueStore): AwardTrivia {
  const careers = allCareers(league);
  const honours = computeHonours(league, careers);
  const careerByPid = new Map(careers.map((c) => [c.pid, c]));

  // Club-per-season, built only for pids that actually won something. The full
  // map is every squad membership of every career in the save — six figures of
  // entries on a long dynasty — and the boards need a few hundred of them.
  const awardedPids = new Set<number>();
  const note = (pid: number | null | undefined): void => {
    if (pid != null) awardedPids.add(pid);
  };
  for (const h of league.seasonHistory) {
    for (const e of h.world?.ballonDOr ?? []) note(e.pid);
    for (const pid of h.world?.worldTeamOfYear ?? []) note(pid);
    for (const a of Object.values(h.awards ?? {})) {
      note(a.playerOfSeasonPid);
      note(a.goldenBootPid);
      for (const pid of a.teamOfSeason ?? []) note(pid);
    }
  }
  const clubBySeason = new Map<number, Map<number, number>>();
  for (const pid of awardedPids) {
    const career = careerByPid.get(pid);
    if (!career) continue;
    clubBySeason.set(pid, new Map(career.seasons.map((s) => [s.season, s.tid])));
  }
  const clubOf = (pid: number, season: number): number | undefined =>
    clubBySeason.get(pid)?.get(season);

  const clubs = new Map<number, ClubAwardRow>();
  const nations = new Map<string, NationAwardRow>();
  const clubRow = (tid: number): ClubAwardRow => {
    let r = clubs.get(tid);
    if (!r) { r = { tid, ...emptyTally() }; clubs.set(tid, r); }
    return r;
  };
  const nationRow = (nationality: string): NationAwardRow => {
    let r = nations.get(nationality);
    if (!r) { r = { nationality, ...emptyTally() }; nations.set(nationality, r); }
    return r;
  };
  /** Credit one award to the club he played that season for and to his country. */
  const credit = (pid: number, season: number, key: typeof INDIVIDUAL_KEYS[number], tid?: number): void => {
    const club = tid ?? clubOf(pid, season);
    if (club != null && club >= 0) addToTally(clubRow(club), key);
    const nationality = careerByPid.get(pid)?.nationality;
    if (nationality) addToTally(nationRow(nationality), key);
  };

  const ballon = new Map<number, BallonDOrRecord>();
  const ballonRecord = (pid: number): BallonDOrRecord => {
    let r = ballon.get(pid);
    if (!r) { r = emptyBallonDOr(); ballon.set(pid, r); }
    return r;
  };
  // Winning seasons per player, so a run of them can be measured.
  const winSeasons = new Map<number, number[]>();

  const dominantSeasons: BallonDOrSeason[] = [];
  const rollOfHonour: RollOfHonourRow[] = [];

  const asSeason = (entry: BallonDOrEntry, season: number, rank: number): BallonDOrSeason => {
    const career = careerByPid.get(entry.pid);
    return {
      season,
      rank,
      entry,
      pid: entry.pid,
      name: career?.name ?? `Player ${entry.pid}`,
      nationality: career?.nationality ?? "",
      active: career?.active ?? false,
      tid: entry.tid,
      age: career ? season - career.born : null,
    };
  };

  for (const h of league.seasonHistory) {
    const shortlist = h.world?.ballonDOr ?? [];
    shortlist.forEach((entry, i) => {
      const rank = i + 1;
      const rec = ballonRecord(entry.pid);
      rec.shortlists += 1;
      rec.shares += shareOf(rank);
      if (rec.bestRank === null || rank < rec.bestRank) rec.bestRank = rank;
      if (rank === 1) {
        rec.wins += 1;
        const seasons = winSeasons.get(entry.pid);
        if (seasons) seasons.push(h.season); else winSeasons.set(entry.pid, [h.season]);
        // The Ballon d'Or is the one award whose club is stored on the entry
        // itself, so it doesn't need the club-per-season lookup.
        credit(entry.pid, h.season, "ballonDOr", entry.tid);
      }
      if (rank === 2) rec.runnerUp += 1;
      if (rank === 3) rec.third += 1;
      dominantSeasons.push(asSeason(entry, h.season, rank));
    });
    if (shortlist.length > 0) {
      rollOfHonour.push({
        season: h.season,
        winner: asSeason(shortlist[0], h.season, 1),
        runnerUp: shortlist.length > 1 ? asSeason(shortlist[1], h.season, 2) : null,
      });
    }

    for (const pid of h.world?.worldTeamOfYear ?? []) {
      if (pid != null) credit(pid, h.season, "worldXI");
    }
    for (const a of Object.values(h.awards ?? {})) {
      if (a.playerOfSeasonPid != null) credit(a.playerOfSeasonPid, h.season, "playerOfSeason");
      if (a.goldenBootPid != null) credit(a.goldenBootPid, h.season, "goldenBoot");
      for (const pid of a.teamOfSeason ?? []) {
        if (pid != null) credit(pid, h.season, "teamOfSeason");
      }
    }
  }

  for (const [pid, seasons] of winSeasons) {
    seasons.sort((a, b) => a - b);
    let run = 1;
    let best = 1;
    for (let i = 1; i < seasons.length; i++) {
      run = seasons[i] === seasons[i - 1] + 1 ? run + 1 : 1;
      if (run > best) best = run;
    }
    ballonRecord(pid).bestRun = best;
  }

  const rows: AwardCareerRow[] = [];
  for (const career of careers) {
    const h = honours.get(career.pid);
    const b = ballon.get(career.pid) ?? emptyBallonDOr();
    const tally = emptyTally();
    if (h) {
      for (const key of INDIVIDUAL_KEYS) {
        tally[key] = h[key];
        tally.total += h[key];
      }
    }
    if (tally.total === 0 && b.shortlists === 0) continue;
    rows.push({
      career,
      honours: h ?? {
        ballonDOr: 0, worldXI: 0, playerOfSeason: 0, goldenBoot: 0,
        teamOfSeason: 0, leagueTitles: 0, cupTitles: 0, worldCups: 0,
      },
      tally,
      ballon: b,
    });
  }

  // Only winners are ranked by age: a shortlist place isn't the record people
  // mean by "youngest ever", and including them would bury the winners.
  const winnersWithAge = dominantSeasons.filter((s) => s.rank === 1 && s.age !== null);
  const byAge = (dir: 1 | -1) => [...winnersWithAge]
    .sort((a, b) => dir * (a.age! - b.age!) || a.season - b.season || a.pid - b.pid)
    .slice(0, AWARD_LIST_LIMIT);

  const rankTally = <T extends AwardTally>(list: T[]): T[] =>
    list.filter((r) => r.total > 0).sort((a, b) =>
      b.total - a.total || b.ballonDOr - a.ballonDOr || b.worldXI - a.worldXI,
    ).slice(0, AWARD_LIST_LIMIT);

  return {
    careers: sortAwardRows(rows, "total", rows.length),
    ballonDOr: rows
      .filter((r) => r.ballon.shortlists > 0)
      .sort((a, b) =>
        b.ballon.shares - a.ballon.shares
        || b.ballon.wins - a.ballon.wins
        || a.career.pid - b.career.pid)
      .slice(0, AWARD_LIST_LIMIT),
    dominantSeasons: [...dominantSeasons]
      .sort((a, b) => b.entry.score - a.entry.score || a.pid - b.pid)
      .slice(0, AWARD_LIST_LIMIT),
    rollOfHonour: rollOfHonour.sort((a, b) => b.season - a.season),
    youngestWinners: byAge(1),
    oldestWinners: byAge(-1),
    clubs: rankTally([...clubs.values()]),
    nations: rankTally([...nations.values()]),
    seasonsRecorded: league.seasonHistory.length,
  };
}

/**
 * The career board, re-ranked by one award.
 *
 * Kept separate from `computeAwardTrivia` so switching the ranking is a sort of
 * rows already in hand rather than a fresh pass over the whole save's history.
 */
export function sortAwardRows(
  rows: readonly AwardCareerRow[],
  key: AwardKey,
  limit = AWARD_CAREER_LIMIT,
): AwardCareerRow[] {
  return rows
    .filter((r) => r.tally[key] > 0)
    .sort((a, b) =>
      b.tally[key] - a.tally[key]
      // Ties break on the whole haul, then on pid so the order can't shuffle
      // between renders.
      || b.tally.total - a.tally.total
      || b.ballon.shares - a.ballon.shares
      || a.career.pid - b.career.pid)
    .slice(0, limit);
}
