/**
 * Does the cull actually fix the thing that freezes the game?
 *
 * Sims a dynasty and reports save size plus the two main-thread costs that scale
 * with it (the IndexedDB write on every mutation, and the structuredClone that
 * postMessage does to hand the league to the sim worker). Compare against the
 * pre-cull baseline recorded in scripts/leagueSizeTiming.ts:
 *   season  1:  9.2 MB, clone   67ms, save   75ms
 *   season  9: 58.8 MB, clone  716ms, save  542ms
 *   season 14: 87.9 MB, clone 4230ms, save 2756ms
 */
import "fake-indexeddb/auto";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { mulberry32 } from "../src/engine/rng.js";
import { saveLeague } from "../src/db/leagueDb.js";

const SEASONS = Number(process.argv[2] ?? 14);

async function ms(fn: () => unknown | Promise<unknown>): Promise<number> {
  const t0 = performance.now();
  await fn();
  return performance.now() - t0;
}

const rng = mulberry32(7);
let league = createLeagueState(0, rng);

console.log(["season", "players", "onRoster", "freeAgents", "MB", "clone", "save"].join("\t"));

for (let s = 1; s <= SEASONS; s++) {
  league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);

  const onRoster = new Set(league.teams.flatMap((t) => [...t.roster, ...t.academyRoster]));
  const bytes = JSON.stringify(league).length;
  const tClone = await ms(() => structuredClone(league));
  const tSave = await ms(() => saveLeague({ ...league, lid: 1 }));

  console.log(
    [
      s, league.players.length, onRoster.size, league.players.length - onRoster.size,
      (bytes / 1e6).toFixed(1), tClone.toFixed(0), tSave.toFixed(0),
    ].join("\t"),
  );
}
