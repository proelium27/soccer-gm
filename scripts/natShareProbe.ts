/**
 * Realized nationality shares for a league table, REST bucket expanded.
 *
 * A table's weights are normalized to whatever they total, and the REST bucket
 * is weighted by TAIL_BASE (built from the Premier League's own foreign
 * makeup), so what a table *states* and what it *draws* are different numbers.
 * This samples the real draw so a table can be checked against a published
 * breakdown.
 *
 *   npx tsx scripts/natShareProbe.ts Scotland Greece Serbia
 */
import { mulberry32 } from "../src/engine/rng.js";
import { pickNationality } from "../src/core/players/nationalities.js";

const N = 200_000;
for (const country of process.argv.slice(2)) {
  const rng = mulberry32(12345);
  const counts = new Map<string, number>();
  for (let i = 0; i < N; i++) {
    const n = pickNationality(rng, country);
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  const rows = [...counts].sort((a, b) => b[1] - a[1]);
  console.log(`\n=== ${country} (${N} draws) ===`);
  for (const [n, c] of rows.slice(0, 25)) {
    console.log(`${((100 * c) / N).toFixed(1).padStart(5)}%  ${n}`);
  }
  console.log(`  ...${rows.length - 25} more nations`);
}
