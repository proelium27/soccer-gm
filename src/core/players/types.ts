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
  appearances: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  saves: number;
  tackles: number;
}

export function emptySeasonStats(season: number): SeasonStats {
  return { season, appearances: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, saves: 0, tackles: 0 };
}

export interface RatingsSnapshot { season: number; ratings: PlayerRatings; ovr: number; potential: number; }

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
}
