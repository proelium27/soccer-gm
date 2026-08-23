/**
 * Can a save that has already lost its award winners get any of them back?
 *
 * Deletion is one-way, but a few records store a *copy* of a player's name
 * rather than a pid, and those copies outlive him:
 *   - `seasonHistory[].retirements.notable` (RetiredPlayer, capped at
 *     RETIREMENT_NOTABLE_LIMIT per offseason)
 *   - `international.history[].topScorer.name`
 * This counts how many otherwise-blank award places each source can still name,
 * on top of the live pool and the retiree archive.
 *
 * Usage: NODE_OPTIONS=--max-old-space-size=20480 npx tsx scripts/awardNameSources.ts "<save>"
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { LeagueStore } from "../src/core/leagueState.js";
import type { SeasonAwards } from "../src/core/awards.js";
import type { WorldAwards } from "../src/core/worldAwards.js";

const path = process.argv[2];
const raw = readFileSync(path);
const text = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
const L = JSON.parse(text) as LeagueStore;

function places(entry: { awards?: Record<number, SeasonAwards>; world?: WorldAwards }): number[] {
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

const allPlaces: number[] = [];
for (const h of L.seasonHistory ?? []) allPlaces.push(...places(h));

const live = new Set((L.players ?? []).map((p) => p.pid));
const arch = new Set((L.retiredPlayers ?? []).map((r) => r.pid));

const farewell = new Set<number>();
for (const h of L.seasonHistory ?? []) {
  for (const r of (h as { retirements?: { notable?: { pid: number }[] } }).retirements?.notable ?? []) farewell.add(r.pid);
}
const intlScorers = new Set<number>();
for (const t of L.international?.history ?? []) {
  const ts = (t as { topScorer?: { pid?: number; name?: string } }).topScorer;
  if (ts?.pid != null && ts.name) intlScorers.add(ts.pid);
}

const total = allPlaces.length;
const count = (f: (pid: number) => boolean) => allPlaces.filter(f).length;

const namedNow = count((p) => live.has(p) || arch.has(p));
const plusFarewell = count((p) => live.has(p) || arch.has(p) || farewell.has(p));
const plusAll = count((p) => live.has(p) || arch.has(p) || farewell.has(p) || intlScorers.has(p));

const pc = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
console.log(`# ${path.split("/").pop()} · season ${L.season} (displayed as ${2026 + L.season - 1})`);
console.log(`${total} award places across ${(L.seasonHistory ?? []).length} seasons\n`);
console.log(`named by live pool + retiree archive   ${String(namedNow).padStart(6)}  ${pc(namedNow)}`);
console.log(`  + season-history farewell lists      ${String(plusFarewell).padStart(6)}  ${pc(plusFarewell)}   (+${plusFarewell - namedNow} places)`);
console.log(`  + international top scorers          ${String(plusAll).padStart(6)}  ${pc(plusAll)}   (+${plusAll - plusFarewell} places)`);
console.log(`\nunrecoverable                          ${String(total - plusAll).padStart(6)}  ${pc(total - plusAll)}`);
console.log(`\nsource sizes: farewell names ${farewell.size}, intl top scorers ${intlScorers.size}`);
