/**
 * Transfer-fee distribution audit.
 *
 * Measures what fees the market actually produces over a dynasty: the
 * percentile spread of paid fees, how often deals land in the "mega transfer"
 * brackets (100M+/200M+/at the MAX_TRANSFER_VALUE clamp), and the rich-to-poor
 * spread of club budgets that funds them.
 *
 * Target shape (user brief, 2026-07-30): most quality players 30-70M, 100M+
 * only for genuine stars, record fees near the real-world ~350M-in-today's-money
 * mark rather than a constant occurrence.
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { trueTransferValue } from "../src/core/finance/valuation.js";
import { ovrDuringSeason } from "../src/core/awards.js";
import type { Player } from "../src/core/players/types.js";

const SEASONS = Number(process.env.SEASONS ?? 20);
const SEEDS = (process.env.SEEDS ?? "1,2,3").split(",").map(Number);

const m = (n: number) => `${(n / 1_000_000).toFixed(1)}M`;

function pct(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

const share = (xs: number[], t: number) =>
  `${((100 * xs.filter((x) => x >= t).length) / Math.max(1, xs.length)).toFixed(1)}%`;

/** A synthetic player at a given ovr/age, for pricing the raw valuation curve. */
function probe(ovr: number, potential = ovr): Player {
  return {
    pid: -1, born: 2000, ovr, potential,
    contract: { salary: 0, expiresSeason: 2003 },
  } as unknown as Player;
}

console.log(`=== valuation curve (age 26, no potential gap, 3yr deal) ===`);
for (const ovr of [60, 65, 70, 72, 75, 76, 78, 80, 82, 85, 88, 90, 93]) {
  const p = probe(ovr);
  (p as { born: number }).born = 2000 - 26;
  console.log(`  ovr ${ovr}: ${m(trueTransferValue(p, 2000))}`);
}
console.log(`\n=== valuation curve (age 20, potential +12) ===`);
for (const ovr of [60, 65, 70, 75, 80]) {
  const p = probe(ovr, ovr + 12);
  (p as { born: number }).born = 2000 - 20;
  console.log(`  ovr ${ovr}: ${m(trueTransferValue(p, 2000))}`);
}

const allFees: number[] = [];
const allBigDeals: { fee: number; ovr: number; season: number }[] = [];

for (const seed of SEEDS) {
  const rng = mulberry32(seed);
  let league = createLeagueState(0, rng);
  const userTid = league.meta.userTid;

  const seedFees: number[] = [];

  for (let s = 1; s <= SEASONS; s++) {
    league = simThrough(league, "season", rng);
    league = simOffseason(league, rng);
  }

  const byPid = new Map(league.players.map((p) => [p.pid, p]));
  for (const t of league.transfers) {
    // Paid permanent moves only: skip loans, loan returns, and free arrivals.
    if (t.loanSeasons || t.loanReturn || t.fromTid < 0) continue;
    if (t.fromTid === userTid || t.toTid === userTid) continue; // unmanaged user club
    if (t.fee <= 0) continue;
    seedFees.push(t.fee);
    if (t.fee >= 100_000_000) {
      // OVR *at the time of the move* (Player.hist), not present-day ovr — a
      // player bought young and grown, or bought at peak and declined, would
      // otherwise be scored at a rating he never carried into the deal.
      const pl = byPid.get(t.pid);
      allBigDeals.push({ fee: t.fee, ovr: pl ? ovrDuringSeason(pl, t.season) : 0, season: t.season });
    }
  }

  allFees.push(...seedFees);

  const budgets = league.teams.filter((t) => t.tid !== userTid).map((t) => t.budget).sort((a, b) => b - a);
  console.log(`\n=== seed ${seed} (${SEASONS} seasons) ===`);
  console.log(`  paid transfers: ${seedFees.length}  (${(seedFees.length / SEASONS).toFixed(0)}/season)`);
  console.log(`  fee median ${m(pct(seedFees, 50))}  p75 ${m(pct(seedFees, 75))}  p90 ${m(pct(seedFees, 90))}  p99 ${m(pct(seedFees, 99))}  max ${m(Math.max(...seedFees, 0))}`);
  console.log(`  budgets: top ${m(budgets[0] ?? 0)}  p90 ${m(budgets[Math.floor(budgets.length * 0.1)] ?? 0)}  median ${m(budgets[Math.floor(budgets.length / 2)] ?? 0)}  bottom ${m(budgets[budgets.length - 1] ?? 0)}`);
}

console.log(`\n=== pooled (${allFees.length} paid transfers) ===`);
for (const p of [10, 25, 50, 75, 90, 95, 99]) console.log(`  p${p}: ${m(pct(allFees, p))}`);
console.log(`  max: ${m(Math.max(...allFees, 0))}`);
console.log(`  share >= 30M: ${share(allFees, 30_000_000)}`);
console.log(`  share >= 70M: ${share(allFees, 70_000_000)}`);
console.log(`  share >= 100M: ${share(allFees, 100_000_000)}`);
console.log(`  share >= 200M: ${share(allFees, 200_000_000)}`);
console.log(`  share >= 300M: ${share(allFees, 300_000_000)}`);
console.log(`  100M+ deals: ${allBigDeals.length} over ${SEASONS * SEEDS.length} club-seasons = ${(allBigDeals.length / (SEASONS * SEEDS.length)).toFixed(1)}/season`);
const bigOvrs = allBigDeals.map((d) => d.ovr).filter((o) => o > 0);
if (bigOvrs.length) {
  console.log(`  100M+ ovr AT TRANSFER: p10 ${pct(bigOvrs, 10)}  median ${pct(bigOvrs, 50)}  p90 ${pct(bigOvrs, 90)}  max ${Math.max(...bigOvrs)}`);
  console.log(`  100M+ deals for ovr < 76 (not a genuine star): ${share(bigOvrs.map((o) => (o < 76 ? 1 : 0)), 1)}`);
}
