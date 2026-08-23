/**
 * Does steepening the defensive credit draw make the tackles board mean anything?
 *
 * pickTackler/pickInterceptor weight the draw by posWeight x (rating + 10), a
 * weak discriminator: an 80-rated defender gets only 1.8x the share of a
 * 40-rated one. SGM_DEFENSIVE_CREDIT_EXPONENT raises the rating term to a power
 * (1 = shipped behaviour), which sharpens it at no runtime cost.
 *
 * The question is NOT simply "does correlation go up" — it trivially does. Two
 * things decide whether that is worth having:
 *
 *  1. Does the leaderboard start showing good defenders? Reported as the mean
 *     defensive rating of the top 10 by defensive actions, against the pool mean.
 *     That is the reader's actual question ("who are my best defenders").
 *
 *  2. Does the stat collapse into a restatement of OVR? If actions/app becomes a
 *     tight function of rating, the board tells you nothing a rating column
 *     doesn't already. Reported as r(ovr, actions/app) alongside the intended
 *     r(defensive rating, actions/app) — the gap between them is the only place
 *     independent information can live.
 *
 * Also reports goals/game, because this is NOT scoreline-free: tackles feed
 * computeMatchRating, ratings drive subPriority and the bench-quality gate, so
 * changing who is credited changes substitutions and therefore results.
 *
 * Run: SGM_DEFENSIVE_CREDIT_EXPONENT=2 npx tsx scripts/defensiveCreditSweep.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { leagueMatchData } from "../src/core/league/composites.js";
import { simMatchDetailed } from "../src/engine/matchSim.js";

const SEED = Number(process.env.SEED ?? 7001);
const EXPONENT = process.env.SGM_DEFENSIVE_CREDIT_EXPONENT ?? "1";

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

const actions = new Map<number, number>();
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
      actions.set(line.pid, (actions.get(line.pid) ?? 0) + line.tackles + line.interceptions);
      apps.set(line.pid, (apps.get(line.pid) ?? 0) + 1);
    }
  }
}

interface Row { defRating: number; ovr: number; per: number; name: string }
const rows: Row[] = [];
for (const [pid, n] of apps) {
  if (n < 10) continue;
  const p = byPid.get(pid);
  if (!p || !["CB", "FB", "DM"].includes(p.pos)) continue;
  rows.push({
    defRating: (p.ratings.tackling + p.ratings.interceptions) / 2,
    ovr: p.ovr,
    per: (actions.get(pid) ?? 0) / n,
    name: p.name,
  });
}

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
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

const per = rows.map((r) => r.per);
const defR = corr(rows.map((r) => r.defRating), per);
const ovrR = corr(rows.map((r) => r.ovr), per);

// The reader's question: are the men at the top of the board the good defenders?
const top10 = [...rows].sort((a, b) => b.per - a.per).slice(0, 10);
const poolMeanDef = mean(rows.map((r) => r.defRating));

console.log(`exponent: ${EXPONENT}   (1 = shipped)`);
console.log(`defenders sampled: ${rows.length}   goals/game: ${(goals / matches).toFixed(4)}\n`);
console.log(`  mean actions/app                 ${mean(per).toFixed(3)}`);
console.log(`  r(defensive rating, actions/app) ${defR.r.toFixed(3)}   slope +${(defR.slope * 10).toFixed(4)} per 10 pts`);
console.log(`  r(ovr, actions/app)              ${ovrR.r.toFixed(3)}   <- restatement-of-OVR check`);
console.log(`\n  top 10 by actions/app: mean defensive rating ${mean(top10.map((r) => r.defRating)).toFixed(1)}`);
console.log(`  whole pool:            mean defensive rating ${poolMeanDef.toFixed(1)}`);
console.log(`  => leaderboard lift: ${(mean(top10.map((r) => r.defRating)) - poolMeanDef >= 0 ? "+" : "")}${(mean(top10.map((r) => r.defRating)) - poolMeanDef).toFixed(1)} rating points`);

// REALISM GATE. A leaderboard can be made to "look right" by handing one man
// most of his team's defending, which is not what real sides do. CLAUDE.md's
// calibration target for a busy centre-back is roughly 2-6 tackles and 2-5
// interceptions per match, i.e. about 4-11 combined actions. Anything above
// that band is the draw concentrating, not defenders defending.
const sorted = [...per].sort((a, b) => a - b);
const pct = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
console.log(`\n  actions/app distribution  p50 ${pct(0.5).toFixed(2)}  p90 ${pct(0.9).toFixed(2)}  p99 ${pct(0.99).toFixed(2)}  max ${sorted.at(-1)!.toFixed(2)}`);
console.log(`  (busy centre-back band is roughly 4-11 combined actions per match)`);
// Share of one club's defensive actions taken by its single busiest defender:
// the direct read on whether the draw is concentrating.
const byClub = new Map<number, number[]>();
for (const [pid, n] of apps) {
  if (n < 10) continue;
  const p = byPid.get(pid);
  if (!p || !["CB", "FB", "DM"].includes(p.pos)) continue;
  // From the roster, not p.stats: this script calls simMatchDetailed directly
  // rather than going through accumulateStats, so no stat lines exist to read.
  const tid = clubOf.get(pid) ?? -1;
  if (tid === -1) continue;
  const arr = byClub.get(tid) ?? [];
  arr.push(actions.get(pid) ?? 0);
  byClub.set(tid, arr);
}
const shares: number[] = [];
for (const arr of byClub.values()) {
  if (arr.length < 3) continue;
  const tot = arr.reduce((a, b) => a + b, 0);
  if (tot > 0) shares.push(Math.max(...arr) / tot);
}
console.log(`  busiest defender's share of his club's defensive actions: ${(mean(shares) * 100).toFixed(1)}%  (n=${shares.length} clubs)`);
