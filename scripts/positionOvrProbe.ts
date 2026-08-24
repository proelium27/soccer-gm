/**
 * Position-OVR balance probe.
 *
 * Question: are the best players in the world always the same positions?
 * Two separate mechanisms can cause that and they need different fixes:
 *   1. MEAN  — a position's OVR weights sit on high-tier skills, so every
 *      player at that position reads a few points above the pack.
 *   2. SPREAD — a position's weights are concentrated on few skills, so its
 *      OVR has a larger standard deviation. Ratings are independent draws, so
 *      OVR sd = RATING_NOISE_SD * sqrt(sum((w/100)^2)); a concentrated row
 *      wins the extreme tail even with an identical mean.
 *
 * Prints per-position mean/sd plus the composition of the top 10/50/200 of the
 * world, against the population share each position has (ROSTER_COMPOSITION).
 *
 * Run: npx tsx scripts/positionOvrProbe.ts   (SEASONS=n to age the world)
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import type { Player, Position } from "../src/core/players/types.js";
import { OVR_WEIGHTS } from "../src/core/players/templates.js";
import { ROSTER_COMPOSITION, RATING_NOISE_SD } from "../src/core/constants.js";

const POS: Position[] = ["GK", "CB", "FB", "DM", "CM", "AM", "W", "ST"];
const SEASONS = Number(process.env.SEASONS ?? 0);
const SEED = Number(process.env.SEED ?? 1);

// --- analytic: the sd multiplier implied by each position's weight row ---
console.log("weight concentration (analytic OVR sd from independent rating draws)");
for (const p of POS) {
  const w = OVR_WEIGHTS[p];
  const keys = Object.keys(w) as (keyof typeof w)[];
  const sumSq = keys.reduce((a, k) => a + (w[k]! / 100) ** 2, 0);
  const total = keys.reduce((a, k) => a + w[k]!, 0);
  console.log(
    `  ${p.padEnd(3)} weights sum ${String(total).padStart(3)}  ` +
      `sd multiplier ${Math.sqrt(sumSq).toFixed(3)}  ` +
      `=> ovr sd ~${(Math.sqrt(sumSq) * RATING_NOISE_SD).toFixed(2)}`,
  );
}

const rng = mulberry32(SEED);
let league = createLeagueState(0, rng);
for (let s = 0; s < SEASONS; s++) {
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);
}

// Rostered players only — the free-agent pool is thousands of unsigned
// nobodies whose position mix says nothing about what the user ever sees.
const rostered = new Set<number>();
for (const t of league.teams) for (const pid of t.roster) rostered.add(pid);
const players: Player[] = league.players.filter((p) => rostered.has(p.pid));
const byPos = new Map<Position, number[]>(POS.map((p) => [p, []]));
for (const p of players) byPos.get(p.pos)!.push(p.ovr);

const compTotal = POS.reduce((a, p) => a + ROSTER_COMPOSITION[p], 0);

console.log(`\nworld after ${SEASONS} season(s), seed ${SEED}: ${players.length} players`);
console.log("pos   n     share   mean    sd    p90   max");
for (const p of POS) {
  const v = byPos.get(p)!.slice().sort((a, b) => a - b);
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  const p90 = v[Math.floor(v.length * 0.9)];
  console.log(
    `${p.padEnd(4)} ${String(v.length).padStart(4)} ${(100 * v.length / players.length).toFixed(1).padStart(6)}% ` +
      `${mean.toFixed(2).padStart(6)} ${sd.toFixed(2).padStart(5)} ${String(p90).padStart(5)} ${String(v[v.length - 1]).padStart(5)}`,
  );
}

const sorted = players.slice().sort((a, b) => b.ovr - a.ovr);
console.log("\ntop-N composition (count | expected from roster share)");
console.log("pos    top10   top50   top200   expected%");
for (const p of POS) {
  const c = (n: number) => sorted.slice(0, n).filter((x) => x.pos === p).length;
  const exp = (100 * ROSTER_COMPOSITION[p]) / compTotal;
  console.log(
    `${p.padEnd(4)} ${String(c(10)).padStart(7)} ${String(c(50)).padStart(7)} ${String(c(200)).padStart(8)}` +
      `   ${exp.toFixed(1).padStart(6)}%`,
  );
}

// The headline number: whose face is on the club. OVR is an integer and a
// squad's top few sit within a point or two, so ties are common — awarding one
// to whoever appears first in the roster array biases this whole table by
// generation order (it read as a 4-point positional skew until it was split).
console.log("\nbest player at each club, by position");
const bestPos = new Map<Position, number>(POS.map((p) => [p, 0]));
const byPid = new Map(players.map((p) => [p.pid, p]));
for (const t of league.teams) {
  const squad = t.roster.map((pid) => byPid.get(pid)).filter((p): p is Player => !!p);
  if (squad.length === 0) continue;
  const max = Math.max(...squad.map((p) => p.ovr));
  const tied = squad.filter((p) => p.ovr === max);
  for (const p of tied) bestPos.set(p.pos, bestPos.get(p.pos)! + 1 / tied.length);
}
for (const p of POS) {
  console.log(`  ${p.padEnd(3)} ${bestPos.get(p)!.toFixed(1).padStart(6)} clubs  (expected ~${((100 * ROSTER_COMPOSITION[p]) / compTotal).toFixed(1)}%  = ${((league.teams.length * ROSTER_COMPOSITION[p]) / compTotal).toFixed(0)})`);
}
