/**
 * Does the individual-duel sim actually make individual defenders matter?
 *
 * The control arm is the SAME BUILD with SGM_DUEL_TURNOVER_WEIGHT=0 and
 * SGM_DUEL_CHANCE_WEIGHT=0, which reduces every duel term to zero and leaves the
 * composite engine deciding outcomes exactly as it does on main. Comparing
 * against the spike's own zero-weight arm rather than against main is
 * deliberate: the duel draws two extra rng values per tick either way, so the
 * streams stay aligned and stream-shift is removed as a confound. Only the
 * weights differ between arms.
 *
 * Three experiments:
 *
 *  1. LOPSIDED vs BALANCED back line at identical mean quality. This is the
 *     falsifiable prediction. Composites blend each group 30% toward its single
 *     best player (COMPOSITE_STAR_CONCENTRATION), so a (85,55) pair should read
 *     at least as well as (70,70). Under duels the weak defender is drawn on his
 *     own share of ticks and gets got at, so the lopsided side should concede
 *     MORE. If that gap does not appear, the duel model is not doing anything a
 *     team number wasn't already doing.
 *
 *  2. SINGLE-DEFENDER SENSITIVITY: swap one centre-back 55 -> 85 and measure how
 *     much team goals conceded moves. Tests magnitude, not direction.
 *
 *  3. EARNED DEFENSIVE STATS: across a real simmed season, how strongly does a
 *     defender's rating predict his tackle count? Under the old model the
 *     credit pick is weighted by (tackling + 10), a weak discriminator; under
 *     duels the man who actually won the ball is the man credited.
 *
 * Run:  npx tsx scripts/duelIndividuality.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { leagueMatchData } from "../src/core/league/composites.js";
import { simMatchDetailed } from "../src/engine/matchSim.js";
import { computeOvr } from "../src/core/players/ovr.js";
import { SKILL_KEYS, type Player } from "../src/core/players/types.js";
import { DUEL_TURNOVER_WEIGHT, DUEL_CHANCE_WEIGHT } from "../src/engine/constants.js";

const MATCHES = Number(process.env.MATCHES ?? 4000);
const SEED = Number(process.env.SEED ?? 7001);

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]): number => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
const fmt = (n: number, d = 3): string => n.toFixed(d);

/** Flatten every skill of a player to `v`, so his ovr lands on ~v. */
function setFlat(p: Player, v: number): void {
  for (const k of SKILL_KEYS) p.ratings[k] = v;
  p.ovr = computeOvr(p.pos, p.ratings, p.heightCm);
}

/**
 * A LeagueStore in the shape leagueMatchData wants. Mirrors simThrough's own
 * toLeagueTeams, including its `avgOvr: 0` — the field is required by the type
 * and read by nothing in this path.
 */
function asLeague(l: ReturnType<typeof createLeagueState>) {
  return {
    teams: l.teams.map((t) => ({ ...t, avgOvr: 0 })),
    players: l.players,
  };
}

console.log(`duel weights in this process: turnover=${DUEL_TURNOVER_WEIGHT} chance=${DUEL_CHANCE_WEIGHT}`);
console.log(`matches per arm: ${MATCHES}, world seed: ${SEED}\n`);

// One generated world, reused for every arm. Regenerating per arm would change
// the opponent as well as the variable under test.
const baseLeague = createLeagueState(0, mulberry32(SEED));

// Subject and opponent: two mid-table clubs in the same tier-1 competition, so
// the league z-normalization baseline is the one they really play under.
const comp0 = baseLeague.teams.filter((t) => t.compId === baseLeague.teams[0].compId);
const subjectTid = comp0[10].tid;
const opponentTid = comp0[11].tid;

/**
 * Rebuild the world with the subject's two centre-backs set to `cbRatings`, then
 * play `MATCHES` fixtures between subject and opponent and return the subject's
 * goals conceded per match. The subject is always AWAY so the home attack bonus
 * is a constant across arms.
 */
function runArm(cbRatings: [number, number]): {
  conceded: number[];
  scored: number[];
  possession: number[];
} {
  const league = structuredClone(baseLeague);
  const byPid = new Map(league.players.map((p) => [p.pid, p]));
  const subject = league.teams.find((t) => t.tid === subjectTid)!;
  const idxOf = new Map(league.teams.map((t, i) => [t.tid, i]));

  // PIN THE XI FIRST. Without this the experiment silently cancels itself:
  // selectXI drops a centre-back the moment we weaken him below the third
  // choice, so the "lopsided" arm quietly fields a natural replacement and
  // measures nothing. Freezing the natural XI as manual `starters` forces the
  // weakened man to keep playing, which is the whole question.
  const naturalXI = leagueMatchData(asLeague(league))[idxOf.get(subjectTid)!].xi;
  subject.starters = naturalXI.map((p) => p.pid);

  const cbPids = naturalXI.filter((p) => p.slot === "CB").map((p) => p.pid);
  if (cbPids.length < 2) throw new Error("subject club does not field two centre-backs");
  setFlat(byPid.get(cbPids[0])!, cbRatings[0]);
  setFlat(byPid.get(cbPids[1])!, cbRatings[1]);

  const data = leagueMatchData(asLeague(league));
  const sub = data[idxOf.get(subjectTid)!];
  const opp = data[idxOf.get(opponentTid)!];

  const conceded: number[] = [];
  const scored: number[] = [];
  const possession: number[] = [];
  for (let i = 0; i < MATCHES; i++) {
    const rng = mulberry32(900000 + i);
    const r = simMatchDetailed(
      rng,
      opp.composites,
      sub.composites,
      opp.xi,
      sub.xi,
      opp.bench,
      sub.bench,
      { recompute: { home: opp.recompute, away: sub.recompute } },
    );
    conceded.push(r.home);
    scored.push(r.away);
    possession.push(1 - r.possessionHome);
  }
  return { conceded, scored, possession };
}

