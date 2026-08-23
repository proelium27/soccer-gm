/**
 * What a board expects, and how big a job it is.
 *
 * Both questions reduce to squad strength, which the game already answers with
 * `computeTeamRating` — the same number Standings, Power Rankings and the Season
 * Preview show the user. Deriving the board's expectations from it means a
 * manager is judged against the squad the user can actually see, never against
 * a hidden yardstick.
 *
 * Deliberately *not* built on `deriveLeagueContexts`'s `stature`. That is the
 * transfer AI's view of a club and carries ambition/frugality machinery this has
 * no use for; coupling the board to it would mean a transfer-market retune
 * silently changing who gets sacked. Pure, rng-free.
 */
import type { Player } from "../players/types.js";
import type { StoredTeam } from "../teams/clubs.js";
import type { Competition } from "../competitions.js";
import type { StandingsRow } from "../standings.js";
import { computeTeamRating } from "../teams/teamRating.js";
import { teamSlots } from "../lineup/formations.js";
import { HYPE_MAX, MANAGER_DEMAND_W_CLUB, MANAGER_DEMAND_W_LEAGUE } from "../constants.js";

export interface ClubExpectation {
  tid: number;
  compId: number;
  /** Squad rating (XI + decayed bench), the raw input to everything here. */
  rating: number;
  /** Where that rating ranks inside this club's own competition, 1 = strongest. */
  expectedRank: number;
  /** How many clubs share that competition. */
  clubs: number;
  /**
   * How big a job this is in *world* terms, [0,1] — squad rating blended with
   * fame, normalized across every club in the save. Drives which clubs come
   * calling, so it has to be comparable across countries and tiers: a mid-table
   * English club is a bigger job than the best club in a second division.
   */
  prestige: number;
  /**
   * How much the board demands, [0,1]. Blends how big this club is inside its
   * own league with how strong that league is in world terms, so the same
   * finish costs a superclub manager far more than it costs a minnow's.
   */
  demand: number;
}

function ratingOf(team: StoredTeam, byPid: Map<number, Player>): number {
  const roster = team.roster.map((pid) => byPid.get(pid)).filter((p): p is Player => p != null);
  if (roster.length === 0) return 0;
  return computeTeamRating(roster, team.starters, teamSlots(team)).ovr;
}

/** Normalize `value` onto [0,1] against a range, flat 0.5 if the range is empty. */
function normalize(value: number, lo: number, hi: number): number {
  if (hi <= lo) return 0.5;
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}

/**
 * Every club's expectation and prestige, keyed by tid.
 *
 * One pass over the world — the caller runs this once per season end, not per
 * club, because prestige and league strength are both world-relative and can't
 * be computed for one club in isolation.
 */
export function deriveExpectations(
  teams: StoredTeam[],
  players: Player[],
  competitions: Competition[],
): Map<number, ClubExpectation> {
  const byPid = new Map(players.map((p) => [p.pid, p]));
  const rating = new Map(teams.map((t) => [t.tid, ratingOf(t, byPid)]));

  // Rank within each competition, and each competition's mean strength.
  const rankByTid = new Map<number, { rank: number; clubs: number }>();
  const compMean = new Map<number, number>();
  for (const comp of competitions) {
    const members = teams.filter((t) => t.compId === comp.id);
    if (members.length === 0) continue;
    const sorted = [...members].sort((a, b) => (rating.get(b.tid) ?? 0) - (rating.get(a.tid) ?? 0));
    sorted.forEach((t, i) => rankByTid.set(t.tid, { rank: i + 1, clubs: sorted.length }));
    compMean.set(
      comp.id,
      members.reduce((sum, t) => sum + (rating.get(t.tid) ?? 0), 0) / members.length,
    );
  }

  const means = [...compMean.values()];
  const leagueLo = Math.min(...means);
  const leagueHi = Math.max(...means);

  // Prestige pools squad rating with fame across the whole world. Hype alone
  // would let a fallen giant coast on reputation forever; rating alone would
  // make an overachieving small club read as a bigger job than it is.
  const prestigeRaw = new Map(
    teams.map((t) => [t.tid, (rating.get(t.tid) ?? 0) + (t.hype / HYPE_MAX) * PRESTIGE_HYPE_POINTS]),
  );
  const raw = [...prestigeRaw.values()];
  const prestigeLo = Math.min(...raw);
  const prestigeHi = Math.max(...raw);

  const out = new Map<number, ClubExpectation>();
  for (const team of teams) {
    const placing = rankByTid.get(team.tid);
    if (!placing) continue;
    // 1 for the strongest club in its league, 0 for the weakest.
    const clubWeight =
      placing.clubs > 1 ? 1 - (placing.rank - 1) / (placing.clubs - 1) : 1;
    const leagueWeight = normalize(compMean.get(team.compId) ?? 0, leagueLo, leagueHi);
    out.set(team.tid, {
      tid: team.tid,
      compId: team.compId,
      rating: rating.get(team.tid) ?? 0,
      expectedRank: placing.rank,
      clubs: placing.clubs,
      prestige: normalize(prestigeRaw.get(team.tid) ?? 0, prestigeLo, prestigeHi),
      demand: MANAGER_DEMAND_W_CLUB * clubWeight + MANAGER_DEMAND_W_LEAGUE * leagueWeight,
    });
  }
  return out;
}

/**
 * How much fame is worth against squad rating when sizing up a job, in rating
 * points. Kept local rather than in constants.ts: it exists only to put two
 * scales on speaking terms inside this file, and nothing else can read it
 * without also owning this normalization.
 */
const PRESTIGE_HYPE_POINTS = 8;

/**
 * Where a club actually finished in its competition, 1 = champions.
 * Returns null if the club played no matches (so the caller can skip judging a
 * season that didn't happen).
 */
export function actualFinish(table: StandingsRow[], tid: number): number | null {
  const index = table.findIndex((row) => row.tid === tid);
  if (index === -1) return null;
  return table[index].played === 0 ? null : index + 1;
}

/**
 * Finish versus expectation, as a fraction of the division: +1.0 means
 * finishing a whole league's worth of places above where the squad ranked,
 * -1.0 the reverse. Zero means you finished exactly where you should have.
 */
export function overperformance(expectedRank: number, finish: number, clubs: number): number {
  if (clubs <= 1) return 0;
  return (expectedRank - finish) / (clubs - 1);
}
