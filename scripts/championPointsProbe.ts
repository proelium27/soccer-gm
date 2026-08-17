/**
 * Champion / bottom points over many seasons, for reading the M1 table-spread
 * gate honestly.
 *
 * That gate (test/validation/m1-table-spread.test.ts, champion 78-94) averages
 * only 5 seeded seasons and sits near its floor by construction, and single
 * seasons swing roughly 70-87 — so a 5-season average moving a point or two
 * says nothing on its own. CLAUDE.md's standing rule is to re-measure over >=15
 * seasons before calling a move a regression. This does that.
 *
 * Run on both sides of a change (e.g. with YELLOW_GIVEN_FOUL at its old and new
 * values) and compare the means, not one draw.
 *
 * Run: npx tsx scripts/championPointsProbe.ts   (SEASONS=20 default)
 */
import { mulberry32 } from "../src/engine/rng.js";
import { simSeason } from "../src/core/season.js";
import { YELLOW_GIVEN_FOUL } from "../src/engine/constants.js";

const SEASONS = Number(process.env.SEASONS ?? 20);

const champs: number[] = [];
const bottoms: number[] = [];
let reds = 0;
let matches = 0;

for (let s = 0; s < SEASONS; s++) {
  const { table, matches: ms } = simSeason(mulberry32(20000 + s));
  champs.push(table[0].points);
  bottoms.push(table[table.length - 1].points);
  matches += ms.length;
  for (const m of ms) {
    for (const l of [...m.boxScore.home, ...m.boxScore.away]) reds += l.redCards;
  }
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

console.log(`YELLOW_GIVEN_FOUL=${YELLOW_GIVEN_FOUL}  seasons=${SEASONS}`);
console.log(`  champion  mean ${mean(champs).toFixed(2)}  sd ${sd(champs).toFixed(2)}  min ${Math.min(...champs)}  max ${Math.max(...champs)}   (gate floor 78)`);
console.log(`  bottom    mean ${mean(bottoms).toFixed(2)}  sd ${sd(bottoms).toFixed(2)}  min ${Math.min(...bottoms)}  max ${Math.max(...bottoms)}   (gate band 15-32)`);
console.log(`  reds/match ${(reds / matches).toFixed(4)}`);
// The gate averages 5 seasons; show what its own sample would have said, to make
// clear how much of any move is the estimator rather than the change.
console.log(`  first-5-season mean (what the gate measures): ${mean(champs.slice(0, 5)).toFixed(2)}`);
