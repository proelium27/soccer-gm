import type { BoxScore, PlayerMatchLine } from "../engine/attribution.js";

export interface MatchScore {
  home: number;
  away: number;
  homeGoals: number;
  awayGoals: number;
}

export interface PlayedMatch extends MatchScore {
  possessionHome: number;
  matchday: number;
  boxScore: BoxScore;
}

export interface StandingsRow {
  tid: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

/** A club's aggregated box-score totals for one season, for the Team Stat Leaders history. */
export interface TeamSeasonStats {
  tid: number;
  played: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  xg: number;
  /** Total goals conceded across the season; see PlayerMatchLine.goalsAgainst (only nonzero on the match's GK line). */
  goalsAgainst: number;
  /** Total expected goals against; see PlayerMatchLine.xga. */
  xga: number;
  saves: number;
  tackles: number;
  /** Average possession share (0-100) across the team's matches. */
  possessionPct: number;
  /** Average match rating across every appearance with minutes played. */
  avgRating: number;
}

/** A completed season's final table, snapshotted at offseason rollover before `played` is cleared. */
export interface SeasonHistoryEntry {
  season: number;
  table: StandingsRow[];
  championTid: number;
  teamStats: TeamSeasonStats[];
}

/** Sum each club's box-score lines across a season's played matches. */
export function computeTeamSeasonStats(teamIds: number[], matches: PlayedMatch[]): TeamSeasonStats[] {
  const rows = new Map<number, TeamSeasonStats>();
  for (const tid of teamIds) {
    rows.set(tid, {
      tid, played: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, xg: 0, goalsAgainst: 0, xga: 0,
      saves: 0, tackles: 0, possessionPct: 0, avgRating: 0,
    });
  }

  const ratingSum = new Map<number, number>();
  const ratingCount = new Map<number, number>();
  const possessionSum = new Map<number, number>();

  const addLines = (tid: number, lines: PlayerMatchLine[]): void => {
    const r = rows.get(tid);
    if (!r) return;
    r.played++;
    for (const l of lines) {
      r.goals += l.goals;
      r.assists += l.assists;
      r.shots += l.shots;
      r.shotsOnTarget += l.shotsOnTarget;
      r.xg += l.xg;
      r.goalsAgainst += l.goalsAgainst;
      r.xga += l.xga;
      r.saves += l.saves;
      r.tackles += l.tackles;
      if (l.minutesPlayed > 0) {
        ratingSum.set(tid, (ratingSum.get(tid) ?? 0) + l.rating);
        ratingCount.set(tid, (ratingCount.get(tid) ?? 0) + 1);
      }
    }
  };

  for (const m of matches) {
    addLines(m.home, m.boxScore.home);
    addLines(m.away, m.boxScore.away);
    possessionSum.set(m.home, (possessionSum.get(m.home) ?? 0) + m.possessionHome * 100);
    possessionSum.set(m.away, (possessionSum.get(m.away) ?? 0) + (1 - m.possessionHome) * 100);
  }

  for (const r of rows.values()) {
    const count = ratingCount.get(r.tid) ?? 0;
    r.avgRating = count > 0 ? (ratingSum.get(r.tid) ?? 0) / count : 0;
    r.possessionPct = r.played > 0 ? (possessionSum.get(r.tid) ?? 0) / r.played : 0;
  }

  return [...rows.values()];
}

/** Build a league table (3/1/0), sorted by points, then GD, then GF, then tid. */
export function computeStandings(teamIds: number[], matches: MatchScore[]): StandingsRow[] {
  const rows = new Map<number, StandingsRow>();
  for (const tid of teamIds)
    rows.set(tid, { tid, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });

  const record = (tid: number, gf: number, ga: number): void => {
    const r = rows.get(tid)!;
    r.played++;
    r.gf += gf;
    r.ga += ga;
    r.gd = r.gf - r.ga;
    if (gf > ga) { r.won++; r.points += 3; }
    else if (gf === ga) { r.drawn++; r.points += 1; }
    else { r.lost++; }
  };

  for (const m of matches) {
    record(m.home, m.homeGoals, m.awayGoals);
    record(m.away, m.awayGoals, m.homeGoals);
  }

  return [...rows.values()].sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.tid - b.tid,
  );
}
