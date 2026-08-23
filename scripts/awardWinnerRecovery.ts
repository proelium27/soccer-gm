/**
 * What the award-winner backfill can and cannot rescue in an existing save.
 *
 * `SeasonHistoryEntry.awardWinners` (core/awardWinners.ts) stops a save losing
 * its winners *from now on*, and migrate.ts backfills past seasons from whoever
 * is still resolvable. Nobody already deleted comes back. This runs the real
 * backfill over an exported save and counts award *places* — the slots a player
 * actually sees on /awards, a club's honours and the GOAT boards — as named or
 * blank, before and after.
 *
 * Usage: NODE_OPTIONS=--max-old-space-size=20480 npx tsx scripts/awardWinnerRecovery.ts "<save>"
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { LeagueStore } from "../src/core/leagueState.js";
import type { SeasonAwards } from "../src/core/awards.js";
import type { WorldAwards } from "../src/core/worldAwards.js";
import { backfillAwardWinners } from "../src/core/awardWinners.js";

const path = process.argv[2];
const raw = readFileSync(path);
const text = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
const L = JSON.parse(text) as LeagueStore;

const live = new Set((L.players ?? []).map((p) => p.pid));
const arch = new Set((L.retiredPlayers ?? []).map((r) => r.pid));

/** Every award place a season hands out, as (kind, pid) pairs — slots, not distinct people. */
function places(entry: { awards?: Record<number, SeasonAwards>; world?: WorldAwards }): [string, number][] {
  const out: [string, number][] = [];
  for (const a of Object.values(entry.awards ?? {})) {
    if (a.playerOfSeasonPid != null) out.push(["Player of the Season", a.playerOfSeasonPid]);
    if (a.goldenBootPid != null) out.push(["Golden Boot", a.goldenBootPid]);
    for (const pid of a.teamOfSeason ?? []) if (pid != null) out.push(["Team of the Season", pid]);
  }
  for (const e of entry.world?.ballonDOr ?? []) out.push(["Ballon d'Or top 10", e.pid]);
  for (const pid of entry.world?.worldTeamOfYear ?? []) if (pid != null) out.push(["World XI", pid]);
  return out;
}

const kinds = ["Player of the Season", "Golden Boot", "Team of the Season", "Ballon d'Or top 10", "World XI"];
const before = new Map<string, { total: number; named: number }>();
const after = new Map<string, { total: number; named: number }>();
for (const k of kinds) { before.set(k, { total: 0, named: 0 }); after.set(k, { total: 0, named: 0 }); }

for (const h of L.seasonHistory ?? []) {
  const filled = backfillAwardWinners(h, h.season, L.players ?? [], L.retiredPlayers ?? []) ?? [];
  const named = new Set(filled.map((w) => w.pid));
  for (const [kind, pid] of places(h)) {
    const b = before.get(kind)!;
    b.total++;
    if (live.has(pid) || arch.has(pid)) b.named++;
    const a = after.get(kind)!;
    a.total++;
    if (named.has(pid)) a.named++;
  }
}

console.log(`# ${path.split("/").pop()} · season ${L.season} (displayed as ${2026 + L.season - 1})`);
console.log(`${(L.seasonHistory ?? []).length} completed seasons · ${(L.players ?? []).length} live players · ${(L.retiredPlayers ?? []).length} archived careers\n`);
console.log(`award place              places   named now   after backfill   still blank`);
let tT = 0, tB = 0, tA = 0;
for (const k of kinds) {
  const b = before.get(k)!, a = after.get(k)!;
  if (!b.total) continue;
  tT += b.total; tB += b.named; tA += a.named;
  console.log(
    `${k.padEnd(22)} ${String(b.total).padStart(8)} ${`${((b.named / b.total) * 100).toFixed(0)}%`.padStart(11)} ${`${((a.named / a.total) * 100).toFixed(0)}%`.padStart(16)} ${String(a.total - a.named).padStart(13)}`,
  );
}
console.log(`${"ALL".padEnd(22)} ${String(tT).padStart(8)} ${`${((tB / tT) * 100).toFixed(0)}%`.padStart(11)} ${`${((tA / tT) * 100).toFixed(0)}%`.padStart(16)} ${String(tT - tA).padStart(13)}`);

// Per-decade, to show whether the loss is about age or about the prune bar.
console.log(`\nby era (after backfill):`);
const eras = new Map<number, { total: number; named: number }>();
for (const h of L.seasonHistory ?? []) {
  const filled = backfillAwardWinners(h, h.season, L.players ?? [], L.retiredPlayers ?? []) ?? [];
  const named = new Set(filled.map((w) => w.pid));
  const d = Math.floor((h.season - 1) / 20) * 20 + 1;
  const e = eras.get(d) ?? { total: 0, named: 0 };
  for (const [, pid] of places(h)) { e.total++; if (named.has(pid)) e.named++; }
  eras.set(d, e);
}
for (const [d, e] of [...eras].sort((a, b) => a[0] - b[0])) {
  console.log(`  seasons ${String(d).padStart(3)}-${String(d + 19).padEnd(3)} (${2026 + d - 1}-${2026 + d + 18}): ${String(e.total).padStart(5)} places, ${((e.named / e.total) * 100).toFixed(0)}% named`);
}
