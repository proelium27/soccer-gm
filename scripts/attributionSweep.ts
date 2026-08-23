/**
 * Does steepening the box-score attribution draws make the stats mean anything,
 * and what does it cost?
 *
 * Every draw in engine/attribution.ts weights a candidate by
 * `positionWeight x (rating + 10)`, a weak discriminator: an 80-rated player
 * takes only 1.8x the share of a 40-rated one at the same position.
 * ATTRIBUTION_RATING_EXPONENT raises the rating term to a power.
 *
 * Reports, per credit axis, the correlation between the relevant rating and the
 * player's per-appearance output, plus the three things that bound the constant:
 *
 *   - REALISM. The number of credited events per match is FIXED (by
 *     CREDITED_TURNOVER_PROB and the shot rolls), so steepening only
 *     redistributes them. Push far enough and one man takes his club's whole
 *     workload. Reported as the actions distribution and the busiest defender's
 *     share of his club's total.
 *   - CALIBRATION. goals/game, and the tier-1 top scorer, which the M3 gate
 *     bands at 18-36. Concentrating shots on the best finisher compounds with
 *     SHOOTER_FINISH_WEIGHT (he also converts better), so the top scorer is the
 *     number most at risk here.
 *   - RESTATEMENT OF OVR. If output becomes a tight function of overall rating,
 *     the board says nothing a rating column doesn't. The gap between
 *     r(specific skill) and r(ovr) is where independent information lives.
 *
 * Override the constant with SGM_ATTRIBUTION_EXPONENT to sweep.
 * Run: SGM_ATTRIBUTION_EXPONENT=2 npx tsx scripts/attributionSweep.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { leagueMatchData } from "../src/core/league/composites.js";
import { simMatchDetailed } from "../src/engine/matchSim.js";
import { ATTRIBUTION_RATING_EXPONENT } from "../src/engine/constants.js";

const SEED = Number(process.env.SEED ?? 7001);

const league = createLeagueState(0, mulberry32(SEED));
const data = leagueMatchData({
  teams: league.teams.map((t) => ({ ...t, avgOvr: 0 })),
  players: league.players,
});
const byPid = new Map(league.players.map((p) => [p.pid, p]));
const clubOf = new Map<number, number>();
for (const t of league.teams) for (const pid of t.roster) clubOf.set(pid, t.tid);
const idxOf = new Map(league.teams.map((t, i) => [t.tid, i]));
const comp = league.teams[0].compId;
const tids = league.teams.filter((t) => t.compId === comp).map((t) => t.tid);

const defActions = new Map<number, number>();
const assists = new Map<number, number>();
const goalsBy = new Map<number, number>();
const shotsBy = new Map<number, number>();
const apps = new Map<number, number>();
let goals = 0;
let matches = 0;

let m = 0;
for (const h of tids) {
  for (const a of tids) {
    if (h === a) continue;
    const hd = data[idxOf.get(h)!];
    const ad = data[idxOf.get(a)!];
    const r = simMatchDetailed(
      mulberry32(500000 + m++),
      hd.composites, ad.composites, hd.xi, ad.xi, hd.bench, ad.bench,
      { recompute: { home: hd.recompute, away: ad.recompute } },
    );
    goals += r.home + r.away;
    matches++;
    for (const line of [...r.boxScore.home, ...r.boxScore.away]) {
      if (line.minutesPlayed <= 0) continue;
      const add = (map: Map<number, number>, v: number) =>
        map.set(line.pid, (map.get(line.pid) ?? 0) + v);
      add(defActions, line.tackles + line.interceptions);
      add(assists, line.assists);
      add(goalsBy, line.goals);
      add(shotsBy, line.shots);
      add(apps, 1);
    }
  }
}

const mean = (v: number[]) => (v.length === 0 ? 0 : v.reduce((a, b) => a + b, 0) / v.length);
function corr(xs: number[], ys: number[]): { r: number; slope: number } {
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return { r: num / Math.sqrt(dx * dy), slope: num / dx };
}

/** One credit axis: correlate a rating against a per-appearance output. */
function axis(
  label: string,
  positions: string[],
  ratingOf: (p: ReturnType<typeof byPid.get> & object) => number,
  output: Map<number, number>,
): void {
  const xs: number[] = [];
  const ovrs: number[] = [];
  const ys: number[] = [];
  for (const [pid, n] of apps) {
    if (n < 10) continue;
    const p = byPid.get(pid);
    if (!p || !positions.includes(p.pos)) continue;
    xs.push(ratingOf(p));
    ovrs.push(p.ovr);
    ys.push((output.get(pid) ?? 0) / n);
  }
  const skill = corr(xs, ys);
  const ovr = corr(ovrs, ys);
  console.log(
    `  ${label.padEnd(30)} n=${String(xs.length).padStart(3)}  ` +
      `r(skill) ${skill.r.toFixed(3)}  r(ovr) ${ovr.r.toFixed(3)}  ` +
      `gap ${(skill.r - ovr.r).toFixed(3)}  mean/app ${mean(ys).toFixed(3)}`,
  );
}

console.log(`exponent: ${ATTRIBUTION_RATING_EXPONENT}   (1 = pre-change linear draw)`);
console.log(`goals/game: ${(goals / matches).toFixed(4)}   matches: ${matches}\n`);

console.log("credit axes — does the relevant skill predict the output?");
axis("defence: tackles+intercepts", ["CB", "FB", "DM"],
  (p) => (p.ratings.tackling + p.ratings.interceptions) / 2, defActions);
axis("creation: assists", ["AM", "W", "CM"],
  (p) => (p.ratings.shortPass + p.ratings.longPass) / 2, assists);
axis("shooting: shots", ["ST", "W", "AM"],
  (p) => (p.ratings.finishing + p.ratings.longShot) / 2, shotsBy);
axis("finishing: goals", ["ST", "W", "AM"],
  (p) => (p.ratings.finishing + p.ratings.longShot) / 2, goalsBy);

// --- calibration -----------------------------------------------------------
const topScorer = Math.max(...[...goalsBy.values()]);
console.log(`\ncalibration`);
console.log(`  goals/game        ${(goals / matches).toFixed(4)}`);
console.log(`  top scorer        ${topScorer}   (M3 gate bands the tier-1 mean at 18-36)`);

// --- realism ---------------------------------------------------------------
const defPer: number[] = [];
const byClub = new Map<number, number[]>();
for (const [pid, n] of apps) {
  if (n < 10) continue;
  const p = byPid.get(pid);
  if (!p || !["CB", "FB", "DM"].includes(p.pos)) continue;
  defPer.push((defActions.get(pid) ?? 0) / n);
  const tid = clubOf.get(pid);
  if (tid === undefined) continue;
  const arr = byClub.get(tid) ?? [];
  arr.push(defActions.get(pid) ?? 0);
  byClub.set(tid, arr);
}
const sorted = [...defPer].sort((a, b) => a - b);
const pct = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
const shares: number[] = [];
for (const arr of byClub.values()) {
  if (arr.length < 3) continue;
  const tot = arr.reduce((a, b) => a + b, 0);
  if (tot > 0) shares.push(Math.max(...arr) / tot);
}
console.log(`\nrealism (the binding constraint — total credited events is fixed)`);
console.log(`  defensive actions/app  p50 ${pct(0.5).toFixed(2)}  p90 ${pct(0.9).toFixed(2)}  max ${sorted.at(-1)!.toFixed(2)}   (busy CB band ~4-11)`);
console.log(`  busiest defender's share of his club's actions: ${(mean(shares) * 100).toFixed(1)}%`);
