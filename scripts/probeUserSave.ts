/**
 * Times every piece of work the Transfers page does, against a real exported
 * save, to find what actually freezes it.
 *
 * Usage: npx tsx scripts/probeUserSave.ts "/path/to/export.json"
 */
import { readFileSync } from "node:fs";
import type { LeagueStore } from "../src/core/leagueState.js";
import { migrateLeague } from "../src/db/migrate.js";
import { transferWindowState } from "../src/core/transfers/window.js";
import {
  recommendedTransfers,
  searchWorldPlayers,
} from "../src/core/transfers/recommendations.js";
import {
  currentNegotiations,
  acquisitionWageCharge,
} from "../src/core/transfers/negotiation.js";
import { protectedStarPids, lastCompletedSeason } from "../src/core/transfers/protectedStars.js";

const path = process.argv[2];
if (!path) { console.error("pass the export path"); process.exit(1); }

const t0 = performance.now();
const raw = JSON.parse(readFileSync(path, "utf8")) as LeagueStore;
console.log(`parse: ${(performance.now() - t0).toFixed(0)}ms`);

const t1 = performance.now();
const league = migrateLeague(raw);
console.log(`migrateLeague: ${(performance.now() - t1).toFixed(0)}ms`);

const ws = transferWindowState(league);
console.log(`\nseason ${league.season}, phase ${league.phase}, window open=${ws.open}`);
console.log(`players ${league.players.length}, teams ${league.teams.length}, `
  + `activeLoans ${league.activeLoans.length}, transfers ${league.transfers.length}`);

const user = league.teams.find((t) => t.tid === league.meta.userTid);
console.log(`user club: ${user?.name}, roster ${user?.roster.length}, budget ${user?.budget}`);

function ms(label: string, fn: () => unknown): void {
  const t = performance.now();
  let out: unknown;
  try {
    out = fn();
  } catch (e) {
    console.log(`${label.padEnd(34)} THREW: ${(e as Error).message}`);
    return;
  }
  const took = performance.now() - t;
  const n = Array.isArray(out) ? ` (${out.length} rows)` : out instanceof Set ? ` (${out.size})` : "";
  console.log(`${label.padEnd(34)} ${took.toFixed(0)}ms${n}`);
}

console.log("\n--- what the page does on open ---");
ms("protectedStarPids", () =>
  protectedStarPids(
    lastCompletedSeason(league), league.teams, league.players, league.competitions,
    league.meta.userTid,
  ));
ms("currentNegotiations", () => currentNegotiations(league));
ms("recommendedTransfers", () => recommendedTransfers(league, 0, {}));
ms("searchWorldPlayers (no filters)", () => searchWorldPlayers(league, {}));

console.log("\n--- per-row work for the recommended list ---");
const targets = recommendedTransfers(league, 0, {});
ms("acquisitionWageCharge x rows", () => {
  for (const t of targets) acquisitionWageCharge(league, t.player);
  return targets;
});

console.log("\n--- interactive paths ---");
ms('search name "a"', () => searchWorldPlayers(league, { name: "a" }));
ms("search position ST", () => searchWorldPlayers(league, { position: "ST" }));
ms("recommended, position FB", () => recommendedTransfers(league, 0, { position: "FB" }));
