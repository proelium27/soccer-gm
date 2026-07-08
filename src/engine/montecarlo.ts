import { mulberry32 } from "./rng.js";
import { makeTeam, type Composites } from "./composites.js";
import { simMatch } from "./matchSim.js";

export interface ScenarioResult {
  n: number;
  seed: number;
  goalsPerGame: number;
  homeGoals: number;
  awayGoals: number;
  shotsPerGame: number;
  sotPerGame: number;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  nilNilPct: number;
  topScores: Array<{ score: string; pct: number }>;
}

/** Shared preset teams. One source of truth for CLI, tests, and tuning. */
export const PRESETS: Record<"equal" | "strong" | "weak", Composites> = {
  equal: makeTeam("Average"),
  strong: makeTeam("Strong", {
    attack: 0.63,
    finishing: 0.6,
    defense: 0.63,
    keeping: 0.6,
    control: 0.62,
  }),
  weak: makeTeam("Weak", {
    attack: 0.38,
    finishing: 0.4,
    defense: 0.38,
    keeping: 0.4,
    control: 0.38,
  }),
};

/** Run n matches of home vs away with one seeded RNG stream. Pure: computes, never prints. */
export function runScenario(
  home: Composites,
  away: Composites,
  n: number,
  seed: number,
): ScenarioResult {
  const rng = mulberry32(seed);
  let hG = 0;
  let aG = 0;
  let shots = 0;
  let sot = 0;
  let hW = 0;
  let d = 0;
  let aW = 0;
  let nilnil = 0;
  const scoreCount = new Map<string, number>();

  for (let i = 0; i < n; i++) {
    const r = simMatch(rng, home, away);
    hG += r.home;
    aG += r.away;
    shots += r.stat.home.shots + r.stat.away.shots;
    sot += r.stat.home.sot + r.stat.away.sot;
    if (r.home > r.away) hW++;
    else if (r.home < r.away) aW++;
    else d++;
    if (r.home === 0 && r.away === 0) nilnil++;
    const key = `${r.home}-${r.away}`;
    scoreCount.set(key, (scoreCount.get(key) ?? 0) + 1);
  }

  const topScores = [...scoreCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([score, count]) => ({ score, pct: (100 * count) / n }));

  return {
    n,
    seed,
    goalsPerGame: (hG + aG) / n,
    homeGoals: hG / n,
    awayGoals: aG / n,
    shotsPerGame: shots / n,
    sotPerGame: sot / n,
    homeWinPct: (100 * hW) / n,
    drawPct: (100 * d) / n,
    awayWinPct: (100 * aW) / n,
    nilNilPct: (100 * nilnil) / n,
    topScores,
  };
}
