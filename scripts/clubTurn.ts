/**
 * Explains why a club's season went the way it did, by comparing its squad
 * either side of the summer in between.
 *
 * A league table records that a champion collapsed; it never says why. This
 * pulls the three things that actually move a club between seasons: who left,
 * who arrived, and what happened to the squad's rating and age.
 *
 * Ratings come from `powerRankingHistory`, which is the only per-season record
 * of a team's strength that survives (rosters change constantly and the played
 * matches are wiped at every rollover).
 *
 * Usage:
 *   NODE_OPTIONS=--max-old-space-size=20480 npx tsx scripts/clubTurn.ts <save.json> "Club Name" <season>
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { LeagueStore } from "../src/core/leagueState.js";
import { migrateLeague } from "../src/db/migrate.js";
import { allCareers } from "../src/core/frivolities/careers.js";

const [path, clubName, seasonArg] = process.argv.slice(2);
if (!path || !clubName || !seasonArg) {
  console.error('usage: tsx scripts/clubTurn.ts <save.json> "Club Name" <season the collapse/rise happened>');
  process.exit(1);
}
const season = Number(seasonArg);

const buf = readFileSync(path);
const text = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
const L = migrateLeague(JSON.parse(text) as LeagueStore);

const club = L.teams.find((t) => t.name === clubName);
if (!club) {
  console.error(`no club named "${clubName}"`);
  process.exit(1);
}
const tid = club.tid;
const name = (x: number) => (x < 0 ? "free agent" : L.teams.find((t) => t.tid === x)?.name ?? `club ${x}`);
const comps = new Map(L.competitions.map((c) => [c.id, c]));

// Careers give a name and a per-season rating for living players and retirees alike.
const careers = new Map(allCareers(L).map((c) => [c.pid, c]));
const ovrIn = (pid: number, s: number) => careers.get(pid)?.seasons.find((x) => x.season === s)?.ovr ?? null;
const who = (pid: number) => careers.get(pid)?.name ?? `player ${pid}`;
const posOf = (pid: number) => careers.get(pid)?.pos ?? "";

console.log(`\n${"=".repeat(74)}`);
console.log(`${clubName} — what happened between season ${season - 1} and season ${season}`);
console.log("=".repeat(74));

// league position and points either side
for (const s of [season - 1, season]) {
  const h = L.seasonHistory?.find((x) => x.season === s);
  if (!h) continue;
  const cid = h.compsByTid?.[tid];
  const table = (h.table ?? []).filter((r) => String(h.compsByTid[r.tid]) === String(cid));
  const sorted = [...table].sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  const pos = sorted.findIndex((r) => r.tid === tid) + 1;
  const me = table.find((r) => r.tid === tid);
  const c = comps.get(Number(cid));
  console.log(`  season ${s}: ${pos} of ${table.length} in ${c?.country} tier ${c?.tier}, ` +
    `${me?.points} pts (${me?.won}W ${me?.drawn}D ${me?.lost}L, ${me?.gf}:${me?.ga})`);
}

// squad rating either side, from the power-ranking snapshots
console.log(`\n-- squad rating`);
for (const s of [season - 1, season]) {
  const snaps = (L.powerRankingHistory ?? []).filter((p) => p.season === s);
  const last = snaps[snaps.length - 1];
  const row = last?.rows.find((r) => r.tid === tid);
  if (row) console.log(`  season ${s}: team ovr ${row.ovr.toFixed(1)}, potential ${row.pot.toFixed(1)}`);
}

// who left and who came, in the summer between the two seasons
const out = (L.transfers ?? []).filter((t) => t.fromTid === tid && t.season === season);
const inn = (L.transfers ?? []).filter((t) => t.toTid === tid && t.season === season);
const fee = (t: (typeof out)[number]) =>
  t.loanReturn ? "loan ends" : t.loanSeasons ? `loan ${t.loanSeasons}s` : t.fee > 0 ? `$${(t.fee / 1e6).toFixed(0)}M` : "free";
// His rating the season before he moved is what the club actually lost.
const rank = (a: (typeof out)[number], b: (typeof out)[number]) =>
  (ovrIn(b.pid, season - 1) ?? 0) - (ovrIn(a.pid, season - 1) ?? 0);

console.log(`\n-- left that summer (${out.length})`);
for (const t of [...out].sort(rank).slice(0, 14)) {
  const o = ovrIn(t.pid, season - 1);
  console.log(`  ${String(o ?? "?").padStart(3)}  ${posOf(t.pid).padEnd(3)} ${who(t.pid).padEnd(24)} to ${name(t.toTid).padEnd(24)} ${fee(t)}`);
}

console.log(`\n-- arrived that summer (${inn.length})`);
for (const t of [...inn].sort(rank).slice(0, 14)) {
  const o = ovrIn(t.pid, season) ?? ovrIn(t.pid, season - 1);
  console.log(`  ${String(o ?? "?").padStart(3)}  ${posOf(t.pid).padEnd(3)} ${who(t.pid).padEnd(24)} from ${name(t.fromTid).padEnd(24)} ${fee(t)}`);
}

// the title-winning XI, and where each of them was a year later
console.log(`\n-- the best of the season-${season - 1} squad, and where they were in season ${season}`);
const squad = [...careers.values()]
  .filter((c) => c.seasons.some((s) => s.season === season - 1 && s.tid === tid))
  .sort((a, b) => (ovrIn(b.pid, season - 1) ?? 0) - (ovrIn(a.pid, season - 1) ?? 0))
  .slice(0, 12);
for (const c of squad) {
  const then = ovrIn(c.pid, season - 1);
  const after = c.seasons.find((s) => s.season === season);
  const age = season - 1 - c.born;
  const where = after ? (after.tid === tid ? `stayed (ovr ${after.ovr})` : `${name(after.tid)} (ovr ${after.ovr})`) : "gone from the game";
  console.log(`  ${String(then ?? "?").padStart(3)}  ${c.pos.padEnd(3)} ${c.name.padEnd(24)} aged ${String(age).padStart(2)}  ->  ${where}`);
}
console.log();
