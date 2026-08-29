/**
 * Where does the time in a "generate a world then play it" test actually go?
 *
 * The slowest test files (offseason*, international*, m4-*, m3-top-scorer) all
 * build their world with `createLeagueState` rather than the cached
 * `makeLeague` fixture, because they thread one rng through generation *and*
 * the season that follows — a cached world skips generation, so the rng arrives
 * in the wrong state and every downstream draw shifts (see the note on
 * `test/helpers/worldCache.ts`).
 *
 * That is a real constraint, and it is tempting to conclude those tests are
 * expensive *because* they regenerate. This measures whether that is true
 * before anyone spends effort on it: generation is a fixed ~4s, while a season
 * is 320 clubs x 38 matchdays. If the season dominates, making these tests
 * cache-eligible buys a few percent and is not worth the risk to rng ordering.
 *
 *   npx tsx scripts/worldGenSplitProbe.ts
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";

const ms = (t: number) => `${(t / 1000).toFixed(1)}s`;

let t = Date.now();
const rng = mulberry32(7);
let league = createLeagueState(0, rng);
const genMs = Date.now() - t;

t = Date.now();
league = simThrough(league, "season", rng);
const seasonMs = Date.now() - t;

t = Date.now();
simOffseason(league, rng);
const offseasonMs = Date.now() - t;

const total = genMs + seasonMs + offseasonMs;
const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;

console.log(`\n=== one "generate + play + roll over" cycle ===`);
console.log(`  createLeagueState : ${ms(genMs)}  ${pct(genMs)}`);
console.log(`  simThrough season : ${ms(seasonMs)}  ${pct(seasonMs)}`);
console.log(`  simOffseason      : ${ms(offseasonMs)}  ${pct(offseasonMs)}`);
console.log(`  total             : ${ms(total)}`);
console.log(
  `\nCeiling on caching generation away: ${pct(genMs)} of such a test.\n`,
);
