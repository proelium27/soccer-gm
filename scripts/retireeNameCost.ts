/**
 * What it would cost, in save bytes, to keep every historical player's *name*.
 *
 * The retiree archive (`RETIREE_ARCHIVE_LIMIT`) is a leaderboard store: fat rows
 * (career totals, best seasons, a line per season) capped at 2,000 because of
 * that width. Naming a pid on a transfer row needs almost none of that. This
 * measures the two separately so the cap can be argued about with numbers.
 *
 * Usage: NODE_OPTIONS=--max-old-space-size=20480 npx tsx scripts/retireeNameCost.ts "<save>"
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { LeagueStore } from "../src/core/leagueState.js";

const path = process.argv[2];
const raw = readFileSync(path);
const text = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
const L = JSON.parse(text) as LeagueStore;

const mb = (n: number) => (n / 1e6).toFixed(2);
const total = JSON.stringify(L).length;
console.log(`season ${L.season} · total ${mb(total)} MB raw JSON`);

const fields = Object.entries(L as unknown as Record<string, unknown>)
  .map(([k, v]) => [k, JSON.stringify(v ?? null).length] as const)
  .sort((a, b) => b[1] - a[1]);
console.log(`\nfield sizes:`);
for (const [k, size] of fields) {
  if (size < 200_000) continue;
  console.log(`  ${k.padEnd(22)} ${mb(size).padStart(8)} MB  ${((size / total) * 100).toFixed(1).padStart(5)}%`);
}

const arch = L.retiredPlayers ?? [];
const archBytes = JSON.stringify(arch).length;
console.log(`\narchive: ${arch.length} rows, ${mb(archBytes)} MB → ${(archBytes / Math.max(1, arch.length)).toFixed(0)} bytes/row`);

// A "lite" identity row: everything PlayerRefLink and a stub profile need.
type Lite = { pid: number; name: string; nationality: string; pos: string; born: number; peak: number; last: number };
const sampleLite: Lite[] = arch.slice(0, 500).map((r) => ({
  pid: r.pid, name: r.name, nationality: r.nationality, pos: r.pos,
  born: r.born, peak: r.peakOvr, last: r.retiredSeason,
}));
const litePer = JSON.stringify(sampleLite).length / Math.max(1, sampleLite.length);
console.log(`lite identity row: ${litePer.toFixed(0)} bytes/row (${(archBytes / Math.max(1, arch.length) / litePer).toFixed(0)}x cheaper than an archive row)`);

// How many pids does the save's history actually reference?
const referenced = new Set<number>();
for (const t of L.transfers ?? []) referenced.add(t.pid);
for (const n of L.newsEvents ?? []) { const p = (n as { pid?: number }).pid; if (p != null) referenced.add(p); }
for (const c of L.cupHistory ?? []) for (const l of (c as { statLines?: { pid: number }[] }).statLines ?? []) referenced.add(l.pid);
for (const h of L.seasonHistory ?? []) {
  for (const a of Object.values(h.awards ?? {})) {
    const poty = a.playerOfSeasonPid; if (poty != null) referenced.add(poty);
    const boot = a.goldenBootPid; if (boot != null) referenced.add(boot);
    for (const pid of a.teamOfSeason ?? []) if (pid != null) referenced.add(pid);
  }
  for (const e of h.world?.ballonDOr ?? []) referenced.add(e.pid);
  for (const pid of h.world?.worldTeamOfYear ?? []) if (pid != null) referenced.add(pid);
}
const live = new Set((L.players ?? []).map((p) => p.pid));
const archived = new Set(arch.map((r) => r.pid));
const orphans = [...referenced].filter((pid) => !live.has(pid) && !archived.has(pid));

console.log(`\nreferenced pids: ${referenced.size} (live ${[...referenced].filter((p) => live.has(p)).length}, archived ${[...referenced].filter((p) => archived.has(p)).length}, NAMELESS ${orphans.length})`);
console.log(`naming every referenced pid at ${litePer.toFixed(0)} B/row: ${mb(referenced.size * litePer)} MB (${((referenced.size * litePer) / total * 100).toFixed(1)}% of this save)`);
console.log(`per season of play: ${(referenced.size / L.season).toFixed(0)} newly-referenced pids, ${((referenced.size * litePer) / L.season / 1e6).toFixed(3)} MB`);

// Where do the references come from? (rows, not distinct pids)
console.log(`\nreference rows: transfers ${(L.transfers ?? []).length}, newsEvents ${(L.newsEvents ?? []).length}, cup statLines ${(L.cupHistory ?? []).reduce((n, c) => n + ((c as { statLines?: unknown[] }).statLines?.length ?? 0), 0)}`);
