/**
 * Does the name table actually keep a long save's history legible?
 *
 * Sims a dynasty and reports, per season, how many of the save's own pid
 * references still resolve to a name and what the table costs in bytes. The
 * number to watch is `nameless`, which on a save with this feature should stay
 * at 0 however long the dynasty runs, where before it climbed to 78% by season
 * 101 (see scripts/retireeRefProbe.ts on a real save).
 *
 * Run: npx tsx scripts/playerNameProbe.ts [seasons] [seed]
 */
import { mulberry32 } from "../src/engine/rng.js";
import { createLeagueState } from "../src/core/leagueState.js";
import { simThrough } from "../src/core/simThrough.js";
import { simOffseason } from "../src/core/offseason.js";
import { referencedPids } from "../src/core/players/playerNames.js";

const SEASONS = Number(process.argv[2] ?? 12);
const SEED = Number(process.argv[3] ?? 7);

const rng = mulberry32(SEED);
let league = createLeagueState(0, rng);

console.log(`seasons=${SEASONS} seed=${SEED}`);
console.log("season |  refs | live | archive | nameTable | NAMELESS | names KB | archive KB");

for (let s = 1; s <= SEASONS; s++) {
  league = simThrough(league, "season", rng);
  // simThrough halts before the user's cup final, and simOffseason silently
  // returns the league unchanged on any phase but "offseason" — so resume until
  // the phase actually flips (the documented headless-harness trap).
  while (league.phase !== "offseason") league = simThrough(league, "season", rng);
  league = simOffseason(league, rng);

  const refs = referencedPids(league);
  const live = new Set(league.players.map((p) => p.pid));
  const arch = new Set(league.retiredPlayers.map((r) => r.pid));
  const named = new Set((league.playerNames ?? []).map((n) => n.pid));

  let l = 0, a = 0, n = 0, none = 0;
  for (const pid of refs) {
    if (live.has(pid)) l++;
    else if (arch.has(pid)) a++;
    else if (named.has(pid)) n++;
    else none++;
  }
  const namesKB = JSON.stringify(league.playerNames ?? []).length / 1000;
  const archKB = JSON.stringify(league.retiredPlayers).length / 1000;

  console.log(
    `${String(league.season).padStart(6)} | ${String(refs.size).padStart(5)} | ${String(l).padStart(4)} | ${String(a).padStart(7)} | ${String(n).padStart(9)} | ${String(none).padStart(8)} | ${namesKB.toFixed(0).padStart(8)} | ${archKB.toFixed(0).padStart(10)}`,
  );
  if (none > 0) {
    const sample = [...refs].filter((pid) => !live.has(pid) && !arch.has(pid) && !named.has(pid)).slice(0, 5);
    console.log(`         ^ unnamed pids, e.g. ${sample.join(", ")}`);
  }
}

const rows = (league.playerNames ?? []).length;
const bytes = JSON.stringify(league.playerNames ?? []).length;
console.log(`\nname table: ${rows} rows, ${(bytes / 1e6).toFixed(2)} MB, ${(bytes / Math.max(1, rows)).toFixed(0)} bytes/row`);
console.log(`per season: ${(rows / SEASONS).toFixed(0)} rows, ${(bytes / SEASONS / 1000).toFixed(0)} KB`);
