/**
 * Does the duel model hold league calibration?
 *
 * The mean-zero construction claims league-wide rates are preserved by
 * construction. This checks that claim at league scale rather than in a
 * two-club harness, on the numbers the validation gates actually assert:
 * goals per game, champion points, the tier-1 Golden Boot, and the spread of
 * the table (which is what "does quality still decide matches" reduces to).
 *
 * Control arm is the same build with both duel weights at 0 — see
 * duelIndividuality.ts for why that is the right control.
 *
 * Run:  SEASONS=3 npx tsx scripts/duelCalibration.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { computeStandings } from "../src/core/standings.js";
import { DUEL_TURNOVER_WEIGHT, DUEL_CHANCE_WEIGHT } from "../src/engine/constants.js";

const SEASONS = Number(process.env.SEASONS ?? 3);
const BASE_SEED = Number(process.env.BASE_SEED ?? 4200);

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
const fmt = (n: number, d = 2): string => n.toFixed(d);

console.log(`duel weights: turnover=${DUEL_TURNOVER_WEIGHT} chance=${DUEL_CHANCE_WEIGHT}`);
console.log(`seasons: ${SEASONS}\n`);

const goalsPerGame: number[] = [];
const championPts: number[] = [];
const bottomPts: number[] = [];
const ptsSpread: number[] = [];
const topScorers: number[] = [];

for (let s = 0; s < SEASONS; s++) {
  const rng = mulberry32(BASE_SEED + s);
  let league = createLeagueState(0, rng);
  league = simThrough(league, "season", rng);

  const tier1 = new Set(
    league.competitions.filter((c) => c.tier === 1).map((c) => c.id),
  );
  const compOfTid = new Map(league.teams.map((t) => [t.tid, t.compId]));

  // One table per tier-1 competition, built from that competition's own
  // fixtures so goals-per-game is a per-league number rather than a world mean.
  for (const comp of league.competitions) {
    if (comp.tier !== 1) continue;
    const tids = league.teams.filter((t) => t.compId === comp.id).map((t) => t.tid);
    const tidSet = new Set(tids);
    const matches = league.played.filter((m) => tidSet.has(m.home) && tidSet.has(m.away));
    if (matches.length === 0) continue;

    const rows = computeStandings(tids, matches).sort((a, b) => b.points - a.points);
    championPts.push(rows[0].points);
    bottomPts.push(rows[rows.length - 1].points);
    ptsSpread.push(rows[0].points - rows[rows.length - 1].points);
    const totalGoals = matches.reduce((a, m) => a + m.homeGoals + m.awayGoals, 0);
    goalsPerGame.push(totalGoals / matches.length);
  }

  // Tier-1 Golden Boot, per competition, then averaged — the quantity the M3
  // gate is actually about (a world-wide max is a function of world size).
  const bestByComp = new Map<number, number>();
  for (const p of league.players) {
    for (const st of p.stats) {
      if (st.season !== league.season) continue;
      const compId = compOfTid.get(st.tid);
      if (compId === undefined || !tier1.has(compId)) continue;
      bestByComp.set(compId, Math.max(bestByComp.get(compId) ?? 0, st.goals));
    }
  }
  for (const v of bestByComp.values()) topScorers.push(v);
}

const line = (label: string, xs: number[]): void => {
  console.log(
    `  ${label.padEnd(24)} ${fmt(mean(xs))}  (sd ${fmt(sd(xs))}, min ${fmt(Math.min(...xs))}, max ${fmt(Math.max(...xs))}, n=${xs.length})`,
  );
};

console.log("tier-1 league aggregates");
line("goals per game", goalsPerGame);
line("champion points", championPts);
line("bottom points", bottomPts);
line("champion - bottom", ptsSpread);
line("top scorer", topScorers);
