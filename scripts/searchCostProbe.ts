/**
 * Cost of the world player search on a large save, per keystroke-equivalent.
 *
 * Every earlier measurement called searchWorldPlayers with no filters, which
 * returns [] immediately -- so the actual search path was never timed on a big
 * league. This is the one derivation unique to /transfers, which is the page
 * users report freezing.
 *
 * Reads the cached league from leagueSizeDeepDive.ts (no re-sim).
 */
import { readFileSync, existsSync } from "node:fs";
import type { LeagueStore } from "../src/core/leagueState.js";
import { searchWorldPlayers, recommendedTransfers } from "../src/core/transfers/recommendations.js";

const cachePath = process.argv[2]
  ?? `${process.env.CLAUDE_JOB_DIR ?? "/tmp"}/tmp/league14.json`;
if (!existsSync(cachePath)) {
  console.error(`No cached league at ${cachePath}. Run leagueSizeDeepDive.ts first.`);
  process.exit(1);
}
const league = JSON.parse(readFileSync(cachePath, "utf8")) as LeagueStore;
league.phase = "offseason"; // summer window open, so the search is live

const ms = (fn: () => unknown) => {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
};

console.log(`league: season ${league.season}, ${league.players.length} players\n`);

// Typing "Martinez" one letter at a time is 8 separate searches pre-debounce,
// and one post-debounce. Time each prefix to see the shape of the cost.
const target = "martinez";
console.log("name query\tresults\tms");
for (let i = 1; i <= target.length; i++) {
  const q = target.slice(0, i);
  let n = 0;
  const t = ms(() => { n = searchWorldPlayers(league, { name: q }).length; });
  console.log(`${q.padEnd(10)}\t${n}\t${t.toFixed(0)}`);
}

// A single-letter query matches the most players, so it is the worst case for
// the valuation pass; a position filter alone is the widest possible net.
console.log("\nwidest filters");
for (const [label, filters] of [
  ["name 'a'", { name: "a" }],
  ["name 'e'", { name: "e" }],
  ["position ST", { position: "ST" }],
  ["minOvr 60", { minOvr: 60 }],
  ["minOvr 0", { minOvr: 0 }],
  ["maxAge 40", { maxAge: 40 }],
] as const) {
  let n = 0;
  const t = ms(() => { n = searchWorldPlayers(league, filters).length; });
  console.log(`  ${label.padEnd(14)} ${String(n).padStart(3)} results  ${t.toFixed(0)}ms`);
}

console.log("\nfor comparison");
console.log(`  recommendedTransfers      ${ms(() => recommendedTransfers(league, 0, {})).toFixed(0)}ms`);
console.log(`  searchWorldPlayers (none) ${ms(() => searchWorldPlayers(league, {})).toFixed(0)}ms`);