function report(label: string, arm: ReturnType<typeof runArm>): number {
  const gc = mean(arm.conceded);
  const se = sd(arm.conceded) / Math.sqrt(arm.conceded.length);
  console.log(
    `  ${label.padEnd(26)} conceded ${fmt(gc)} ±${fmt(1.96 * se)}   ` +
      `scored ${fmt(mean(arm.scored))}   poss ${fmt(mean(arm.possession) * 100, 1)}%`,
  );
  return gc;
}

// --- Experiment 1: lopsided vs balanced, identical mean ---------------------
console.log("1. LOPSIDED vs BALANCED back line (same mean quality, 70)");
const balanced = runArm([70, 70]);
const lopsided = runArm([85, 55]);
const gcBalanced = report("balanced  CB 70 / CB 70", balanced);
const gcLopsided = report("lopsided  CB 85 / CB 55", lopsided);
const lopsidedPenalty = gcLopsided - gcBalanced;
console.log(
  `  => lopsided concedes ${lopsidedPenalty >= 0 ? "+" : ""}${fmt(lopsidedPenalty)} goals/match ` +
    `(${fmt((lopsidedPenalty / gcBalanced) * 100, 1)}%)\n`,
);

// --- Experiment 2: single-defender sensitivity ------------------------------
console.log("2. SINGLE-DEFENDER SENSITIVITY (other CB held at 70)");
const weak = runArm([70, 55]);
const strong = runArm([70, 85]);
const gcWeak = report("partner CB 55", weak);
const gcStrong = report("partner CB 85", strong);
console.log(
  `  => 30 rating points on ONE centre-back is worth ${fmt(gcWeak - gcStrong)} goals/match ` +
    `(${fmt(((gcWeak - gcStrong) / gcWeak) * 100, 1)}%)\n`,
);

// --- Experiment 3: are defensive stats earned? ------------------------------
console.log("3. EARNED DEFENSIVE STATS (one simmed season, tier-1 defenders)");
{
  const league = structuredClone(baseLeague);
  const data = leagueMatchData(asLeague(league));
  const comp = league.teams[0].compId;
  const tids = league.teams.filter((t) => t.compId === comp).map((t) => t.tid);
  const idxOf = new Map(league.teams.map((t, i) => [t.tid, i]));
  const byPid = new Map(league.players.map((p) => [p.pid, p]));

  const defActions = new Map<number, number>();
  const apps = new Map<number, number>();

  // Full double round-robin inside the competition.
  let m = 0;
  for (const h of tids) {
    for (const a of tids) {
      if (h === a) continue;
      const rng = mulberry32(500000 + m++);
      const hd = data[idxOf.get(h)!];
      const ad = data[idxOf.get(a)!];
      const r = simMatchDetailed(rng, hd.composites, ad.composites, hd.xi, ad.xi, hd.bench, ad.bench, {
        recompute: { home: hd.recompute, away: ad.recompute },
      });
      for (const line of [...r.boxScore.home, ...r.boxScore.away]) {
        if (line.minutesPlayed <= 0) continue;
        defActions.set(line.pid, (defActions.get(line.pid) ?? 0) + line.tackles + line.interceptions);
        apps.set(line.pid, (apps.get(line.pid) ?? 0) + 1);
      }
    }
  }

  // Correlate a defender's own tackling/interceptions rating with his
  // per-appearance defensive actions. Restricted to CB/FB/DM with a real
  // sample, so the position weighting isn't doing the work.
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [pid, n] of apps) {
    if (n < 10) continue;
    const p = byPid.get(pid);
    if (!p || !["CB", "FB", "DM"].includes(p.pos)) continue;
    xs.push((p.ratings.tackling + p.ratings.interceptions) / 2);
    ys.push((defActions.get(pid) ?? 0) / n);
  }
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  const r = num / Math.sqrt(dx * dy);
  const slope = num / dx;
  console.log(`  defenders sampled: ${xs.length}`);
  console.log(`  mean defensive actions per appearance: ${fmt(my, 2)}`);
  console.log(`  correlation(rating, actions/app) r = ${fmt(r)}`);
  console.log(`  slope: +${fmt(slope * 10, 3)} actions per 10 rating points\n`);
}
