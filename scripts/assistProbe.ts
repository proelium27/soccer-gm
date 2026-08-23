/**
 * Does a creative player's passing actually predict his assists?
 *
 * The engine carried no passing attribute until MatchPlayer.passing was added,
 * so pickAssister weighted the assist draw by `dribbling` — an assist was in
 * effect a dribbling stat. Measured here over a full simmed league season, on
 * the merge base that left a creative midfielder's passing essentially
 * unrelated to his assist count (r = 0.08, slope +0.005 per 10 points) while
 * dribbling carried it (r = 0.32). Keying the draw off passing lands r = 0.31 /
 * slope +0.022, and drops dribbling's spurious grip to r = 0.08.
 *
 * Also prints assists/goals, which should stay pinned near 0.75 — pickAssister
 * returns null on a 25% roll, so a team's assist total carries no information
 * beyond its goal total either way. That ratio holding is the check that this
 * changed WHO is credited without changing how much is credited.
 *
 * Run: npx tsx scripts/assistProbe.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { leagueMatchData } from "../src/core/league/composites.js";
import { simMatchDetailed } from "../src/engine/matchSim.js";

const SEED = Number(process.env.SEED ?? 7001);

const league = createLeagueState(0, mulberry32(SEED));
const data = leagueMatchData({
  teams: league.teams.map((t) => ({ ...t, avgOvr: 0 })),
  players: league.players,
});
const byPid = new Map(league.players.map((p) => [p.pid, p]));
const idxOf = new Map(league.teams.map((t, i) => [t.tid, i]));
const comp = league.teams[0].compId;
const tids = league.teams.filter((t) => t.compId === comp).map((t) => t.tid);

let goals = 0;
let assists = 0;
const aByPid = new Map<number, number>();
const appsByPid = new Map<number, number>();

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
    for (const line of [...r.boxScore.home, ...r.boxScore.away]) {
      goals += line.goals;
      assists += line.assists;
      if (line.minutesPlayed <= 0) continue;
      aByPid.set(line.pid, (aByPid.get(line.pid) ?? 0) + line.assists);
      appsByPid.set(line.pid, (appsByPid.get(line.pid) ?? 0) + 1);
    }
  }
}

console.log(`league goals:   ${goals}`);
console.log(`league assists: ${assists}`);
console.log(`assists / goals = ${(assists / goals).toFixed(4)}   (1 - 0.25 no-assist roll = 0.75)\n`);

// Within one slot, does creativity predict assists? Restricted to the creative
// slots so ASSIST_WEIGHTS is roughly held constant and only the rating varies.
//
// Three attributes are reported because the extension changes two things at
// once: the creator is now drawn on PASSING (pickAssister used dribbling, the
// only proxy available before MatchPlayer carried passing), and his quality now
// feeds the chance. Correlating against dribbling alone would therefore read as
// a regression when it is really the draw having moved to a better attribute.
const rows: { passing: number; dribbling: number; creator: number; per: number }[] = [];
for (const [pid, n] of appsByPid) {
  if (n < 10) continue;
  const p = byPid.get(pid);
  if (!p || !["AM", "W", "CM"].includes(p.pos)) continue;
  const passing = (p.ratings.shortPass + p.ratings.longPass) / 2;
  rows.push({
    passing,
    dribbling: p.ratings.dribbling,
    creator: (passing + p.ratings.dribbling) / 2,
    per: (aByPid.get(pid) ?? 0) / n,
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
console.log(`creative players sampled (AM/W/CM): ${rows.length}`);
console.log(`mean assists per appearance: ${mean(per).toFixed(3)}\n`);
for (const key of ["creator", "passing", "dribbling"] as const) {
  const { r, slope } = corr(rows.map((x) => x[key]), per);
  console.log(
    `  ${key.padEnd(10)} r = ${r.toFixed(3)}   slope ${(slope * 10 >= 0 ? "+" : "")}${(slope * 10).toFixed(4)} assists/app per 10 pts`,
  );
}
