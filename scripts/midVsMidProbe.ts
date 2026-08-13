/**
 * Prints the M1 §8 mid-vs-mid benchmark metrics (test/validation/m1-benchmarks.test.ts)
 * so a change's effect on them can be compared against a baseline branch, rather
 * than read off a single pass/fail.
 *
 * The gate averages an average-team-vs-itself scenario over several
 * independently generated leagues, so it is sensitive to anything that shifts
 * the attack/defense balance of a typical XI — including who gets picked.
 *
 * Run: npx tsx scripts/midVsMidProbe.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { runScenario, type ScenarioResult } from "../src/engine/montecarlo.js";
import { generateLeague } from "../src/core/league/generate.js";
import { leagueComposites } from "../src/core/league/composites.js";

const N = Number(process.env.N ?? 20_000);
const LEAGUE_SEEDS = (process.env.SEEDS ?? "1,11,21,31,41").split(",").map(Number);

const keys = ["goalsPerGame", "shotsPerGame", "sotPerGame", "drawPct", "nilNilPct", "homeWinPct"] as const satisfies readonly (keyof ScenarioResult)[];
const sums: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));

// Also report the raw composite levels of the median team, since that is where
// any attack/defense imbalance would originate.
const compKeys = ["attack", "finishing", "defense", "keeping", "control"] as const;
const compSums: Record<string, number> = Object.fromEntries(compKeys.map((k) => [k, 0]));

for (const seed of LEAGUE_SEEDS) {
  const seedComps = leagueComposites(generateLeague(mulberry32(seed)));
  const seedMid = seedComps[Math.floor(seedComps.length / 2)];
  const r = runScenario(seedMid, seedMid, N, 12345);
  for (const k of keys) sums[k] += r[k];
  for (const k of compKeys) compSums[k] += seedMid[k];
}

/**
 * The gate samples ONE team per seed — `seedComps[len/2]`, the middle array
 * index, which after strength targets are shuffled across tids is an arbitrary
 * club rather than the median one. That makes it sensitive to which team lands
 * there. This averages every team's self-match instead, so a real shift in the
 * league's attack/defense balance can be told apart from that sampling noise.
 */
const ALL_N = Number(process.env.ALL_N ?? 2000);
const allSums: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
let allCount = 0;
for (const seed of LEAGUE_SEEDS) {
  const seedComps = leagueComposites(generateLeague(mulberry32(seed)));
  for (const c of seedComps) {
    const r = runScenario(c, c, ALL_N, 999);
    for (const k of keys) allSums[k] += r[k];
    allCount++;
  }
}
console.log(`ALL-TEAM self-match (${allCount} teams, N=${ALL_N}):`);
for (const k of keys) console.log(`  ${k.padEnd(14)} ${(allSums[k] / allCount).toFixed(4)}`);
console.log();

// The faithful correction: the true median team BY STRENGTH, which is how this
// file already picks its strong/weak pair ("by actual generated avgOvr rather
// than array position") but not, until now, its average one.
let medGoals = 0;
for (const seed of LEAGUE_SEEDS) {
  const lg = generateLeague(mulberry32(seed));
  const cs = leagueComposites(lg);
  const byStrength = lg.teams
    .map((t, i) => ({ avgOvr: t.avgOvr, comp: cs[i] }))
    .sort((a, b) => b.avgOvr - a.avgOvr);
  const med = byStrength[Math.floor(byStrength.length / 2)].comp;
  medGoals += runScenario(med, med, N, 12345).goalsPerGame;
}
console.log(`MEDIAN-BY-STRENGTH self-match goals/game: ${(medGoals / LEAGUE_SEEDS.length).toFixed(4)}\n`);

console.log(`mid vs mid, N=${N}, seeds ${LEAGUE_SEEDS.join(",")}`);
for (const k of keys) console.log(`  ${k.padEnd(14)} ${(sums[k] / LEAGUE_SEEDS.length).toFixed(4)}`);
console.log("median team composites:");
for (const k of compKeys) console.log(`  ${k.padEnd(14)} ${(compSums[k] / LEAGUE_SEEDS.length).toFixed(4)}`);
