/**
 * Verifies the farewell-list fallback against a real exported save, through the
 * same `farewellIndex` the UI now uses.
 *
 * Reports how many pid references each surface can name before and after, so
 * the gain is measured rather than assumed.
 *
 * Usage: NODE_OPTIONS=--max-old-space-size=20480 npx tsx scripts/farewellRecoveryCheck.ts "<save>"
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { LeagueStore } from "../src/core/leagueState.js";
import type { SeasonAwards } from "../src/core/awards.js";
import type { WorldAwards } from "../src/core/worldAwards.js";
import { farewellIndex } from "../src/core/players/retirements.js";

const path = process.argv[2];
const raw = readFileSync(path);
const text = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
const L = JSON.parse(text) as LeagueStore;

const live = new Set((L.players ?? []).map((p) => p.pid));
const arch = new Set((L.retiredPlayers ?? []).map((r) => r.pid));
const winners = new Set<number>();
for (const h of L.seasonHistory ?? []) {
  for (const w of (h as { awardWinners?: { pid: number }[] }).awardWinners ?? []) winners.add(w.pid);
}
const farewell = farewellIndex(L.seasonHistory ?? []);

const before = (pid: number) => live.has(pid) || arch.has(pid) || winners.has(pid);
const after = (pid: number) => before(pid) || farewell.has(pid);

function awardPlaces(entry: { awards?: Record<number, SeasonAwards>; world?: WorldAwards }): number[] {
  const out: number[] = [];
  for (const a of Object.values(entry.awards ?? {})) {
    if (a.playerOfSeasonPid != null) out.push(a.playerOfSeasonPid);
    if (a.goldenBootPid != null) out.push(a.goldenBootPid);
    for (const pid of a.teamOfSeason ?? []) if (pid != null) out.push(pid);
  }
  for (const e of entry.world?.ballonDOr ?? []) out.push(e.pid);
  for (const pid of entry.world?.worldTeamOfYear ?? []) if (pid != null) out.push(pid);
  return out;
}

const surfaces: [string, number[]][] = [];
const places: number[] = [];
for (const h of L.seasonHistory ?? []) places.push(...awardPlaces(h));
surfaces.push(["award places", places]);
surfaces.push(["transfer rows", (L.transfers ?? []).map((t) => t.pid)]);
surfaces.push(["news events", (L.newsEvents ?? []).map((n) => (n as { pid: number }).pid)]);
const cupLines: number[] = [];
for (const c of L.cupHistory ?? []) for (const l of (c as { statLines?: { pid: number }[] }).statLines ?? []) cupLines.push(l.pid);
surfaces.push(["cup stat lines", cupLines]);

console.log(`# ${path.split("/").pop()} · season ${L.season} (displayed as ${2026 + L.season - 1})`);
console.log(`farewell index: ${farewell.size} names, from ${(L.seasonHistory ?? []).length} seasons of history\n`);
console.log(`surface            rows      named before   named after    recovered`);
for (const [name, pids] of surfaces) {
  if (!pids.length) continue;
  const b = pids.filter(before).length;
  const a = pids.filter(after).length;
  console.log(
    `${name.padEnd(16)} ${String(pids.length).padStart(8)} ${`${((b / pids.length) * 100).toFixed(1)}%`.padStart(15)} ${`${((a / pids.length) * 100).toFixed(1)}%`.padStart(13)} ${String(a - b).padStart(12)}`,
  );
}

// Nobody should ever be *lost* by adding a source.
const regressions = surfaces.flatMap(([, pids]) => pids.filter((p) => before(p) && !after(p)));
console.log(`\nreferences that stopped resolving: ${regressions.length} (must be 0)`);
