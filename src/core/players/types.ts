export const POSITIONS = ["GK", "CB", "FB", "DM", "CM", "AM", "W", "ST"] as const;
export type Position = (typeof POSITIONS)[number];

export const SKILL_KEYS = [
  "speed", "strength", "stamina", "jumping",
  "shortPass", "longPass", "crosses",
  "dribbling", "longShot", "finishing",
  "tackling", "interceptions", "positioning", "goalkeeping",
] as const;
export type SkillKey = (typeof SKILL_KEYS)[number];

export type PlayerRatings = Record<SkillKey, number>;

export interface SeasonStats {
  season: number;
  /** Club the player was on as of his most recent appearance that season — not necessarily his club today. */
  tid: number;
  appearances: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  /** Sum of per-shot goal probability across the season; see PlayerMatchLine.xg. */
  xg: number;
  /** Goalkeepers only: total goals conceded across appearances. */
  goalsAgainst: number;
  /** Goalkeepers only: total expected goals against; see PlayerMatchLine.xga. */
  xga: number;
  saves: number;
  tackles: number;
  interceptions: number;
  /** Passes attempted across appearances (decorative; see PlayerMatchLine.passes). */
  passes: number;
  passesCompleted: number;
  crosses: number;
  foulsCommitted: number;
  minutesPlayed: number;
  /** Sum of per-match ratings across appearances; divide by `appearances` for the average. */
  ratingSum: number;
  /** Kept alongside ratingSum (rather than derived on read) so Leaders.tsx can sort/index it like any other stat. */
  avgRating: number;
}

export function emptySeasonStats(season: number, tid: number = -1): SeasonStats {
  return {
    season, tid, appearances: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, xg: 0, goalsAgainst: 0, xga: 0,
    saves: 0, tackles: 0, interceptions: 0, passes: 0, passesCompleted: 0, crosses: 0, foulsCommitted: 0,
    minutesPlayed: 0, ratingSum: 0, avgRating: 0,
  };
}

export interface RatingsSnapshot {
  season: number;
  ratings: PlayerRatings;
  ovr: number;
  potential: number;
  /** Was the player in a club's youth academy (not the senior squad) during this season? Only ever true for the user's own youth — AI clubs have no academy. Old saves are migrated to `false` (all-senior). */
  academy: boolean;
}

export interface Player {
  pid: number;
  name: string;
  nationality: string;
  born: number;
  pos: Position;
  heightCm: number;
  ratings: PlayerRatings;
  ovr: number;
  potential: number;
  contract: { salary: number; expiresSeason: number };
  injury: { gamesRemaining: number; type: string } | null;
  stats: SeasonStats[];
  hist: RatingsSnapshot[];
  /**
   * The season a free-agent signing by the user's club takes effect (set by
   * signFreeAgent). While `league.season <= faSignedSeason` the player can't be
   * sold — a one-season hold that kills the "sign a free agent, flip him for a
   * fee the same window" exploit. Absent for players who were never signed from
   * free agency by the user (and for pre-feature saves — see migrate.ts).
   */
  faSignedSeason?: number;
}
