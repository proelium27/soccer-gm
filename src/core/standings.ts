import type { BoxScore } from "../engine/attribution.js";

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
