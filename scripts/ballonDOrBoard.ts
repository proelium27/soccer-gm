/**
 * The highest Ballon d'Or scores ever recorded, pooled across every save.
 *
 * Each season's shortlist is stored with the score that decided it, broken into
 * the parts that produced it: league form, the Continental Cup, international
 * football and a league title. So this ranks single seasons rather than careers,
 * and shows what a dominant one is actually made of.
 *
 * Usage:
 *   NODE_OPTIONS=--max-old-space-size=20480 npx tsx scripts/ballonDOrBoard.ts [dir] [topN]
 */
import { readFileSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { LeagueStore } from "../src/core/leagueState.js";
import { migrateLeague } from "../src/db/migrate.js";
import { allCareers } from "../src/core/frivolities/careers.js";

const dir = process.argv[2] ?? "/Users/calebmeyer/soccer-gm/leaguesaves";
const TOP = Number(process.argv[3] ?? 15);

type Row = {
  world: string; god: boolean; managed: boolean;
  season: number; name: string; nat: string; pos: string; club: string;
  score: number; league: number; cup: number; intl: number; title: number;
  goals: number | null; assists: number | null; apps: number | null; ovr: number | null;
};
const rows: Row[] = [];

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const buf = readFileSync(`${dir}/${file}`);
  const text = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
  const L: LeagueStore = migrateLeague(JSON.parse(text) as LeagueStore);

  const userTid = L.meta.userTid;
  const world = L.teams.find((t) => t.tid === userTid)?.name ?? L.meta.name;
  const careers = new Map(allCareers(L).map((c) => [c.pid, c]));
  const nm = (tid: number) => L.teams.find((t) => t.tid === tid)?.name ?? `club ${tid}`;

  // A season's league stat line, where the player still exists to carry one.
  const live = new Map(L.players.map((p) => [p.pid, p]));

  for (const h of L.seasonHistory ?? []) {
    // Index 0 is the winner; the rest are the shortlist behind him.
    const winner = h.world?.ballonDOr?.[0];
    if (!winner) continue;
    const c = careers.get(winner.pid);
    const p = live.get(winner.pid);
    const line = p?.stats?.find((s) => s.season === h.season) ?? null;
    rows.push({
      world, god: L.godMode, managed: winner.tid === userTid,
      season: h.season,
      name: c?.name ?? `player ${winner.pid}`,
      nat: c?.nationality ?? "?",
      pos: c?.pos ?? "?",
      club: nm(winner.tid),
      score: winner.score,
      league: winner.league, cup: winner.cup, intl: winner.intl, title: winner.title,
      goals: line?.goals ?? null,
      assists: line?.assists ?? null,
      apps: line?.appearances ?? null,
      ovr: c?.seasons.find((s) => s.season === h.season)?.ovr ?? null,
    });
  }
}

rows.sort((a, b) => b.score - a.score);

const n = (x: number) => x.toFixed(2).padStart(6);
console.log(`\nHighest Ballon d'Or scores across every save (${rows.length} awards on record)\n`);
console.log("  score   league     cup    intl   title  player");
for (const r of rows.slice(0, TOP)) {
  console.log(
    `  ${n(r.score)}  ${n(r.league)}  ${n(r.cup)}  ${n(r.intl)}  ${n(r.title)}  ` +
      `${r.name} (${r.nat}, ${r.pos}) s${r.season}, ${r.club}` +
      `${r.managed ? " [MANAGED]" : ""}${r.god ? " [god]" : ""} — ${r.world} world`,
  );
  if (r.goals !== null) {
    console.log(`${" ".repeat(42)}that season: ${r.goals}G ${r.assists}A in ${r.apps} games, ovr ${r.ovr ?? "?"}`);
  }
}

// The pooled top is dominated by whichever world ran longest and scored highest,
// so also give each world its own best season. Otherwise this is a table about
// one save rather than a record board.
console.log(`\n  best in each world:`);
const byWorld = new Map<string, Row>();
for (const r of rows) {
  const cur = byWorld.get(r.world);
  if (!cur || r.score > cur.score) byWorld.set(r.world, r);
}
for (const r of [...byWorld.values()].sort((a, b) => b.score - a.score)) {
  console.log(
    `  ${n(r.score)}  ${r.name} (${r.nat}, ${r.pos}) s${r.season}, ${r.club}` +
      `${r.managed ? " [MANAGED]" : ""} — ${r.world} world${r.god ? " [god]" : ""}` +
      (r.goals !== null ? `  (${r.goals}G ${r.assists}A in ${r.apps})` : ""),
  );
}

// what a typical winning score looks like, for context on the top end
const scores = rows.map((r) => r.score).sort((a, b) => a - b);
const median = scores[scores.length >> 1];
console.log(`\n  median winning score ${median.toFixed(2)}, lowest ever ${scores[0].toFixed(2)}`);
const parts = ["league", "cup", "intl", "title"] as const;
for (const k of parts) {
  const mean = rows.reduce((sum, r) => sum + r[k], 0) / rows.length;
  console.log(`  mean ${k.padEnd(6)} contribution ${mean.toFixed(2)}`);
}
console.log();
