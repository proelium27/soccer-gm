/**
 * World base income — the denominator for "how much money is this feature adding".
 *
 * Prize money is meaningless against other prize money (the domestic cup reads 27%
 * of prize money and ~0.7% of the world's income; only the second number says
 * whether it moves anything). This sums BASE_SEASON_BUDGET across every club in
 * the world, scaled by country and by tier exactly as `financeScale` does.
 */
import { worldCompetitions, competitionTeamCount, competitionBudgetScale } from "../src/core/competitions.js";
import { BASE_SEASON_BUDGET, DIVISION_2_BUDGET_SCALE } from "../src/core/constants.js";

const comps = worldCompetitions();
let world = 0;
const byCountry = new Map<string, number>();

for (const c of comps) {
  const tierScale = DIVISION_2_BUDGET_SCALE ** (c.tier - 1);
  const income = BASE_SEASON_BUDGET * competitionBudgetScale(c) * tierScale * competitionTeamCount(c);
  world += income;
  byCountry.set(c.country, (byCountry.get(c.country) ?? 0) + income);
}

const m = (n: number) => `${(n / 1_000_000).toFixed(1)}M`;
console.log(`${comps.length} competitions, ${comps.reduce((a, c) => a + competitionTeamCount(c), 0)} clubs`);
for (const [country, income] of [...byCountry].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${country.padEnd(14)} ${m(income).padStart(9)}`);
}
console.log(`\nWORLD BASE INCOME: ${m(world)}`);
for (const pot of [180_000_000, 260_000_000, 694_000_000]) {
  console.log(`  a ${m(pot)} pot is ${((pot / world) * 100).toFixed(2)}% of it`);
}
