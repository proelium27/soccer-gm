/**
 * What an `ArchivedPlayer` row is actually made of, so `RETIREE_ARCHIVE_LIMIT`
 * can be raised against measured bytes rather than a guess.
 *
 * Breaks the row into its four parts and prints what a range of caps would cost
 * on the save it is pointed at.
 *
 * Usage: NODE_OPTIONS=--max-old-space-size=20480 npx tsx scripts/archiveRowCost.ts "<save>"
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { LeagueStore } from "../src/core/leagueState.js";
import type { ArchivedPlayer } from "../src/core/players/archive.js";

const path = process.argv[2];
const raw = readFileSync(path);
const text = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
const L = JSON.parse(text) as LeagueStore;

const rows = (L.retiredPlayers ?? []) as ArchivedPlayer[];
if (rows.length === 0) {
  console.log("no archived retirees in this save");
  process.exit(0);
}

const bytes = (v: unknown) => JSON.stringify(v ?? null).length;
const total = bytes(rows);
const per = total / rows.length;

console.log(`# ${path.split("/").pop()} · season ${L.season}`);
console.log(`archive: ${rows.length} rows, ${(total / 1e6).toFixed(2)} MB, ${per.toFixed(0)} bytes/row\n`);

// Which part of the row costs what.
const part = (pick: (r: ArchivedPlayer) => unknown) =>
  rows.reduce((n, r) => n + bytes(pick(r)), 0) / rows.length;

const seasons = part((r) => r.seasons);
const totals = part((r) => r.totals);
const best = part((r) => r.best);
const identity = per - seasons - totals - best;

console.log("part            bytes/row   share");
for (const [name, n] of [
  ["identity+career", identity], ["seasons[]", seasons], ["totals", totals], ["best", best],
] as const) {
  console.log(`${name.padEnd(16)} ${n.toFixed(0).padStart(9)}   ${((n / per) * 100).toFixed(0).padStart(4)}%`);
}

const apps = rows.map((r) => r.seasons.length).sort((a, b) => a - b);
console.log(`\nseasons per row: median ${apps[Math.floor(apps.length / 2)]}, max ${apps[apps.length - 1]}`);

// What would a bigger cap cost? Rows are ~constant width, so this is linear.
console.log(`\ncap        archive MB   (at ${per.toFixed(0)} B/row)`);
for (const cap of [2000, 5000, 10000, 20000, 50000]) {
  console.log(`${String(cap).padStart(6)} ${((cap * per) / 1e6).toFixed(1).padStart(12)}`);
}

// How many retirees would actually want a row, if nothing were capped?
const refs = new Set<number>();
for (const t of L.transfers ?? []) refs.add(t.pid);
for (const e of L.newsEvents ?? []) { const p = (e as { pid?: number }).pid; if (p != null) refs.add(p); }
const live = new Set((L.players ?? []).map((p) => p.pid));
const wanted = [...refs].filter((p) => !live.has(p)).length;
console.log(`\nreferenced-but-deleted pids in this save: ${wanted} (${(wanted / L.season).toFixed(0)}/season)`);
console.log(`a full row for every one of them: ${((wanted * per) / 1e6).toFixed(0)} MB`);
