/**
 * The M1 table-spread gate (champion 78-94 pts, bottom 15-32) averages only 5
 * seeded seasons, and CLAUDE.md warns that single seasons swing 70-87 — so the
 * gate sits near its floor by construction and a small move in it is noise.
 *
 * This runs the same measurement over a much larger sample so a real shift can
 * be told apart from seed luck. Run it on both sides of a change.
 */
import { mulberry32 } from "../src/engine/rng.js";
import { simSeason } from "../src/core/season.js";

const SEASONS = Number(process.argv[2] ?? 20);

const champs: number[] = [];
const bottoms: number[] = [];
for (let s = 0; s < SEASONS; s++) {
  const table = simSeason(mulberry32(1000 + s)).table;
  champs.push(table[0].points);
  bottoms.push(table[table.length - 1].points);
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = avg(xs);
  return Math.sqrt(avg(xs.map((x) => (x - m) ** 2)));
};

console.log(`\n${SEASONS} seeded seasons (seeds 1000..${1000 + SEASONS - 1}):`);
console.log(`  champion  avg ${avg(champs).toFixed(2)}  sd ${sd(champs).toFixed(2)}  min ${Math.min(...champs)}  max ${Math.max(...champs)}`);
console.log(`  bottom    avg ${avg(bottoms).toFixed(2)}  sd ${sd(bottoms).toFixed(2)}  min ${Math.min(...bottoms)}  max ${Math.max(...bottoms)}`);
console.log(`  gate window: champion 78-94, bottom 15-32`);
console.log(`  first 5 seasons (what the gate actually asserts): champion ${avg(champs.slice(0, 5)).toFixed(2)}, bottom ${avg(bottoms.slice(0, 5)).toFixed(2)}`);
