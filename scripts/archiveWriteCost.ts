/**
 * What a bigger `RETIREE_ARCHIVE_LIMIT` costs on every single save, not just on
 * disk.
 *
 * `saveLeague` writes the whole non-player league record on every mutation
 * (`leagues.put({ ...rest })` in db/leagueDb.ts), and `retiredPlayers` is part
 * of `rest`. So the archive is serialised and written again every time the user
 * changes a lineup or signs anyone. The split-player work (#210) took a routine
 * action from 281ms to 118ms by *not* rewriting what hadn't changed; growing a
 * non-player field spends that back.
 *
 * This times structuredClone (what the worker handoff costs) and JSON encoding
 * (a proxy for the IDB write) against archive sizes.
 *
 * Usage: NODE_OPTIONS=--max-old-space-size=20480 npx tsx scripts/archiveWriteCost.ts "<save>"
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

/** Grow the real archive to `n` rows by repeating it, so row shape stays honest. */
function sized(n: number): ArchivedPlayer[] {
  const out: ArchivedPlayer[] = [];
  while (out.length < n) out.push(...rows.slice(0, Math.min(rows.length, n - out.length)));
  return out;
}

const time = (fn: () => void): number => {
  fn(); // warm
  const t0 = performance.now();
  for (let i = 0; i < 3; i++) fn();
  const ms = (performance.now() - t0) / 3;
  return ms;
};

console.log(`# ${path.split("/").pop()} · season ${L.season}`);
console.log(`measuring the cost paid on EVERY save, per db/leagueDb.ts saveLeague\n`);
console.log(`   cap      MB   clone ms   encode ms`);

for (const cap of [2000, 5000, 10000, 20000, 40000]) {
  const arr = sized(cap);
  const mb = JSON.stringify(arr).length / 1e6;
  // NOTE: `sized` repeats the same row objects, and structuredClone preserves
  // identity, so the clone column is an under-read and is not quoted anywhere.
  // JSON.stringify does not dedupe, so the encode column is honest.
  const clone = time(() => { structuredClone(arr); });
  const encode = time(() => { JSON.stringify(arr); });
  console.log(
    `${String(cap).padStart(7)} ${mb.toFixed(1).padStart(7)} ${clone.toFixed(0).padStart(10)} ${encode.toFixed(0).padStart(11)}`,
  );
}

console.log(`\nFor scale: #210 took a routine action from 281ms to 118ms on an 8-season save.`);
console.log(`Anything added here is paid on every lineup change, signing and settings tweak.`);
