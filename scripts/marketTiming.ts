/**
 * How long one runAITransferMarket pass costs on a full world.
 *
 * The availability pre-filter was also the only early-out ahead of the O(teams)
 * buyer loop, so deleting it means every candidate is now evaluated against
 * every club. This measures what that actually costs rather than inferring it
 * from audit wall-clock.
 *
 *   npx tsx scripts/marketTiming.ts [seasons]
 */
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { mulberry32 } from "../src/engine/rng.js";
import { runAITransferMarket } from "../src/core/ai/transferMarket.js";

const SEASONS = Number(process.argv[2] ?? 3);

const rng = mulberry32(1);
let league = createLeagueState(0, rng);
for (let s = 1; s < SEASONS; s++) {
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);
}

const run = () =>
  runAITransferMarket(
    league.teams,
    league.players,
    league.activeLoans,
    league.transfers,
    league.season,
    league.played,
    "summer",
    league.phase,
    league.meta.userTid,
    12345,
    league.competitions,
    new Set<number>(),
  );

// Warm up, then take the best of several to cut noise.
run();
const times: number[] = [];
let moves = 0;
for (let i = 0; i < 5; i++) {
  const t0 = performance.now();
  const res = run();
  times.push(performance.now() - t0);
  moves = res.transfers.length;
}
times.sort((a, b) => a - b);
console.log(
  `season ${league.season}: runAITransferMarket ${times[0].toFixed(0)}ms (best of 5, median ${times[2].toFixed(0)}ms), ${moves} transfers`,
);
